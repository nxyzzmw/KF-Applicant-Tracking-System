import { API_BASE_URL, apiRequest } from '../../services/axiosInstance'
import { invalidateCache, readCache, writeCache } from '../../services/queryCache'
import { getAccessToken } from '../../services/tokenService'
import type {
  AddInterviewInput,
  CandidateApiRecord,
  CandidateFormValues,
  CandidateInterview,
  CandidateRecord,
  CandidateStatus,
  CandidateTimelineResponse,
  UpdateInterviewInput,
} from './candidateTypes'
import { CANDIDATE_STATUS_OPTIONS } from './candidateTypes'

type CandidateListResponse =
  | CandidateApiRecord[]
  | { data?: CandidateApiRecord[] | { data?: CandidateApiRecord[]; candidates?: CandidateApiRecord[]; items?: CandidateApiRecord[] }; candidates?: CandidateApiRecord[]; items?: CandidateApiRecord[] }
  | null
  | undefined

export type CandidateQueryParams = {
  jobID?: string
  jobId?: string
  search?: string
  name?: string
  email?: string
  role?: string
  status?: CandidateStatus
}

const CANDIDATE_LIST_CACHE_TTL_MS = 12_000
const CANDIDATE_DETAIL_CACHE_TTL_MS = 25_000

function normalizeCandidateStatus(value?: string): CandidateStatus {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'technical intv 1') return 'Technical Interview 1'
  if (normalized === 'technical intv 2') return 'Technical Interview 2'
  if (normalized === 'hr round') return 'HR Interview'
  if (normalized === 'offer accepted' || normalized === 'offer accepted') return 'Offer Accepted'
  if (normalized === 'offer declined' || normalized === 'offer declined') return 'Offer Declined'
  if (normalized === 'offer revoked' || normalized === 'offer revoked') return 'Offer Revoked'
  if (normalized === 'no answer' || normalized === 'no answer') return 'No Answer'
  if (normalized === 'candidate not interested' || normalized === 'candidate not interested') return 'Candidate Not Interested'
  if (normalized === 'rejected intv 1') return 'Rejected Technical Interview 1'
  if (normalized === 'rejected intv 2') return 'Rejected Technical Interview 2'
  const match = CANDIDATE_STATUS_OPTIONS.find((status) => status.toLowerCase() === normalized)
  return match ?? 'Applied'
}

function toBackendCandidateStatus(status: CandidateStatus): string {
  return status
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function normalizeCandidate(record: CandidateApiRecord): CandidateRecord {
  const id = record.id ?? record._id ?? ''
  const jobRecord =
    record.jobID && typeof record.jobID === 'object' ? (record.jobID as { _id?: string; id?: string; jobTitle?: string; title?: string }) : null
  const jobId = typeof record.jobID === 'string' ? record.jobID : jobRecord?._id ?? jobRecord?.id ?? ''
  const jobTitle = jobRecord?.jobTitle ?? jobRecord?.title
  return {
    id,
    name: record.name ?? 'Unnamed Candidate',
    jobID: jobId,
    role: record.role,
    jobTitle,
    email: record.email ?? '',
    contactDetails: record.contactDetails ?? '',
    location: record.location ?? '',
    skills: Array.isArray(record.skills) ? record.skills : [],
    experience: toNumber(record.experience, 0),
    education: record.education ?? '',
    noticePeriod: toNumber(record.noticePeriod, 0),
    referal: record.referal,
    recruiter: record.recruiter,
    status: normalizeCandidateStatus(record.status),
    statusHistory: Array.isArray(record.statusHistory)
      ? record.statusHistory.map((item) => ({
          status: normalizeCandidateStatus(item.status),
          comment: item.comment,
          updatedAt: item.updatedAt,
          updatedByName: item.updatedByName,
          updatedByEmail: item.updatedByEmail,
          updatedByRole: item.updatedByRole,
        }))
      : [],
    interviews: Array.isArray(record.interviews) ? (record.interviews as CandidateInterview[]) : [],
    notes: Array.isArray(record.notes)
      ? record.notes.map((note) => ({ text: note.text ?? '', createdAt: note.createdAt }))
      : [],
    resume: record.resume,
    feedback: record.feedback,
    applicationMetrics: record.applicationMetrics,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function getCurrentUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = localStorage.getItem('user')
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as { id?: string; _id?: string; userId?: string }
    return parsed.id ?? parsed._id ?? parsed.userId
  } catch {
    return undefined
  }
}

function buildCandidateParams(query: CandidateQueryParams & { name?: string; email?: string; role?: string }): URLSearchParams {
  const params = new URLSearchParams()
  const resolvedJobId = query.jobID ?? query.jobId
  if (resolvedJobId) {
    params.set('jobID', resolvedJobId)
    params.set('jobId', resolvedJobId)
  }
  if (query.status) params.set('status', toBackendCandidateStatus(query.status))
  if (query.name) params.set('name', query.name)
  if (query.email) params.set('email', query.email)
  if (query.role) params.set('role', query.role)
  return params
}

function extractCandidates(payload: CandidateListResponse): CandidateApiRecord[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as { data?: CandidateApiRecord[]; candidates?: CandidateApiRecord[]; items?: CandidateApiRecord[] }
    return nested.data ?? nested.candidates ?? nested.items ?? []
  }
  return payload.candidates ?? payload.items ?? []
}

async function requestCandidateCollection(path: string): Promise<CandidateApiRecord[]> {
  const response = await apiRequest<CandidateListResponse>(path)
  return extractCandidates(response)
}

function extractCandidatePayload(payload: unknown): CandidateApiRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const nested =
    (record.data as CandidateApiRecord | undefined) ??
    (record.candidate as CandidateApiRecord | undefined) ??
    (record.result as CandidateApiRecord | undefined)
  const candidate = nested ?? (record as unknown as CandidateApiRecord)
  if (!candidate || typeof candidate !== 'object') return null
  const hasCandidateShape =
    typeof candidate.id === 'string' ||
    typeof candidate._id === 'string' ||
    typeof candidate.name === 'string' ||
    typeof candidate.jobID === 'string'
  return hasCandidateShape ? candidate : null
}

function toCandidatePayload(values: CandidateFormValues): Partial<CandidateApiRecord> {
  return {
    name: values.name,
    jobID: values.jobID,
    email: values.email,
    contactDetails: values.contactDetails,
    location: values.location,
    skills: values.skills
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0),
    experience: Number(values.experience) || 0,
    education: values.education,
    noticePeriod: Number(values.noticePeriod) || 0,
    referal: values.referal || undefined,
    recruiter: values.recruiter || undefined,
    status: toBackendCandidateStatus(values.status),
    feedback: values.feedback || undefined,
  }
}

function normalizeInterviewStage(stage: string): string {
  const normalized = stage.trim().toLowerCase()
  if (normalized === 'technical intv 1') return 'Technical Interview 1'
  if (normalized === 'technical intv 2') return 'Technical Interview 2'
  if (normalized === 'technical intv 3') return 'Technical Interview 3'
  if (normalized === 'hr round') return 'HR Interview'
  return stage
}

export async function getCandidates(query: CandidateQueryParams = {}): Promise<CandidateRecord[]> {
  const trimmedSearch = query.search?.trim()
  const cacheKey = `candidates:list:${JSON.stringify(query)}`
  const cached = readCache<CandidateRecord[]>(cacheKey)
  if (cached) return cached

  let candidatesPayload: CandidateApiRecord[] = []

  if (!trimmedSearch) {
    const params = buildCandidateParams(query)
    const queryString = params.toString()
    const primaryPath = queryString ? `/candidates?${queryString}` : '/candidates'
    candidatesPayload = await requestCandidateCollection(primaryPath)
  } else {
    // Backend applies name/email as AND; run separate queries and merge.
    const isEmailSearch = trimmedSearch.includes('@')
    const queries = isEmailSearch
      ? [
          { ...query, name: undefined, email: trimmedSearch, role: undefined, search: undefined },
          { ...query, name: trimmedSearch, email: undefined, role: undefined, search: undefined },
        ]
      : [
          { ...query, name: trimmedSearch, email: undefined, role: undefined, search: undefined },
          { ...query, name: undefined, email: trimmedSearch, role: undefined, search: undefined },
          { ...query, name: undefined, email: undefined, role: trimmedSearch, search: undefined },
        ]

    const responses = await Promise.allSettled(
      queries.map(async (item) => {
        const params = buildCandidateParams(item)
        const queryString = params.toString()
        const primaryPath = queryString ? `/candidates?${queryString}` : '/candidates'
        return requestCandidateCollection(primaryPath)
      }),
    )
    const deduped = new Map<string, CandidateApiRecord>()
    responses
      .filter((result): result is PromiseFulfilledResult<CandidateApiRecord[]> => result.status === 'fulfilled')
      .flatMap((result) => result.value)
      .forEach((record) => {
      const key = record.id ?? record._id ?? `${record.email ?? ''}-${record.name ?? ''}`
      deduped.set(key, record)
    })
    candidatesPayload = Array.from(deduped.values())
  }

  const normalized = candidatesPayload.map(normalizeCandidate).filter((candidate) => candidate.id.length > 0)
  writeCache(cacheKey, normalized, CANDIDATE_LIST_CACHE_TTL_MS)
  return normalized
}

export async function getCandidateById(candidateId: string): Promise<CandidateRecord> {
  const cacheKey = `candidates:detail:${candidateId}`
  const cached = readCache<CandidateRecord>(cacheKey)
  if (cached) return cached

  const response = await apiRequest<CandidateApiRecord | { data?: CandidateApiRecord }>(`/candidate/${candidateId}`)
  const payload =
    typeof response === 'object' && response !== null && 'data' in response ? response.data : (response as CandidateApiRecord)
  if (!payload) throw new Error('Candidate not found')
  const normalized = normalizeCandidate(payload)
  writeCache(cacheKey, normalized, CANDIDATE_DETAIL_CACHE_TTL_MS)
  return normalized
}

export async function createCandidate(values: CandidateFormValues): Promise<CandidateRecord> {
  const response = await apiRequest<CandidateApiRecord>('/candidates', {
    method: 'POST',
    body: toCandidatePayload(values),
  })
  const normalized = normalizeCandidate(response)
  invalidateCache('candidates:')
  return normalized
}

export async function updateCandidate(candidateId: string, values: CandidateFormValues): Promise<CandidateRecord> {
  const response = await apiRequest<unknown>(`/candidate/${candidateId}`, {
    method: 'PUT',
    body: toCandidatePayload(values),
  })
  const payload = extractCandidatePayload(response)
  const normalized = payload ? normalizeCandidate(payload) : await getCandidateById(candidateId)
  invalidateCache('candidates:')
  return normalized
}

export async function updateCandidateStatus(candidateId: string, status: CandidateStatus): Promise<CandidateRecord> {
  const updatedBy = getCurrentUserId()
  try {
    const response = await apiRequest<unknown>(`/candidate/${candidateId}/status`, {
      method: 'PATCH',
      body: { status: toBackendCandidateStatus(status), ...(updatedBy ? { updatedBy } : {}) },
    })
    const payload = extractCandidatePayload(response)
    const normalized = payload ? normalizeCandidate(payload) : await getCandidateById(candidateId)
    invalidateCache('candidates:')
    return normalized
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    // Backend workaround: status may be persisted but save hook throws "next is not a function".
    if (message.toLowerCase().includes('next is not a function')) {
      const latest = await getCandidateById(candidateId)
      if (latest.status === status) {
        invalidateCache('candidates:')
        return latest
      }
    }
    throw error
  }
}

export async function addNoteToCandidate(candidateId: string, text: string): Promise<CandidateRecord> {
  const response = await apiRequest<unknown>(`/candidate/${candidateId}/note`, {
    method: 'POST',
    body: { text, note: text },
  })
  const payload = extractCandidatePayload(response)
  const normalized = payload ? normalizeCandidate(payload) : await getCandidateById(candidateId)
  invalidateCache('candidates:')
  return normalized
}

export async function getCandidateInterviews(candidateId: string): Promise<CandidateRecord> {
  const response = await apiRequest<unknown>(`/candidate/${candidateId}/interviews`)
  const payload = extractCandidatePayload(response)
  return payload ? normalizeCandidate(payload) : getCandidateById(candidateId)
}

export async function addInterviewToCandidate(candidateId: string, input: AddInterviewInput): Promise<CandidateRecord> {
  const createdBy = getCurrentUserId()
  const response = await apiRequest<unknown>(`/candidate/${candidateId}/interview`, {
    method: 'POST',
    body: {
      ...input,
      stage: normalizeInterviewStage(input.stage),
      ...(createdBy ? { createdBy } : {}),
    },
  })
  const payload = extractCandidatePayload(response)
  const normalized = payload ? normalizeCandidate(payload) : await getCandidateById(candidateId)
  invalidateCache('candidates:')
  return normalized
}

export async function updateInterviewForCandidate(
  candidateId: string,
  interviewId: string,
  input: UpdateInterviewInput,
): Promise<CandidateRecord> {
  const updatedBy = getCurrentUserId()
  const response = await apiRequest<unknown>(`/candidate/${candidateId}/interview/${interviewId}`, {
    method: 'PATCH',
    body: {
      ...input,
      ...(input.stage ? { stage: normalizeInterviewStage(input.stage) } : {}),
      ...(updatedBy ? { updatedBy } : {}),
    },
  })
  const payload = extractCandidatePayload(response)
  const normalized = payload ? normalizeCandidate(payload) : await getCandidateById(candidateId)
  invalidateCache('candidates:')
  return normalized
}

export async function getCandidateTimeline(candidateId: string): Promise<CandidateTimelineResponse> {
  const response = await apiRequest<CandidateTimelineResponse>(`/candidate/${candidateId}/timeline`)
  return response
}

export async function getInterviewAnalytics(jobId?: string): Promise<Array<Record<string, unknown>>> {
  const params = new URLSearchParams()
  if (jobId) params.set('jobId', jobId)
  const path = params.toString() ? `/analytics/interviews?${params.toString()}` : '/analytics/interviews'
  const response = await apiRequest<Array<Record<string, unknown>> | { data?: Array<Record<string, unknown>> }>(path)
  return Array.isArray(response) ? response : response.data ?? []
}

export async function uploadCandidateResume(candidateId: string, file: File): Promise<CandidateRecord> {
  const token = getAccessToken()
  const body = new FormData()
  body.append('resume', file)

  const response = await fetch(`${API_BASE_URL}/candidate/${candidateId}/upload-resume`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(raw || `Resume upload failed with status ${response.status}`)
  }

  const parsed = raw ? (JSON.parse(raw) as unknown) : undefined
  const payload = extractCandidatePayload(parsed)
  const normalized = payload ? normalizeCandidate(payload) : await getCandidateById(candidateId)
  invalidateCache('candidates:')
  return normalized
}
