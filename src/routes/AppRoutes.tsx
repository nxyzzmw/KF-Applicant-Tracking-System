import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthLayout from '../components/auth/AuthLayout'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/ToastProvider'
import type { HeaderAlertItem, HeaderAlertSummary } from '../components/layout/Header'
import Layout from '../components/layout/Layout'
import type { SidebarNavItem } from '../components/layout/Sidebar'
import { createJob, deleteJob, getJobById, getJobs, updateJob, updateJobStatus } from '../features/jobs/jobsAPI'
import type { JobsQueryParams } from '../features/jobs/jobsAPI'
import type { JobFormValues, JobRecord } from '../features/jobs/jobTypes'
import { getCandidates } from '../features/candidates/candidateAPI'
import AuthSuccessPage from '../pages/auth/AuthSuccessPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import { getRolePermissions, normalizeRole, type RolePermissions } from '../features/auth/roleAccess'
import { getRbacPolicy } from '../features/auth/rbacAPI'
import AddCandidatePage from '../pages/candidates/AddCandidatePage'
import CandidateDetailPage from '../pages/candidates/CandidateDetailPage'
import CandidateListPage from '../pages/candidates/CandidateListPage'
import InterviewQueuePage from '../pages/interviews/InterviewQueuePage'
import CreateJobPage from '../pages/jobs/CreateJobPage'
import EditJobPage from '../pages/jobs/EditJobPage'
import JobDetailsPage from '../pages/jobs/JobDetailsPage'
import JobListPage from '../pages/jobs/JobListPage'
import WeeklyReportPage from '../pages/reports/WeeklyReportPage'
import UserManagementPage from '../pages/users/UserManagementPage'
import { getUsers, type ManagedUser } from '../features/users/usersAdminAPI'
import { API_BASE_URL, apiRequest } from '../services/axiosInstance'
import { clearTokens, getAccessToken } from '../services/tokenService'
import { getErrorMessage } from '../utils/errorUtils'
import { toApiDateValue } from '../utils/dateUtils'
import appLogo from '../assets/kf-logo.png'
import './AppRoutes.css'

type JobView =
  | 'dashboard'
  | 'list'
  | 'create'
  | 'details'
  | 'edit'
  | 'candidate-list'
  | 'candidate-add'
  | 'candidate-details'
  | 'interviews'
  | 'reports'
  | 'users'
type AuthPage = 'login' | 'forgot' | 'success'

type AppRoutesProps = {
  onInitialDataReady?: () => void
}

type UserProfileResponse = {
  role?: string
  permissions?: Record<string, unknown>
  assignedPermissions?: Record<string, unknown>
  data?: {
    role?: string
    permissions?: Record<string, unknown>
    assignedPermissions?: Record<string, unknown>
    user?: {
      role?: string
      permissions?: Record<string, unknown>
      assignedPermissions?: Record<string, unknown>
    }
  }
  user?: {
    role?: string
    permissions?: Record<string, unknown>
    assignedPermissions?: Record<string, unknown>
  }
}

type AlertsResponse =
  | HeaderAlertItem[]
  | { data?: HeaderAlertItem[]; alerts?: HeaderAlertItem[] }
  | {
      success?: boolean
      data?: {
        uiAlerts?: {
          importantAndPriority?: Array<{
            id?: string
            title?: string
            message?: string
            section?: 'important' | 'general' | string
            category?: string
            timestamp?: string
            createdAt?: string
            timeAgo?: string
            severity?: string
            isRead?: boolean
            meta?: { type?: string } | null
          }>
          generalNotifications?: Array<{
            id?: string
            title?: string
            message?: string
            section?: 'important' | 'general' | string
            category?: string
            timestamp?: string
            createdAt?: string
            timeAgo?: string
            severity?: string
            isRead?: boolean
            meta?: { type?: string } | null
          }>
        }
        uiSummary?: {
          importantNewCount?: number
          generalNewCount?: number
          totalNewCount?: number
        }
        filters?: {
          endInDays?: number
          transitionDays?: number
          transitionLimit?: number
        }
        jobsClosingSoon?: Array<{
          _id?: string
          id?: string
          jobTitle?: string
          department?: string
          location?: string
          jobStatus?: string
          targetClosureDate?: string
          numberOfOpenings?: number
        }>
        candidateStageTransitions?: Array<{
          candidateId?: string
          candidateName?: string
          candidateEmail?: string
          fromStatus?: string | null
          toStatus?: string | null
          movedAt?: string
          updatedByName?: string | null
          updatedByEmail?: string | null
          job?: {
            id?: string
            jobTitle?: string | null
            department?: string | null
            location?: string | null
          } | null
        }>
        interviewsCompleted?: Array<{
          candidateId?: string
          candidateName?: string
          stage?: string | null
          result?: string | null
          completedAt?: string | null
          interviewer?: {
            name?: string | null
          } | null
        }>
      }
    }
  | null
  | undefined

const AUTH_ME_ENDPOINT = import.meta.env.VITE_AUTH_ME_ENDPOINT ?? ''
const AUTH_ME_ENDPOINTS = import.meta.env.VITE_AUTH_ME_ENDPOINTS?.trim() ?? ''
const ALERTS_ENDPOINT = import.meta.env.VITE_ALERTS_ENDPOINT?.trim() ?? '/api/dashboard/alerts'
const ALERTS_STREAM_ENDPOINT = import.meta.env.VITE_ALERTS_STREAM_ENDPOINT?.trim() ?? '/api/dashboard/alerts/stream'
const ALERTS_READ_ALL_ENDPOINT = import.meta.env.VITE_ALERTS_READ_ALL_ENDPOINT?.trim() ?? '/api/dashboard/alerts/read-all'
const ALERTS_READ_ONE_ENDPOINT_TEMPLATE =
  import.meta.env.VITE_ALERTS_READ_ONE_ENDPOINT_TEMPLATE?.trim() ?? '/api/dashboard/alerts/:alertId/read'
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH?.trim() ?? '/socket.io'
const ALERTS_POLL_INTERVAL_MS = (() => {
  const parsed = Number.parseInt(import.meta.env.VITE_ALERTS_POLL_INTERVAL_MS ?? '30000', 10)
  if (Number.isNaN(parsed)) return 30000
  return Math.min(Math.max(parsed, 5000), 300000)
})()

function parseBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return undefined
}

function mapBackendPermissionsToFrontend(input?: Record<string, unknown>): Partial<RolePermissions> | null {
  if (!input || typeof input !== 'object') return null
  const mapped: Partial<RolePermissions> = {}

  const readBool = (...keys: string[]): boolean | undefined => {
    for (const key of keys) {
      const parsed = parseBooleanLike(input[key])
      if (typeof parsed === 'boolean') return parsed
    }
    return undefined
  }

  const canViewDashboard = readBool('viewDashboard', 'canViewDashboard')
  const canViewJobs = readBool('viewJobs', 'canViewJobs')
  const canCreateJob = readBool('createJobs', 'canCreateJob')
  const canEditJob = readBool('editJobs', 'canEditJob')
  const canDeleteJob = readBool('deleteJobs', 'canDeleteJob')
  const canViewCandidates = readBool('viewCandidates', 'canViewCandidates')
  const canCreateCandidate = readBool('addCandidates', 'canCreateCandidate')
  const canEditCandidate = readBool('editCandidates', 'canEditCandidate')
  const canManageCandidateStage = readBool('manageCandidateStages', 'canManageCandidateStage')
  const canManageUsers = readBool('manageUsers', 'canManageUsers')

  if (typeof canViewDashboard === 'boolean') mapped.canViewDashboard = canViewDashboard
  if (typeof canViewJobs === 'boolean') mapped.canViewJobs = canViewJobs
  if (typeof canCreateJob === 'boolean') mapped.canCreateJob = canCreateJob
  if (typeof canEditJob === 'boolean') mapped.canEditJob = canEditJob
  if (typeof canDeleteJob === 'boolean') mapped.canDeleteJob = canDeleteJob
  if (typeof canViewCandidates === 'boolean') mapped.canViewCandidates = canViewCandidates
  if (typeof canCreateCandidate === 'boolean') mapped.canCreateCandidate = canCreateCandidate
  if (typeof canEditCandidate === 'boolean') mapped.canEditCandidate = canEditCandidate
  if (typeof canManageCandidateStage === 'boolean') mapped.canManageCandidateStage = canManageCandidateStage
  if (typeof canManageUsers === 'boolean') mapped.canManageUsers = canManageUsers

  return Object.keys(mapped).length > 0 ? mapped : null
}

function extractPermissionOverrides(profile: UserProfileResponse): Partial<RolePermissions> | null {
  const candidates: Array<Record<string, unknown> | undefined> = [
    profile.assignedPermissions,
    profile.user?.assignedPermissions,
    profile.data?.assignedPermissions,
    profile.data?.user?.assignedPermissions,
    profile.permissions,
    profile.user?.permissions,
    profile.data?.permissions,
    profile.data?.user?.permissions,
  ]
  for (const candidate of candidates) {
    const mapped = mapBackendPermissionsToFrontend(candidate)
    if (mapped) return mapped
  }
  return null
}

type RouteState = {
  view: JobView
  jobId?: string | null
  candidateId?: string | null
  candidateJobId?: string | null
}

function getInitialAuthPage(): AuthPage {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
  return normalizedPath === '/reset-password' ? 'forgot' : 'login'
}

function parseRouteState(): RouteState {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(window.location.search)
  const jobId = params.get('jobId')
  const candidateId = params.get('candidateId')
  const candidateJobId = params.get('candidateJobId') ?? params.get('jobId')

  if (normalizedPath === '/dashboard' || normalizedPath === '/') return { view: 'dashboard' }
  if (normalizedPath === '/jobs') return { view: 'list' }
  if (normalizedPath === '/jobs/create') return { view: 'create' }
  if (normalizedPath === '/jobs/details') return { view: 'details', jobId }
  if (normalizedPath === '/jobs/edit') return { view: 'edit', jobId }
  if (normalizedPath === '/candidates') return { view: 'candidate-list', candidateJobId }
  if (normalizedPath === '/candidates/add') return { view: 'candidate-add', candidateJobId }
  if (normalizedPath === '/candidates/details') return { view: 'candidate-details', candidateId }
  if (normalizedPath === '/interviews') return { view: 'interviews' }
  if (normalizedPath === '/reports') return { view: 'reports' }
  if (normalizedPath === '/users') return { view: 'users' }
  return { view: 'dashboard' }
}

function buildRoutePath(state: RouteState): string {
  const params = new URLSearchParams()
  if (state.view === 'details' || state.view === 'edit') {
    if (state.jobId) params.set('jobId', state.jobId)
  }
  if (state.view === 'candidate-list' || state.view === 'candidate-add') {
    if (state.candidateJobId) params.set('candidateJobId', state.candidateJobId)
  }
  if (state.view === 'candidate-details') {
    if (state.candidateId) params.set('candidateId', state.candidateId)
  }
  const query = params.toString()

  let pathname = '/dashboard'
  if (state.view === 'list') pathname = '/jobs'
  if (state.view === 'create') pathname = '/jobs/create'
  if (state.view === 'details') pathname = '/jobs/details'
  if (state.view === 'edit') pathname = '/jobs/edit'
  if (state.view === 'candidate-list') pathname = '/candidates'
  if (state.view === 'candidate-add') pathname = '/candidates/add'
  if (state.view === 'candidate-details') pathname = '/candidates/details'
  if (state.view === 'interviews') pathname = '/interviews'
  if (state.view === 'reports') pathname = '/reports'
  if (state.view === 'users') pathname = '/users'

  return query.length > 0 ? `${pathname}?${query}` : pathname
}

function mapAlertsPayloadToItems(response: AlertsResponse): HeaderAlertItem[] {
  if (!response) return []

  const normalizeTimestamp = (item: { createdAt?: string; timestamp?: string }): string =>
    item.createdAt || item.timestamp || new Date().toISOString()

  const normalizeLabel = (value?: string): string | undefined => {
    if (!value || typeof value !== 'string') return undefined
    const cleaned = value.trim()
    return cleaned.length > 0 ? cleaned : undefined
  }

  const toTitleCase = (value?: string | null): string => {
    const text = (value || '').trim()
    if (!text) return 'Unknown'
    return text
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }

  const buildFriendlyTransitionMessage = (message?: string): string => {
    if (!message) return 'Candidate stage was updated.'
    const arrowMatch = message.match(/:\s*(.*?)\s*->\s*(.*?)\./)
    if (!arrowMatch) return message
    const fromStatus = toTitleCase(arrowMatch[1])
    const toStatus = toTitleCase(arrowMatch[2])
    return `Moved from ${fromStatus} to ${toStatus}.`
  }

  const getFriendlyCopy = (alert: {
    title?: string
    message?: string
    section?: string
    severity?: string
    category?: string
    meta?: { type?: string } | null
  }): { title: string; message: string } => {
    const sourceTitle = alert.title?.trim() || 'Alert'
    const sourceMessage = alert.message?.trim() || 'No details provided.'
    const type = alert.meta?.type
    const lowerTitle = sourceTitle.toLowerCase()

    if (type === 'job_closing_soon' || lowerTitle.includes('job posting expiring')) {
      return { title: 'Job Posting Expiring', message: sourceMessage.replace(/\s+/g, ' ') }
    }
    if (type === 'job_aging' || lowerTitle.includes('job aging')) {
      return { title: 'Job Aging Alert', message: sourceMessage.replace(/\s+/g, ' ') }
    }
    if (type === 'interview_conflict' || lowerTitle.includes('interview conflict')) {
      return { title: 'Interview Conflict Detected', message: sourceMessage.replace(/\s+/g, ' ') }
    }
    if (type === 'interview_completed' || lowerTitle.includes('interview completed')) {
      return { title: 'Interview Completed', message: sourceMessage.replace(/\s+/g, ' ') }
    }
    if (type === 'candidate_stage_transition' || lowerTitle.includes('stage')) {
      return { title: 'Candidate Stage Updated', message: buildFriendlyTransitionMessage(sourceMessage) }
    }
    if (type === 'new_applicant' || lowerTitle.includes('new applicant')) {
      return { title: 'New Applicant', message: sourceMessage.replace(/\s+/g, ' ') }
    }
    if (type === 'report_generated' || lowerTitle.includes('report generated')) {
      return { title: 'Report Generated', message: sourceMessage.replace(/\s+/g, ' ') }
    }
    return { title: sourceTitle, message: sourceMessage }
  }

  const normalizeCategory = (
    input: { category?: string; section?: string; severity?: string },
    fallback: 'important' | 'general' = 'general',
  ): 'important' | 'general' => {
    if (input.category === 'important' || input.category === 'general') return input.category
    if (input.section === 'important' || input.section === 'general') return input.section
    if (input.severity === 'high') return 'important'
    return fallback
  }

  const toDateKey = (value?: string): string => {
    if (!value) return 'na'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return 'na'
    return d.toISOString().slice(0, 10)
  }

  const toSemanticKey = (alert: HeaderAlertItem): string => {
    const meta = (alert.meta ?? {}) as Record<string, unknown>
    const type = String(meta.type ?? '')
    const jobId = String(meta.jobId ?? '')
    const candidateId = String(meta.candidateId ?? '')
    const interviewerId = String(meta.interviewerId ?? '')
    const day = toDateKey(alert.createdAt)
    if (type || jobId || candidateId || interviewerId) {
      return [type || 'na', jobId || 'na', candidateId || 'na', interviewerId || 'na', day].join('|')
    }
    return alert.id
  }

  if (Array.isArray(response)) {
    return response.map((alert, index) => ({
      id: alert.id || `alert-${index}`,
      title: alert.title || 'Alert',
      message: alert.message || 'No details provided.',
      createdAt: normalizeTimestamp(alert),
      read: Boolean(alert.read),
      section: (alert as { section?: 'important' | 'general' }).section,
      severity: (alert as { severity?: 'high' | 'medium' | 'low' }).severity,
      isRead: (alert as { isRead?: boolean }).isRead,
      meta: (alert as { meta?: Record<string, unknown> }).meta,
      category: alert.category,
      label: normalizeLabel(alert.label),
      timeAgo: normalizeLabel(alert.timeAgo),
    }))
  }

  const wrappedResponse = response as { data?: HeaderAlertItem[]; alerts?: HeaderAlertItem[] }
  const wrappedList = wrappedResponse.data ?? wrappedResponse.alerts
  if (Array.isArray(wrappedList)) {
    return wrappedList.map((alert, index) => ({
      id: alert.id || `alert-${index}`,
      title: alert.title || 'Alert',
      message: alert.message || 'No details provided.',
      createdAt: normalizeTimestamp(alert),
      read: Boolean(alert.read),
      section: (alert as { section?: 'important' | 'general' }).section,
      severity: (alert as { severity?: 'high' | 'medium' | 'low' }).severity,
      isRead: (alert as { isRead?: boolean }).isRead,
      meta: (alert as { meta?: Record<string, unknown> }).meta,
      category: alert.category,
      label: normalizeLabel(alert.label),
      timeAgo: normalizeLabel(alert.timeAgo),
    }))
  }

  const backendPayload = response as {
    data?: {
      uiAlerts?: {
        importantAndPriority?: Array<{
          id?: string
          title?: string
          message?: string
          section?: string
          category?: string
          timestamp?: string
          createdAt?: string
          timeAgo?: string
          severity?: string
          isRead?: boolean
          meta?: { type?: string } | null
        }>
        generalNotifications?: Array<{
          id?: string
          title?: string
          message?: string
          section?: string
          category?: string
          timestamp?: string
          createdAt?: string
          timeAgo?: string
          severity?: string
          isRead?: boolean
          meta?: { type?: string } | null
        }>
      }
      jobsClosingSoon?: Array<{
        _id?: string
        id?: string
        jobTitle?: string
        department?: string
        location?: string
        jobStatus?: string
        targetClosureDate?: string
        numberOfOpenings?: number
      }>
      candidateStageTransitions?: Array<{
        candidateId?: string
        candidateName?: string
        candidateEmail?: string
        fromStatus?: string | null
        toStatus?: string | null
        movedAt?: string
        updatedByName?: string | null
        updatedByEmail?: string | null
        job?: {
          id?: string
          jobTitle?: string | null
          department?: string | null
          location?: string | null
        } | null
      }>
      interviewsCompleted?: Array<{
        candidateId?: string
        candidateName?: string
        stage?: string | null
        result?: string | null
        completedAt?: string | null
        interviewer?: {
          name?: string | null
        } | null
      }>
    }
  }

  const importantFromUi = backendPayload.data?.uiAlerts?.importantAndPriority ?? []
  const generalFromUi = backendPayload.data?.uiAlerts?.generalNotifications ?? []
  const uiAlerts = [...importantFromUi, ...generalFromUi]
    .map((alert, index) => {
      const friendly = getFriendlyCopy(alert)
      const section: 'important' | 'general' = alert.section === 'important' ? 'important' : 'general'
      const severity: 'high' | 'medium' | 'low' =
        alert.severity === 'high' || alert.severity === 'medium' || alert.severity === 'low' ? alert.severity : 'low'
      return {
        id: alert.id || `ui-alert-${index}`,
        title: friendly.title,
        message: friendly.message,
        createdAt: normalizeTimestamp(alert),
        read: alert.isRead ?? false,
        section,
        severity,
        isRead: alert.isRead ?? false,
        meta: alert.meta ?? {},
        category: normalizeCategory(alert, alert.section === 'important' ? 'important' : 'general'),
        label: normalizeLabel(alert.category),
        timeAgo: normalizeLabel(alert.timeAgo),
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const jobsClosingSoon = backendPayload.data?.jobsClosingSoon ?? []
  const candidateStageTransitions = backendPayload.data?.candidateStageTransitions ?? []
  const interviewsCompleted = backendPayload.data?.interviewsCompleted ?? []

  const jobAlerts: HeaderAlertItem[] = jobsClosingSoon.map((job, index) => {
    const closureDate = job.targetClosureDate ? new Date(job.targetClosureDate).toLocaleDateString() : 'N/A'
    const openings = typeof job.numberOfOpenings === 'number' ? job.numberOfOpenings : 'N/A'
    return {
      id: `job-close-${job._id ?? job.id ?? index}`,
      title: `Job Closing Soon: ${job.jobTitle ?? 'Untitled Job'}`,
      message: `${job.department ?? 'Unknown department'} • ${job.location ?? 'Unknown location'} • Status: ${job.jobStatus ?? 'Unknown'} • Closes: ${closureDate} • Openings: ${openings}`,
      createdAt: job.targetClosureDate || new Date().toISOString(),
      read: false,
      category: 'important',
      label: 'Jobs',
      meta: {
        type: 'job_closing_soon',
        jobId: job._id ?? job.id ?? null,
      },
    }
  })

  const transitionAlerts: HeaderAlertItem[] = candidateStageTransitions.map((transition, index) => {
    const actor = transition.updatedByName || transition.updatedByEmail || 'System'
    const fromStatus = transition.fromStatus || 'Unknown'
    const toStatus = transition.toStatus || 'Unknown'
    const candidateName = transition.candidateName || transition.candidateEmail || 'Candidate'
    const jobTitle = transition.job?.jobTitle || 'Unknown job'
    return {
      id: `candidate-transition-${transition.candidateId ?? index}-${transition.movedAt ?? index}`,
      title: `Stage Transition: ${candidateName}`,
      message: `${fromStatus} → ${toStatus} on ${jobTitle} (updated by ${actor})`,
      createdAt: transition.movedAt || new Date().toISOString(),
      read: false,
      category: 'general',
      label: 'Candidates',
      meta: {
        type: 'candidate_stage_transition',
        candidateId: transition.candidateId ?? null,
        jobId: transition.job?.id ?? null,
      },
    }
  })

  const interviewAlerts: HeaderAlertItem[] = interviewsCompleted.map((interview, index) => {
    const candidateName = interview.candidateName || 'Candidate'
    const stage = interview.stage || 'Interview'
    const result = interview.result || 'Completed'
    const interviewer = interview.interviewer?.name || 'Interviewer'
    return {
      id: `interview-completed-${interview.candidateId ?? index}-${interview.completedAt ?? index}`,
      title: `Interview Completed: ${candidateName}`,
      message: `${stage} by ${interviewer} • Result: ${result}`,
      createdAt: interview.completedAt || new Date().toISOString(),
      read: false,
      category: result.toLowerCase() === 'failed' ? 'important' : 'general',
      label: 'Candidates',
      meta: {
        type: 'interview_completed',
        candidateId: interview.candidateId ?? null,
      },
    }
  })

  const mergedById = new Map<string, HeaderAlertItem>()
  const mergedBySemantic = new Map<string, string>()
  ;[...jobAlerts, ...interviewAlerts, ...transitionAlerts, ...uiAlerts].forEach((item) => {
    const semanticKey = toSemanticKey(item)
    const existingId = mergedBySemantic.get(semanticKey)
    if (!existingId) {
      mergedById.set(item.id, item)
      mergedBySemantic.set(semanticKey, item.id)
      return
    }
    const existing = mergedById.get(existingId)
    if (!existing) {
      mergedById.set(item.id, item)
      mergedBySemantic.set(semanticKey, item.id)
      return
    }
    const preferredId = item.isRead !== undefined || item.meta?.type ? item.id : existing.id
    const merged = { ...existing, ...item, id: preferredId }
    mergedById.delete(existingId)
    mergedById.set(preferredId, merged)
    mergedBySemantic.set(semanticKey, preferredId)
  })

  return Array.from(mergedById.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function extractAlertsSummary(response: AlertsResponse): HeaderAlertSummary | null {
  if (!response || Array.isArray(response)) return null
  const payload = response as {
    data?: {
      uiSummary?: {
        importantNewCount?: number
        generalNewCount?: number
        totalNewCount?: number
      }
    }
  }
  const summary = payload.data?.uiSummary
  if (!summary) return null
  const importantNewCount = Number(summary.importantNewCount ?? 0)
  const generalNewCount = Number(summary.generalNewCount ?? 0)
  const totalNewCount = Number(summary.totalNewCount ?? importantNewCount + generalNewCount)
  return {
    importantNewCount: Number.isFinite(importantNewCount) ? importantNewCount : 0,
    generalNewCount: Number.isFinite(generalNewCount) ? generalNewCount : 0,
    totalNewCount: Number.isFinite(totalNewCount) ? totalNewCount : 0,
  }
}

function randomToken(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  }
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function generateUniqueReqId(existingReqIds: Set<string>): string {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')

  while (true) {
    const candidate = `REQ-${yyyy}${mm}${dd}-${hh}${min}${ss}${ms}-${randomToken(6)}`
    if (!existingReqIds.has(candidate.toUpperCase())) return candidate
  }
}

function toApiPayload(values: JobFormValues, reqId?: string) {
  const salaryMin = Number(values.salaryMin) || 0
  const salaryMax = Number(values.salaryMax) || 0
  const salaryRange = salaryMin >= 7 && salaryMax === salaryMin ? `${salaryMin}+` : `${salaryMin}-${salaryMax}`
  const skillsRequired = values.skills
    .split(',')
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0)

  return {
    jobTitle: values.title,
    department: values.department,
    location: values.location,
    emplyementType: values.employmentType,
    experienceLevel: values.experienceLevel,
    salaryRange,
    hiringManager: values.hiringManager,
    numberOfOpenings: Number(values.openings) || 1,
    targetClosureDate: toApiDateValue(values.targetClosureDate),
    description: values.description,
    skillsRequired,
    ...(reqId ? { reqId, requisitionId: reqId } : {}),
  }
}

function isJobExpired(targetClosureDate?: string): boolean {
  if (!targetClosureDate) return false
  const target = new Date(targetClosureDate)
  if (Number.isNaN(target.getTime())) return false
  const today = new Date()
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return targetDay < todayDay
}

function formatFriendlyDate(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mergeAlertById(existing: HeaderAlertItem[], incoming: HeaderAlertItem): HeaderAlertItem[] {
  const idx = existing.findIndex((item) => item.id === incoming.id)
  if (idx >= 0) {
    const next = [...existing]
    next[idx] = { ...next[idx], ...incoming }
    return next
  }
  return [incoming, ...existing]
}

function sortAlertsNewestFirst(items: HeaderAlertItem[]): HeaderAlertItem[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

async function loadSocketIoClientScript(path = SOCKET_PATH): Promise<void> {
  if (typeof window === 'undefined') return
  const w = window as Window & { io?: unknown }
  if (typeof w.io === 'function') return
  const scriptId = 'ats-socket-io-client-script'
  if (document.getElementById(scriptId)) {
    return new Promise((resolve, reject) => {
      const waitForIo = () => {
        if (typeof w.io === 'function') {
          resolve()
          return
        }
        window.setTimeout(waitForIo, 100)
      }
      window.setTimeout(() => {
        if (typeof w.io !== 'function') reject(new Error('Socket.IO client not available'))
      }, 5000)
      waitForIo()
    })
  }

  const normalizedBase = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/i, '')
  const scriptSrc = `${normalizedBase}${path}/socket.io.js`
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = scriptId
    script.src = scriptSrc
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Unable to load socket.io client script from ${scriptSrc}`))
    document.head.appendChild(script)
  })
}

function AppRoutes({ onInitialDataReady }: AppRoutesProps) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAccessToken()))
  const [authPage, setAuthPage] = useState<AuthPage>(getInitialAuthPage)

  const [view, setView] = useState<JobView>('dashboard')
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [selectedCandidateJobId, setSelectedCandidateJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [sidebarRole, setSidebarRole] = useState<string>('HR Recruiter')
  const [jobListSearchTerm, setJobListSearchTerm] = useState('')
  const [jobListSortDirection, setJobListSortDirection] = useState<'asc' | 'desc'>('asc')
  const [jobListDepartmentFilter, setJobListDepartmentFilter] = useState('all')
  const [jobListStatusFilter, setJobListStatusFilter] = useState<'all' | JobRecord['status']>('all')
  const [candidateListSearchTerm, setCandidateListSearchTerm] = useState('')
  const [candidateListSortDirection, setCandidateListSortDirection] = useState<'asc' | 'desc'>('asc')
  const [userListSearchTerm, setUserListSearchTerm] = useState('')
  const [powerSearchUsers, setPowerSearchUsers] = useState<ManagedUser[]>([])
  const [globalSearchValue, setGlobalSearchValue] = useState('')
  const [alerts, setAlerts] = useState<HeaderAlertItem[]>([])
  const [alertsSummary, setAlertsSummary] = useState<HeaderAlertSummary | null>(null)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [alertPermission, setAlertPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [rbacVersion, setRbacVersion] = useState(0)
  const [permissionOverrides, setPermissionOverrides] = useState<Partial<RolePermissions> | null>(null)

  const hasReportedInitialLoadRef = useRef(false)
  const loadJobsRequestIdRef = useRef(0)
  const autoStatusSyncRef = useRef(false)
  const fallbackAlertsRef = useRef<HeaderAlertItem[]>([])
  const socketRef = useRef<{ disconnect?: () => void; close?: () => void } | null>(null)
  const socketRetryTimerRef = useRef<number | null>(null)
  const socketRetryAttemptRef = useRef(0)
  const [socketRetryNonce, setSocketRetryNonce] = useState(0)
  const sseRetryTimerRef = useRef<number | null>(null)
  const sseRetryAttemptRef = useRef(0)
  const [sseRetryNonce, setSseRetryNonce] = useState(0)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [isSseConnected, setIsSseConnected] = useState(false)
  const normalizedRole = normalizeRole(sidebarRole)
  const permissions = useMemo(
    () => ({ ...getRolePermissions(normalizedRole), ...(permissionOverrides ?? {}) }),
    [normalizedRole, permissionOverrides, rbacVersion],
  )

  useEffect(() => {
    if (isAuthenticated) return
    if (hasReportedInitialLoadRef.current) return
    onInitialDataReady?.()
    hasReportedInitialLoadRef.current = true
  }, [isAuthenticated, onInitialDataReady])

  useEffect(() => {
    if (!isAuthenticated) return
    void getRbacPolicy()
      .then(() => setRbacVersion((prev) => prev + 1))
      .catch(() => {
        // keep local fallback policy if RBAC endpoint is unavailable
      })
  }, [isAuthenticated])

  const resetContext = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      token: params.get('token') || '',
      email: params.get('email') || '',
    }
  }, [])

  const goToLogin = useCallback(() => {
    setAuthPage('login')
    window.history.replaceState({}, '', '/')
  }, [])

  const navigateTo = useCallback(
    (
      nextView: JobView,
      options?: {
        replace?: boolean
        jobId?: string | null
        candidateId?: string | null
        candidateJobId?: string | null
      },
    ) => {
      setActionError(null)
      if (options?.jobId !== undefined) setSelectedJobId(options.jobId)
      if (options?.candidateId !== undefined) setSelectedCandidateId(options.candidateId)
      if (options?.candidateJobId !== undefined) setSelectedCandidateJobId(options.candidateJobId)
      setView(nextView)
      const path = buildRoutePath({
        view: nextView,
        jobId: options?.jobId !== undefined ? options.jobId : selectedJobId,
        candidateId: options?.candidateId !== undefined ? options.candidateId : selectedCandidateId,
        candidateJobId: options?.candidateJobId !== undefined ? options.candidateJobId : selectedCandidateJobId,
      })
      window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', path)
    },
    [selectedCandidateId, selectedCandidateJobId, selectedJobId],
  )

  const navigateBack = useCallback(
    (
      fallbackView: JobView,
      fallbackOptions?: {
        jobId?: string | null
        candidateId?: string | null
        candidateJobId?: string | null
      },
    ) => {
      const before = `${window.location.pathname}${window.location.search}`
      window.history.back()
      window.setTimeout(() => {
        const after = `${window.location.pathname}${window.location.search}`
        if (after === before) {
          navigateTo(fallbackView, { ...fallbackOptions, replace: true })
        }
      }, 120)
    },
    [navigateTo],
  )

  const syncFromLocation = useCallback(() => {
    const parsed = parseRouteState()
    setView(parsed.view)
    setSelectedJobId(parsed.jobId ?? null)
    setSelectedCandidateId(parsed.candidateId ?? null)
    setSelectedCandidateJobId(parsed.candidateJobId ?? null)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    syncFromLocation()
  }, [isAuthenticated, syncFromLocation])

  useEffect(() => {
    if (!isAuthenticated) return
    const handler = () => syncFromLocation()
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [isAuthenticated, syncFromLocation])

  const loadJobs = useCallback(
    async (query: JobsQueryParams = {}) => {
      const requestId = loadJobsRequestIdRef.current + 1
      loadJobsRequestIdRef.current = requestId
      setLoading(true)
      setListError(null)
      try {
        const [jobResult, candidateResult] = await Promise.allSettled([getJobs(query), getCandidates()])
        if (jobResult.status !== 'fulfilled') {
          throw jobResult.reason
        }
        const result = jobResult.value
        const candidates = candidateResult.status === 'fulfilled' ? candidateResult.value : []
        const metricsByJob = candidates.reduce<Record<string, { applied: number; joined: number }>>((acc, candidate) => {
          if (!candidate.jobID) return acc
          const current = acc[candidate.jobID] ?? { applied: 0, joined: 0 }
          current.applied += 1
          if (candidate.status === 'Joined') current.joined += 1
          acc[candidate.jobID] = current
          return acc
        }, {})
        const mergedResult = result.map((job) => {
          const metrics = metricsByJob[job.id]
          if (!metrics) return job
          const joined = Math.min(metrics.joined, job.openings || metrics.joined)
          return {
            ...job,
            filled: joined,
            candidatesApplied: metrics.applied,
          }
        })
        if (loadJobsRequestIdRef.current === requestId) {
          setJobs(mergedResult)
        }
      } catch (loadError) {
        const message = getErrorMessage(loadError, 'Unable to load jobs')
        if (loadJobsRequestIdRef.current === requestId) {
          setListError(message)
        }
      } finally {
        if (loadJobsRequestIdRef.current === requestId) {
          setLoading(false)
          if (!hasReportedInitialLoadRef.current) {
            onInitialDataReady?.()
            hasReportedInitialLoadRef.current = true
          }
        }
      }
    },
    [onInitialDataReady],
  )

  const activeListQuery = useMemo<JobsQueryParams>(
    () => ({
      department: jobListDepartmentFilter === 'all' ? undefined : jobListDepartmentFilter,
      status: jobListStatusFilter === 'all' ? undefined : jobListStatusFilter,
    }),
    [jobListDepartmentFilter, jobListStatusFilter],
  )

  const showHeaderSearchControls = true

  const handlePowerSearchSubmit = useCallback(
    (rawValue: string) => {
      const value = rawValue.trim()
      if (!value) return
      const query = value.toLowerCase()
      setGlobalSearchValue('')
      const withoutKeywords = (text: string, keywords: string[]): string => {
        const escaped = keywords.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        const pattern = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi')
        return text
          .replace(pattern, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      if (query.includes('dashboard')) {
        navigateTo('dashboard', { jobId: null, candidateId: null, candidateJobId: null })
        return
      }
      if ((query.includes('job') || query.includes('requisition')) && permissions.canViewJobs) {
        setJobListSearchTerm(withoutKeywords(value, ['job', 'jobs', 'requisition', 'requisitions']))
        navigateTo('list', { jobId: null })
        return
      }
      if ((query.includes('candidate') || query.includes('applicant')) && permissions.canViewCandidates) {
        setCandidateListSearchTerm(withoutKeywords(value, ['candidate', 'candidates', 'applicant', 'applicants']))
        navigateTo('candidate-list', { candidateJobId: null, candidateId: null })
        return
      }
      if (query.includes('interview') && permissions.canViewCandidates) {
        navigateTo('interviews')
        return
      }
      if ((query.includes('user') || query.includes('admin') || query.includes('role')) && permissions.canManageUsers) {
        setUserListSearchTerm(withoutKeywords(value, ['user', 'users', 'admin', 'admins', 'role', 'roles']))
        navigateTo('users')
        return
      }

      const matchedJob = jobs.find((job) =>
        `${job.title}`.toLowerCase().includes(query),
      )
      if (matchedJob && permissions.canViewJobs) {
        setJobListSearchTerm(value)
        navigateTo('list', { jobId: null })
        return
      }

      const matchedUser = powerSearchUsers.find((user) =>
        `${user.firstName} ${user.lastName}`.trim().toLowerCase().includes(query),
      )
      if (matchedUser && permissions.canManageUsers) {
        setUserListSearchTerm(value)
        navigateTo('users')
        return
      }

      if (permissions.canViewCandidates) {
        setCandidateListSearchTerm(value)
        navigateTo('candidate-list', { candidateJobId: null, candidateId: null })
        return
      }

      if (permissions.canManageUsers) {
        setUserListSearchTerm(value)
        navigateTo('users')
      }
    },
    [jobs, navigateTo, permissions.canManageUsers, permissions.canViewCandidates, permissions.canViewJobs, powerSearchUsers],
  )

  useEffect(() => {
    if (!isAuthenticated || !permissions.canManageUsers) {
      setPowerSearchUsers([])
      return
    }
    void getUsers()
      .then((users) => setPowerSearchUsers(users))
      .catch(() => setPowerSearchUsers([]))
  }, [isAuthenticated, permissions.canManageUsers])

  useEffect(() => {
    if (!isAuthenticated) return
    if (!permissions.canEditJob) return
    if (autoStatusSyncRef.current) return

    const toSync = jobs
      .map((job) => {
        const isExpired = isJobExpired(job.targetClosureDate)
        const isFull = job.openings > 0 && job.filled >= job.openings
        if (isExpired && job.status !== 'Closed') return { jobId: job.id, nextStatus: 'Closed' as JobRecord['status'] }
        if (isFull && job.status !== 'Filled') return { jobId: job.id, nextStatus: 'Filled' as JobRecord['status'] }
        return null
      })
      .filter((item): item is { jobId: string; nextStatus: JobRecord['status'] } => Boolean(item))

    if (toSync.length === 0) return

    autoStatusSyncRef.current = true
    setJobs((prev) =>
      prev.map((job) => {
        const target = toSync.find((item) => item.jobId === job.id)
        return target ? { ...job, status: target.nextStatus } : job
      }),
    )

    void Promise.allSettled(toSync.map((item) => updateJobStatus(item.jobId, item.nextStatus)))
      .then(() => loadJobs(view === 'list' ? activeListQuery : {}))
      .finally(() => {
        autoStatusSyncRef.current = false
      })
  }, [activeListQuery, isAuthenticated, jobs, loadJobs, permissions.canEditJob, view])

  useEffect(() => {
    if (!isAuthenticated) return

    if (!permissions.canViewJobs) {
      setLoading(false)
      setListError(null)
      setJobs([])
      return
    }

    if (view === 'dashboard' || view === 'reports' || view.startsWith('candidate')) {
      void loadJobs()
      return
    }
    if (view !== 'list') return

    const timer = window.setTimeout(() => {
      void loadJobs(activeListQuery)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [isAuthenticated, view, activeListQuery, loadJobs, permissions.canViewJobs])

  const fallbackAlerts = useMemo<HeaderAlertItem[]>(() => {
    const nowIso = new Date().toISOString()
    return jobs
      .filter((job) => job.status === 'Open' || job.status === 'On Hold')
      .map((job) => {
        const title = `${job.title} (${job.reqId})`
        const closureDateLabel = formatFriendlyDate(job.targetClosureDate)
        return {
          id: `job-${job.id}`,
          title: 'Job Posting Expiring',
          message: closureDateLabel
            ? `${title} closes on ${closureDateLabel}.`
            : `${title} has no target closure date set.`,
          createdAt: nowIso,
          read: false,
          category: 'important' as const,
          label: 'Jobs',
        }
      })
      .slice(0, 20)
  }, [jobs])

  useEffect(() => {
    fallbackAlertsRef.current = fallbackAlerts
  }, [fallbackAlerts])

  const loadAlerts = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
    if (!silent) {
      setAlertsLoading(true)
    }
    setAlertsError(null)
    if (!ALERTS_ENDPOINT) {
      setAlerts(fallbackAlertsRef.current)
      setAlertsSummary({
        importantNewCount: fallbackAlertsRef.current.length,
        generalNewCount: 0,
        totalNewCount: fallbackAlertsRef.current.length,
      })
      if (!silent) setAlertsLoading(false)
      return
    }
    try {
      const response = await apiRequest<AlertsResponse>(ALERTS_ENDPOINT)
      const normalized = mapAlertsPayloadToItems(response)
      const summary = extractAlertsSummary(response)
      setAlerts((prev) => {
        const prevIds = prev.map((item) => item.id).join('|')
        const nextIds = normalized.map((item) => item.id).join('|')
        if (prevIds === nextIds && prev.length === normalized.length) return prev
        return sortAlertsNewestFirst(normalized)
      })
      setAlertsSummary(summary)
    } catch {
      setAlerts(fallbackAlertsRef.current)
      setAlertsSummary({
        importantNewCount: fallbackAlertsRef.current.length,
        generalNewCount: 0,
        totalNewCount: fallbackAlertsRef.current.length,
      })
      setAlertsError('Alerts API unavailable. Showing fallback alerts.')
    } finally {
      if (!silent) setAlertsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    void loadAlerts()
  }, [isAuthenticated, loadAlerts])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = getAccessToken()
    if (!token) return
    let isCancelled = false

    async function connectSocket() {
      try {
        await loadSocketIoClientScript()
        const io = (window as Window & { io?: (...args: unknown[]) => unknown }).io
        if (typeof io !== 'function') throw new Error('Socket.IO client unavailable')

        const baseOrigin = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/i, '')
        const socket = io(baseOrigin || undefined, {
          path: SOCKET_PATH,
          auth: { token },
          query: { token },
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: false,
        }) as {
          on: (event: string, cb: (...args: unknown[]) => void) => void
          disconnect?: () => void
          close?: () => void
        }

        if (isCancelled) {
          socket.disconnect?.()
          return
        }

        socketRef.current = socket
        socket.on('connect', () => {
          if (isCancelled) return
          setIsSocketConnected(true)
          socketRetryAttemptRef.current = 0
        })
        socket.on('alerts:connected', () => {
          if (isCancelled) return
          setIsSocketConnected(true)
          void loadAlerts({ silent: true })
        })
        socket.on('alerts:new', (payload: unknown) => {
          if (isCancelled) return
          const event = payload as {
            id?: string
            section?: 'important' | 'general'
            category?: string
            severity?: 'high' | 'medium' | 'low'
            title?: string
            message?: string
            timestamp?: string
            meta?: Record<string, unknown>
          }
          if (!event?.id) return
          const incoming: HeaderAlertItem = {
            id: event.id,
            title: event.title || 'Alert',
            message: event.message || 'No details provided.',
            createdAt: event.timestamp || new Date().toISOString(),
            read: false,
            isRead: false,
            section: event.section === 'important' ? 'important' : 'general',
            severity: event.severity || 'low',
            category: event.section === 'important' ? 'important' : 'general',
            label: typeof event.category === 'string' ? event.category : undefined,
            meta: event.meta || {},
          }
          setAlerts((prev) => sortAlertsNewestFirst(mergeAlertById(prev, incoming)))
        })
        socket.on('alerts:refresh', () => {
          if (isCancelled) return
          void loadAlerts({ silent: true })
        })

        const handleSocketFailure = () => {
          if (isCancelled) return
          setIsSocketConnected(false)
          if (socketRetryTimerRef.current) window.clearTimeout(socketRetryTimerRef.current)
          const attempt = socketRetryAttemptRef.current + 1
          socketRetryAttemptRef.current = attempt
          const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5))
          socketRetryTimerRef.current = window.setTimeout(() => {
            setSocketRetryNonce((prev) => prev + 1)
          }, delay)
        }
        socket.on('disconnect', handleSocketFailure)
        socket.on('connect_error', handleSocketFailure)
      } catch {
        setIsSocketConnected(false)
      }
    }

    void connectSocket()
    return () => {
      isCancelled = true
      socketRef.current?.disconnect?.()
      socketRef.current?.close?.()
      socketRef.current = null
      setIsSocketConnected(false)
      if (socketRetryTimerRef.current) {
        window.clearTimeout(socketRetryTimerRef.current)
        socketRetryTimerRef.current = null
      }
    }
  }, [isAuthenticated, loadAlerts, socketRetryNonce])

  useEffect(() => {
    if (!isAuthenticated || isSocketConnected || isSseConnected) return
    const timer = window.setInterval(() => {
      void loadAlerts({ silent: true })
    }, ALERTS_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [isAuthenticated, isSocketConnected, isSseConnected, loadAlerts])

  useEffect(() => {
    if (!isAuthenticated) return
    if (isSocketConnected) return
    if (!ALERTS_STREAM_ENDPOINT) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    const token = getAccessToken()
    const streamUrl = new URL(ALERTS_STREAM_ENDPOINT, window.location.origin)
    if (token) streamUrl.searchParams.set('token', token)

    const source = new EventSource(streamUrl.toString(), { withCredentials: true })
    const handlePayload = (raw: string) => {
      if (!raw) {
        void loadAlerts({ silent: true })
        return
      }
      try {
        const payload = JSON.parse(raw) as AlertsResponse | { data?: AlertsResponse }
        const normalized = mapAlertsPayloadToItems(
          (payload as { data?: AlertsResponse }).data ?? (payload as AlertsResponse),
        )
        const summary = extractAlertsSummary((payload as { data?: AlertsResponse }).data ?? (payload as AlertsResponse))
        if (normalized.length > 0) {
          setAlerts(sortAlertsNewestFirst(normalized))
          setAlertsSummary(summary)
          setIsSseConnected(true)
          sseRetryAttemptRef.current = 0
          return
        }
      } catch {
        // Ignore malformed stream payload and fallback to API pull
      }
      void loadAlerts({ silent: true })
    }

    source.onmessage = (event) => {
      handlePayload(event.data)
    }
    source.addEventListener('snapshot', (event) => {
      handlePayload((event as MessageEvent).data)
    })
    source.addEventListener('update', (event) => {
      handlePayload((event as MessageEvent).data)
    })
    source.addEventListener('error', () => {
      setIsSseConnected(false)
      void loadAlerts({ silent: true })
    })
    source.onerror = () => {
      setIsSseConnected(false)
      source.close()
      if (sseRetryTimerRef.current) window.clearTimeout(sseRetryTimerRef.current)
      const attempt = sseRetryAttemptRef.current + 1
      sseRetryAttemptRef.current = attempt
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5))
      sseRetryTimerRef.current = window.setTimeout(() => {
        setSseRetryNonce((prev) => prev + 1)
      }, delay)
    }

    return () => {
      setIsSseConnected(false)
      source.close()
      if (sseRetryTimerRef.current) {
        window.clearTimeout(sseRetryTimerRef.current)
        sseRetryTimerRef.current = null
      }
    }
  }, [ALERTS_STREAM_ENDPOINT, isAuthenticated, isSocketConnected, loadAlerts, sseRetryNonce])

  const markAlertReadRemote = useCallback(async (alertId: string) => {
    if (!alertId) return
    const endpoint = ALERTS_READ_ONE_ENDPOINT_TEMPLATE.replace(':alertId', encodeURIComponent(alertId))
    try {
      await apiRequest(endpoint, { method: 'PATCH' })
      void loadAlerts({ silent: true })
    } catch {
      // Keep UI responsive even if backend call fails.
    }
  }, [loadAlerts])

  const markAllAlertsReadRemote = useCallback(async () => {
    try {
      await apiRequest(ALERTS_READ_ALL_ENDPOINT, { method: 'PATCH' })
      void loadAlerts({ silent: true })
    } catch {
      // Keep UI responsive even if backend call fails.
    }
  }, [loadAlerts])

  const requestAlertPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setAlertPermission('unsupported')
      return
    }
    const permission = await Notification.requestPermission()
    setAlertPermission(permission)
  }, [])

  const pushAlert = useCallback((title: string, message: string) => {
    setAlerts((prev) => [
      {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
        category: 'general',
        label: 'System',
      },
      ...prev,
    ])
  }, [])

  useEffect(() => {
    if (!isAuthenticated || alertPermission !== 'granted') return
    const unread = alerts.filter((alert) => !alert.read).length
    if (unread === 0) return

    const todayKey = `ats-alert-notified-${new Date().toISOString().slice(0, 10)}`
    if (localStorage.getItem(todayKey) === '1') return

    new Notification('ATS Daily Alerts', {
      body: `You have ${unread} unread alerts to review in the header alerts panel.`,
      tag: 'ats-daily-alerts',
    })
    localStorage.setItem(todayKey, '1')
  }, [isAuthenticated, alertPermission, alerts])

  useEffect(() => {
    if (!isAuthenticated) return
    let isMounted = true

    async function loadUserRole() {
      const localUserRaw = localStorage.getItem('user')
      if (localUserRaw) {
        try {
          const localUser = JSON.parse(localUserRaw) as UserProfileResponse
          const localOverrides = extractPermissionOverrides(localUser)
          if (isMounted && localOverrides) {
            setPermissionOverrides(localOverrides)
          }
        } catch {
          // ignore invalid local user payload
        }
      }
      const localRole = localStorage.getItem('role')
      if (localRole && localRole.trim().length > 0) {
        setSidebarRole(localRole)
      }
      const configured = AUTH_ME_ENDPOINTS
        .split(',')
        .map((value: string) => value.trim())
        .filter((value: string) => value.length > 0)
      const endpoints = [AUTH_ME_ENDPOINT, ...configured].filter((value, index, all) => value && all.indexOf(value) === index)
      if (endpoints.length === 0) return
      try {
        for (const endpoint of endpoints) {
          try {
            const profile = await apiRequest<UserProfileResponse>(endpoint)
            const fetchedRole = profile.role ?? profile.user?.role ?? profile.data?.role ?? profile.data?.user?.role
            const fetchedPermissions = extractPermissionOverrides(profile)
            if (isMounted && fetchedRole && fetchedRole.trim().length > 0) {
              setSidebarRole(fetchedRole)
              if (fetchedPermissions) setPermissionOverrides(fetchedPermissions)
              return
            }
            if (isMounted && fetchedPermissions) {
              setPermissionOverrides(fetchedPermissions)
            }
          } catch {
            // try next profile endpoint
          }
        }
      } catch {
        // Keep fallback role so app remains usable before auth module integration.
      }
    }

    void loadUserRole()
    return () => {
      isMounted = false
    }
  }, [isAuthenticated, rbacVersion])

  useEffect(() => {
    if (!isAuthenticated || !selectedJobId || (view !== 'details' && view !== 'edit')) return
    const jobId = selectedJobId
    let isMounted = true

    async function loadDetails() {
      const localMatch = jobs.find((job) => job.id === jobId) ?? null
      if (isMounted && localMatch) {
        setSelectedJob(localMatch)
      }
      setDetailsLoading(true)
      setActionError(null)
      try {
        const result = await getJobById(jobId)
        if (isMounted) setSelectedJob(result)
      } catch (detailsError) {
        if (isMounted && !localMatch) {
          const message = getErrorMessage(detailsError, 'Unable to load job details')
          setActionError(message)
        }
      } finally {
        if (isMounted) setDetailsLoading(false)
      }
    }
    void loadDetails()
    return () => {
      isMounted = false
    }
  }, [isAuthenticated, jobs, selectedJobId, view])

  useEffect(() => {
    if (!isAuthenticated) return
    if ((view === 'dashboard' || view === 'reports') && !permissions.canViewDashboard) {
      if (permissions.canViewJobs) navigateTo('list', { replace: true, jobId: null })
      else if (permissions.canViewCandidates) navigateTo('candidate-list', { replace: true, candidateJobId: null, candidateId: null })
      else if (permissions.canManageUsers) navigateTo('users', { replace: true })
      return
    }
    if ((view === 'list' || view === 'create' || view === 'details' || view === 'edit') && !permissions.canViewJobs) {
      navigateTo('dashboard', { replace: true })
      return
    }
    if ((view.startsWith('candidate') || view === 'interviews') && !permissions.canViewCandidates) {
      navigateTo('dashboard', { replace: true })
      return
    }
    if ((view === 'details' || view === 'edit') && !selectedJobId) {
      navigateTo('list', { replace: true, jobId: null })
      return
    }
    if (view === 'candidate-details' && !selectedCandidateId) {
      navigateTo('candidate-list', { replace: true, candidateJobId: selectedCandidateJobId })
      return
    }
    if (view === 'users' && !permissions.canManageUsers) {
      navigateTo('dashboard', { replace: true })
    }
  }, [
    isAuthenticated,
    navigateTo,
    permissions.canManageUsers,
    permissions.canViewCandidates,
    permissions.canViewDashboard,
    permissions.canViewJobs,
    selectedCandidateId,
    selectedCandidateJobId,
    selectedJobId,
    view,
  ])

  const handleCreate = useCallback(
    async (values: JobFormValues) => {
      if (!permissions.canCreateJob) {
        showToast('You do not have access to create jobs.', 'error')
        return
      }
      setSaving(true)
      setActionError(null)
      try {
        const allJobs = await getJobs()
        const existingReqIds = new Set(allJobs.map((job) => job.reqId.trim().toUpperCase()).filter(Boolean))
        const reqId = generateUniqueReqId(existingReqIds)
        const created = await createJob(toApiPayload(values, reqId))
        await loadJobs()
        setSelectedJobId(created.id)
        setSelectedJob(created)
        navigateTo('details', { jobId: created.id })
      } catch (createError) {
        const message = getErrorMessage(createError, 'Unable to create job')
        setActionError(message)
        showToast(message, 'error')
      } finally {
        setSaving(false)
      }
    },
    [loadJobs, navigateTo, permissions.canCreateJob, showToast],
  )

  const handleUpdate = useCallback(
    async (values: JobFormValues) => {
      if (!selectedJobId) return
      if (!permissions.canEditJob) {
        showToast('You do not have access to edit jobs.', 'error')
        return
      }
      setSaving(true)
      setActionError(null)
      try {
        const updated = await updateJob(selectedJobId, toApiPayload(values))
        await loadJobs()
        setSelectedJob(updated)
        navigateTo('details', { jobId: updated.id })
      } catch (updateError) {
        const message = getErrorMessage(updateError, 'Unable to update job')
        setActionError(message)
        showToast(message, 'error')
      } finally {
        setSaving(false)
      }
    },
    [selectedJobId, loadJobs, navigateTo, permissions.canEditJob, showToast],
  )

  const handleDelete = useCallback(
    async (jobId: string) => {
      if (!permissions.canDeleteJob) {
        showToast('Only authorized roles can delete jobs.', 'error')
        return
      }
      const accepted = await confirm({
        title: 'Delete Job',
        message: 'Soft delete this job?',
        confirmLabel: 'Delete',
      })
      if (!accepted) return
      setBusyJobId(jobId)
      setActionError(null)
      try {
        await deleteJob(jobId)
        await loadJobs(view === 'list' ? activeListQuery : {})
        if (selectedJobId === jobId) {
          setSelectedJobId(null)
          setSelectedJob(null)
          navigateTo('list')
        }
        showToast('Job deleted successfully.', 'success')
      } catch (deleteError) {
        const message = getErrorMessage(deleteError, 'Unable to delete job')
        setActionError(message)
        showToast(message, 'error')
      } finally {
        setBusyJobId(null)
      }
    },
    [activeListQuery, confirm, loadJobs, navigateTo, permissions.canDeleteJob, selectedJobId, showToast, view],
  )

  const handleStatusChange = useCallback(
    async (job: JobRecord, status: JobRecord['status']) => {
      if (status === 'Filled') {
        showToast('Filled status is automatic when joined candidates reach openings.', 'error')
        return
      }
      if (isJobExpired(job.targetClosureDate)) {
        showToast('Expired jobs are locked. Status cannot be changed.', 'error')
        return
      }
      if (job.openings > 0 && job.filled >= job.openings) {
        showToast('All openings are filled. Status is managed automatically.', 'error')
        return
      }
      if (!permissions.canEditJob) {
        showToast('You do not have access to update job status.', 'error')
        return
      }
      setBusyJobId(job.id)
      setActionError(null)
      try {
        const updated = await updateJobStatus(job.id, status)
        await loadJobs(view === 'list' ? activeListQuery : {})
        if (selectedJobId === job.id) setSelectedJob(updated)
        showToast('Job status updated.', 'success')
      } catch (statusError) {
        const message = getErrorMessage(statusError, 'Unable to update job status')
        setActionError(message)
        showToast(message, 'error')
      } finally {
        setBusyJobId(null)
      }
    },
    [activeListQuery, loadJobs, permissions.canEditJob, selectedJobId, showToast, view],
  )

  const openDetails = useCallback(
    (jobId: string) => {
      const localMatch = jobs.find((job) => job.id === jobId) ?? null
      setSelectedJob(localMatch)
      navigateTo('details', { jobId })
    },
    [jobs, navigateTo],
  )

  const openEdit = useCallback(
    (jobId: string) => {
      const targetJob = jobs.find((item) => item.id === jobId)
      if (targetJob && isJobExpired(targetJob.targetClosureDate)) {
        showToast('Expired jobs are locked. Edit is not allowed.', 'error')
        return
      }
      const localMatch = jobs.find((job) => job.id === jobId) ?? null
      setSelectedJob(localMatch)
      navigateTo('edit', { jobId })
    },
    [jobs, navigateTo],
  )

  const openCandidatesForJob = useCallback(
    (jobId: string) => {
      const targetJob = jobs.find((item) => item.id === jobId)
      if (targetJob && isJobExpired(targetJob.targetClosureDate)) {
        showToast('Expired jobs are locked. Candidate workflow is not allowed.', 'error')
        return
      }
      if (!permissions.canViewCandidates) {
        showToast('You do not have access to candidate management.', 'error')
        return
      }
      navigateTo('candidate-list', { candidateJobId: jobId, candidateId: null })
    },
    [jobs, navigateTo, permissions.canViewCandidates, showToast],
  )

  const handleLogout = useCallback(() => {
    clearTokens()
    localStorage.removeItem('token')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('role')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('refreshToken')

    setIsAuthenticated(false)
    setAuthPage('login')
    setView('dashboard')
    setSelectedJobId(null)
    setSelectedJob(null)
    window.history.replaceState({}, '', '/')
  }, [])

  if (!isAuthenticated) {
    return (
      <AuthLayout>
        {authPage === 'login' && (
          <LoginPage
            onForgotPassword={() => setAuthPage('forgot')}
            onSignInSuccess={() => {
              setIsAuthenticated(true)
              setView('dashboard')
              window.history.replaceState({}, '', '/dashboard')
            }}
          />
        )}
        {authPage === 'forgot' && (
          <ForgotPasswordPage
            onBackToSignIn={goToLogin}
            onSuccess={() => setAuthPage('success')}
            initialEmail={resetContext.email}
            initialToken={resetContext.token}
          />
        )}
        {authPage === 'success' && <AuthSuccessPage onBackToSignIn={goToLogin} />}
      </AuthLayout>
    )
  }

  return (
    <Layout
      navItems={
        [
          {
            id: 'dashboard',
            label: 'Dashboard',
            icon: 'dashboard',
            isVisible: permissions.canViewDashboard,
            onClick: () => {
              if (!permissions.canViewDashboard) {
                showToast('Your role has no access to Dashboard.', 'error')
                return
              }
              navigateTo('dashboard', { jobId: null, candidateId: null, candidateJobId: null })
            },
          },
          {
            id: 'jobs',
            label: 'Jobs',
            icon: 'work',
            isVisible: permissions.canViewJobs,
            onClick: () => {
              if (!permissions.canViewJobs) {
                showToast('Your role has read restrictions for Jobs module.', 'error')
                return
              }
              navigateTo('list', { jobId: null })
            },
          },
          {
            id: 'candidates',
            label: 'Candidates',
            icon: 'group',
            isVisible: permissions.canViewCandidates,
            onClick: () => {
              if (!permissions.canViewCandidates) {
                showToast('Your role has no access to Candidates module.', 'error')
                return
              }
              navigateTo('candidate-list', { candidateJobId: null, candidateId: null })
            },
          },
          {
            id: 'interviews',
            label: 'Interviews',
            icon: 'event',
            isVisible: permissions.canViewCandidates,
            onClick: () => {
              if (!permissions.canViewCandidates) {
                showToast('Your role has no access to interview queue.', 'error')
                return
              }
              navigateTo('interviews')
            },
          },
          {
            id: 'users',
            label: 'Users',
            icon: 'admin_panel_settings',
            isVisible: permissions.canManageUsers,
            onClick: () => {
              if (!permissions.canManageUsers) {
                showToast('Only Super Admin can access users and roles.', 'error')
                return
              }
              navigateTo('users')
            },
          },
          {
            id: 'reports',
            label: 'Reports',
            icon: 'description',
            isVisible: permissions.canViewDashboard,
            onClick: () => {
              if (!permissions.canViewDashboard) {
                showToast('Your role has no access to reports.', 'error')
                return
              }
              navigateTo('reports')
            },
          },
        ] satisfies SidebarNavItem[]
      }
      activeNav={
        view === 'dashboard'
          ? 'dashboard'
          : view === 'users'
            ? 'users'
            : view === 'interviews'
              ? 'interviews'
              : view === 'reports'
                ? 'reports'
              : view.startsWith('candidate')
                ? 'candidates'
                : 'jobs'
      }
      logoSrc={appLogo}
      role={normalizedRole}
      onLogout={handleLogout}
      alerts={alerts}
      alertSummary={alertsSummary}
      alertsLoading={alertsLoading}
      alertsError={alertsError}
      alertPermission={alertPermission}
      onRequestAlertPermission={() => void requestAlertPermission()}
      onMarkAlertRead={(alertId) => {
        setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, read: true } : alert)))
        void markAlertReadRemote(alertId)
      }}
      onMarkAllRead={() => {
        setAlerts((prev) => prev.map((alert) => ({ ...alert, read: true })))
        void markAllAlertsReadRemote()
      }}
      onClearReadAlerts={() => setAlerts((prev) => prev.filter((alert) => !alert.read))}
      onClearAllAlerts={() => {
        setAlerts((prev) => prev.map((alert) => ({ ...alert, read: true })))
        void markAllAlertsReadRemote()
      }}
      searchValue={globalSearchValue}
      onSearchValueChange={setGlobalSearchValue}
      onSearchSubmit={handlePowerSearchSubmit}
      showSearchControls={showHeaderSearchControls}
    >
      {view === 'dashboard' && (
        <DashboardPage
          jobs={jobs}
          loading={permissions.canViewJobs ? loading : false}
          error={permissions.canViewJobs ? listError : null}
          onRetry={() => {
            if (!permissions.canViewJobs) return
            void loadJobs()
          }}
        />
      )}
      {view === 'reports' && (
        <WeeklyReportPage jobs={jobs} jobsLoading={loading} jobsError={listError} onRetryJobs={() => void loadJobs()} />
      )}
      {view === 'list' && (
        <JobListPage
          jobs={jobs}
          loading={loading}
          error={listError}
          searchTerm={jobListSearchTerm}
          sortDirection={jobListSortDirection}
          onToggleSortDirection={() => setJobListSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          departmentFilter={jobListDepartmentFilter}
          statusFilter={jobListStatusFilter}
          onSearchTermChange={setJobListSearchTerm}
          onDepartmentFilterChange={setJobListDepartmentFilter}
          onStatusFilterChange={setJobListStatusFilter}
          onClearFilters={() => {
            setJobListSearchTerm('')
            setJobListDepartmentFilter('all')
            setJobListStatusFilter('all')
          }}
          onRetry={() => void loadJobs(activeListQuery)}
          onCreate={() => (permissions.canCreateJob ? navigateTo('create', { jobId: null }) : showToast('You do not have access to create jobs.', 'error'))}
          onView={openDetails}
          onEdit={openEdit}
          onManageCandidates={openCandidatesForJob}
          onDelete={(jobId) => void handleDelete(jobId)}
          onStatusChange={(job, status) => void handleStatusChange(job, status)}
          busyJobId={busyJobId}
          canCreateJob={permissions.canCreateJob}
          canEditJob={permissions.canEditJob}
          canDeleteJob={permissions.canDeleteJob}
        />
      )}
      {view === 'create' && permissions.canCreateJob && (
        <CreateJobPage saving={saving} error={actionError} onCancel={() => navigateBack('list', { jobId: null })} onSubmit={handleCreate} />
      )}
      {view === 'details' && (
        <JobDetailsPage
          job={selectedJob ?? (selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null)}
          loading={detailsLoading}
          error={actionError}
          onBack={() => navigateBack('list', { jobId: null })}
          onEdit={() => navigateTo('edit', { jobId: selectedJobId })}
          onManageCandidates={openCandidatesForJob}
          canEditJob={permissions.canEditJob && !isJobExpired(selectedJob?.targetClosureDate)}
          canManageCandidates={!isJobExpired(selectedJob?.targetClosureDate)}
        />
      )}
      {view === 'edit' && permissions.canEditJob && (
        <EditJobPage
          job={selectedJob}
          loading={detailsLoading}
          saving={saving}
          error={actionError}
          onBack={() => navigateBack('details', { jobId: selectedJobId })}
          onSubmit={handleUpdate}
        />
      )}
      {view === 'candidate-list' && (
        <CandidateListPage
          jobs={jobs}
          initialJobId={selectedCandidateJobId}
          searchTerm={candidateListSearchTerm}
          onSearchTermChange={setCandidateListSearchTerm}
          sortDirection={candidateListSortDirection}
          onToggleSortDirection={() => setCandidateListSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          canCreateCandidate={permissions.canCreateCandidate}
          canEditCandidate={permissions.canEditCandidate}
          canManageCandidateStage={permissions.canManageCandidateStage}
          onInterviewAlert={pushAlert}
          onCandidateDataChanged={() => {
            void loadJobs()
          }}
          onAddCandidate={() =>
            permissions.canCreateCandidate
              ? navigateTo('candidate-add', { candidateJobId: selectedCandidateJobId })
              : showToast('You do not have access to add candidates.', 'error')
          }
          onViewCandidate={(candidateId) => {
            navigateTo('candidate-details', { candidateId })
          }}
          onEditCandidate={(candidateId) => {
            navigateTo('candidate-details', { candidateId })
          }}
        />
      )}
      {view === 'candidate-add' && permissions.canCreateCandidate && (
        <AddCandidatePage
          jobs={jobs}
          initialJobId={selectedCandidateJobId}
          onBack={() => navigateBack('candidate-list', { candidateJobId: selectedCandidateJobId })}
          onCreated={(candidateId) => {
            void loadJobs()
            navigateTo('candidate-details', { candidateId })
          }}
        />
      )}
      {view === 'candidate-details' && selectedCandidateId && (
        <CandidateDetailPage
          candidateId={selectedCandidateId}
          jobs={jobs}
          onBack={() => navigateBack('candidate-list', { candidateJobId: selectedCandidateJobId })}
          canEdit={permissions.canEditCandidate}
          canManageStage={permissions.canManageCandidateStage}
          onInterviewAlert={pushAlert}
          onCandidateDataChanged={() => {
            void loadJobs()
          }}
        />
      )}
      {view === 'interviews' && (
        <InterviewQueuePage
          role={normalizedRole}
          canSubmitInterview={permissions.canViewCandidates}
          onInterviewAlert={pushAlert}
        />
      )}
      {view === 'users' && permissions.canManageUsers && (
        <UserManagementPage
          role={normalizedRole}
          searchTerm={userListSearchTerm}
          onSearchTermChange={setUserListSearchTerm}
          onRbacPolicyUpdated={() => setRbacVersion((prev) => prev + 1)}
        />
      )}
    </Layout>
  )
}

export default AppRoutes
