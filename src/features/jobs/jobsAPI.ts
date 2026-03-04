import { apiRequest } from '../../services/axiosInstance'
import { calculateAgingDays } from '../../utils/agingCalculator'
import type { JobApiRecord, JobRecord, JobStatus } from './jobTypes'

type JobsListResponse = JobApiRecord[] | { data?: JobApiRecord[]; jobs?: JobApiRecord[] } | null | undefined
export type JobsQueryParams = {
  search?: string
  department?: string
  status?: JobStatus
}

function normalizeStatus(status?: string): JobStatus {
  const value = (status ?? '').trim().toLowerCase()
  if (value === 'on hold' || value === 'on_hold' || value === 'hold') return 'On Hold'
  if (value === 'filled') return 'Filled'
  if (value === 'cancelled' || value === 'canceled') return 'Cancelled'
  if (value === 'closed') return 'Closed'
  return 'Open'
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function parseSalaryRange(value?: string): { min: number; max: number } {
  if (!value) return { min: 0, max: 0 }
  const matches = value.match(/\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) return { min: 0, max: 0 }
  const min = toNumber(matches[0], 0)
  const max = toNumber(matches[1] ?? matches[0], min)
  return { min, max }
}

function fallbackReqId(jobId?: string): string {
  if (!jobId) return 'REQ-PENDING'
  const normalized = jobId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const suffix = normalized.slice(-6).padStart(6, '0')
  return `REQ-${suffix}`
}

function normalizeJob(apiJob: JobApiRecord): JobRecord {
  const openings = toNumber(apiJob.numberOfOpenings ?? apiJob.openings ?? apiJob.totalOpenings ?? apiJob.openPositions, 0)
  const filled = toNumber(apiJob.filled ?? apiJob.filledCount, 0)
  const candidatesApplied = toNumber(
    apiJob.applicantsCount ?? apiJob.candidateCount ?? apiJob.totalApplicants ?? apiJob.appliedCandidates,
    0,
  )
  const agingDays = toNumber(apiJob.agingDays, calculateAgingDays(apiJob.createdAt))
  const salary = parseSalaryRange(apiJob.salaryRange)

  const resolvedId = apiJob.id ?? apiJob._id ?? ''
  return {
    id: resolvedId,
    reqId: apiJob.reqId ?? apiJob.requisitionId ?? fallbackReqId(resolvedId),
    title: apiJob.title ?? apiJob.jobTitle ?? 'Untitled Job',
    department: apiJob.department ?? 'Unassigned',
    location: apiJob.location,
    employmentType: apiJob.emplyementType ?? apiJob.employmentType,
    experienceLevel: apiJob.experienceLevel,
    salaryMin: salary.min,
    salaryMax: salary.max,
    hiringManager: apiJob.hiringManager,
    status: normalizeStatus(apiJob.jobStatus ?? apiJob.status),
    openings,
    filled: Math.min(filled, openings || filled),
    targetClosureDate: apiJob.targetClosureDate,
    description: apiJob.description,
    skillsRequired: Array.isArray(apiJob.skillsRequired) ? apiJob.skillsRequired : [],
    agingDays,
    candidatesApplied,
  }
}

function extractJobs(payload: JobsListResponse): JobApiRecord[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  return payload.data ?? payload.jobs ?? []
}

export async function getJobs(query: JobsQueryParams = {}): Promise<JobRecord[]> {
  const params = new URLSearchParams()
  if (query.search && query.search.trim().length > 0) params.set('search', query.search.trim())
  if (query.department && query.department.trim().length > 0) params.set('department', query.department.trim())
  if (query.status && query.status.trim().length > 0) params.set('status', query.status)
  const queryString = params.toString()
  const path = queryString.length > 0 ? `/jobs?${queryString}` : '/jobs'

  const response = await apiRequest<JobsListResponse>(path)
  return extractJobs(response).map(normalizeJob).filter((job) => job.id.length > 0)
}

export async function getJobById(jobId: string): Promise<JobRecord> {
  const response = await apiRequest<JobApiRecord | { data?: JobApiRecord }>(`/jobs/${jobId}`)
  const payload =
    typeof response === 'object' && response !== null && 'data' in response ? response.data : (response as JobApiRecord)
  if (!payload) {
    throw new Error('Job details not found')
  }
  return normalizeJob(payload)
}

export async function createJob(data: Partial<JobApiRecord>): Promise<JobRecord> {
  const response = await apiRequest<JobApiRecord>('/jobs', {
    method: 'POST',
    body: data,
  })
  return normalizeJob(response)
}

export async function updateJob(jobId: string, data: Partial<JobApiRecord>): Promise<JobRecord> {
  const response = await apiRequest<JobApiRecord>(`/jobs/${jobId}`, {
    method: 'PUT',
    body: data,
  })
  return normalizeJob(response)
}

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<JobRecord> {
  const response = await apiRequest<JobApiRecord>(`/jobs/${jobId}/status`, {
    method: 'PUT',
    body: { jobStatus: status },
  })
  return normalizeJob(response)
}

export async function deleteJob(jobId: string): Promise<void> {
  await apiRequest<void>(`/jobs/${jobId}`, {
    method: 'DELETE',
  })
}
