import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthLayout from '../components/auth/AuthLayout'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/ToastProvider'
import type { HeaderAlertItem } from '../components/layout/Header'
import Layout from '../components/layout/Layout'
import { createJob, deleteJob, getJobById, getJobs, updateJob, updateJobStatus } from '../features/jobs/jobsAPI'
import type { JobsQueryParams } from '../features/jobs/jobsAPI'
import type { JobFormValues, JobRecord } from '../features/jobs/jobTypes'
import { getCandidates } from '../features/candidates/candidateAPI'
import AuthSuccessPage from '../pages/auth/AuthSuccessPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import { getRolePermissions, normalizeRole, type RolePermissions } from '../features/auth/roleAccess'
import AddCandidatePage from '../pages/candidates/AddCandidatePage'
import CandidateDetailPage from '../pages/candidates/CandidateDetailPage'
import CandidateListPage from '../pages/candidates/CandidateListPage'
import InterviewQueuePage from '../pages/interviews/InterviewQueuePage'
import CreateJobPage from '../pages/jobs/CreateJobPage'
import EditJobPage from '../pages/jobs/EditJobPage'
import JobDetailsPage from '../pages/jobs/JobDetailsPage'
import JobListPage from '../pages/jobs/JobListPage'
import UserManagementPage from '../pages/users/UserManagementPage'
import { apiRequest } from '../services/axiosInstance'
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
  | 'users'
type AuthPage = 'login' | 'forgot' | 'success'

type AppRoutesProps = {
  onInitialDataReady?: () => void
  onNavigationLoadingChange?: (loading: boolean) => void
}

type UserProfileResponse = {
  role?: string
  permissions?: Record<string, unknown>
  user?: {
    role?: string
    permissions?: Record<string, unknown>
  }
}

type AlertsResponse =
  | HeaderAlertItem[]
  | { data?: HeaderAlertItem[]; alerts?: HeaderAlertItem[] }
  | null
  | undefined

const AUTH_ME_ENDPOINT = import.meta.env.VITE_AUTH_ME_ENDPOINT ?? ''
const AUTH_ME_ENDPOINTS = import.meta.env.VITE_AUTH_ME_ENDPOINTS?.trim() ?? ''
const ALERTS_ENDPOINT = import.meta.env.VITE_ALERTS_ENDPOINT?.trim() ?? ''

function mapBackendPermissionsToFrontend(input?: Record<string, unknown>): RolePermissions | null {
  if (!input || typeof input !== 'object') return null
  return {
    canViewDashboard: Boolean(input.viewDashboard),
    canViewJobs: Boolean(input.viewJobs),
    canCreateJob: Boolean(input.createJobs),
    canEditJob: Boolean(input.editJobs),
    canDeleteJob: Boolean(input.deleteJobs),
    canViewCandidates: Boolean(input.viewCandidates),
    canCreateCandidate: Boolean(input.addCandidates),
    canEditCandidate: Boolean(input.editCandidates),
    canManageCandidateStage: Boolean(input.manageCandidateStages),
    canManageUsers: Boolean(input.manageUsers),
  }
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
  if (state.view === 'users') pathname = '/users'

  return query.length > 0 ? `${pathname}?${query}` : pathname
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

function AppRoutes({ onInitialDataReady, onNavigationLoadingChange }: AppRoutesProps) {
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
  const [jobListDepartmentFilter, setJobListDepartmentFilter] = useState('all')
  const [jobListStatusFilter, setJobListStatusFilter] = useState<'all' | JobRecord['status']>('all')
  const [alerts, setAlerts] = useState<HeaderAlertItem[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [alertPermission, setAlertPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [rbacVersion, setRbacVersion] = useState(0)
  const [permissionOverrides, setPermissionOverrides] = useState<RolePermissions | null>(null)

  const hasReportedInitialLoadRef = useRef(false)
  const loadJobsRequestIdRef = useRef(0)
  const autoStatusSyncRef = useRef(false)
  const normalizedRole = normalizeRole(sidebarRole)
  const permissions = useMemo(() => permissionOverrides ?? getRolePermissions(normalizedRole), [normalizedRole, permissionOverrides, rbacVersion])

  useEffect(() => {
    if (isAuthenticated) return
    if (hasReportedInitialLoadRef.current) return
    onInitialDataReady?.()
    hasReportedInitialLoadRef.current = true
  }, [isAuthenticated, onInitialDataReady])

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
      onNavigationLoadingChange?.(true)
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
      window.setTimeout(() => onNavigationLoadingChange?.(false), 520)
    },
    [onNavigationLoadingChange, selectedCandidateId, selectedCandidateJobId, selectedJobId],
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
      search: jobListSearchTerm.trim() || undefined,
      department: jobListDepartmentFilter === 'all' ? undefined : jobListDepartmentFilter,
      status: jobListStatusFilter === 'all' ? undefined : jobListStatusFilter,
    }),
    [jobListSearchTerm, jobListDepartmentFilter, jobListStatusFilter],
  )

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

    if (view === 'dashboard' || view.startsWith('candidate')) {
      void loadJobs()
      return
    }
    if (view !== 'list') return

    const timer = window.setTimeout(() => {
      void loadJobs(activeListQuery)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [isAuthenticated, view, activeListQuery, loadJobs])

  const fallbackAlerts = useMemo<HeaderAlertItem[]>(() => {
    const nowIso = new Date().toISOString()
    return jobs
      .filter((job) => job.status === 'Open' || job.status === 'On Hold')
      .map((job) => {
        const title = `${job.title} (${job.reqId})`
        return {
          id: `job-${job.id}`,
          title: `Job Aging: ${title}`,
          message: job.targetClosureDate
            ? `Target closure date is ${job.targetClosureDate}.`
            : 'No target closure date set.',
          createdAt: nowIso,
          read: false,
        }
      })
      .slice(0, 20)
  }, [jobs])

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    setAlertsError(null)
    if (!ALERTS_ENDPOINT) {
      setAlerts(fallbackAlerts)
      setAlertsLoading(false)
      return
    }
    try {
      const response = await apiRequest<AlertsResponse>(ALERTS_ENDPOINT)
      const payload = Array.isArray(response) ? response : (response?.data ?? response?.alerts ?? [])
      const normalized = payload.map((alert, index) => ({
        id: alert.id || `alert-${index}`,
        title: alert.title || 'Alert',
        message: alert.message || 'No details provided.',
        createdAt: alert.createdAt || new Date().toISOString(),
        read: Boolean(alert.read),
      }))
      setAlerts(normalized)
    } catch {
      setAlerts(fallbackAlerts)
      setAlertsError('Alerts API unavailable. Showing fallback alerts.')
    } finally {
      setAlertsLoading(false)
    }
  }, [fallbackAlerts])

  useEffect(() => {
    if (!isAuthenticated) return
    void loadAlerts()
  }, [isAuthenticated, loadAlerts])

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
            const fetchedRole = profile.role ?? profile.user?.role
            const fetchedPermissions = mapBackendPermissionsToFrontend(
              (profile.permissions as Record<string, unknown> | undefined) ??
                (profile.user?.permissions as Record<string, unknown> | undefined),
            )
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
    if (view === 'dashboard' && !permissions.canViewDashboard) {
      if (permissions.canViewJobs) navigateTo('list', { replace: true, jobId: null })
      else if (permissions.canViewCandidates) navigateTo('candidate-list', { replace: true, candidateJobId: null, candidateId: null })
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
      onShowJobs={() => {
        if (!permissions.canViewJobs) {
          showToast('Your role has read restrictions for Jobs module.', 'error')
          return
        }
        navigateTo('list', { jobId: null })
      }}
      onShowDashboard={() => {
        if (!permissions.canViewDashboard) {
          showToast('Your role has no access to Dashboard.', 'error')
          return
        }
        navigateTo('dashboard', { jobId: null, candidateId: null, candidateJobId: null })
      }}
      onShowCandidates={() => {
        if (!permissions.canViewCandidates) {
          showToast('Your role has no access to Candidates module.', 'error')
          return
        }
        navigateTo('candidate-list', { candidateJobId: null, candidateId: null })
      }}
      onShowInterviews={() => {
        if (!permissions.canViewCandidates) {
          showToast('Your role has no access to interview queue.', 'error')
          return
        }
        navigateTo('interviews')
      }}
      onShowUsers={() => {
        if (!permissions.canManageUsers) {
          showToast('Only Super Admin can access users and roles.', 'error')
          return
        }
        navigateTo('users')
      }}
      activeNav={
        view === 'dashboard'
          ? 'dashboard'
          : view === 'users'
            ? 'users'
            : view === 'interviews'
              ? 'interviews'
              : view.startsWith('candidate')
                ? 'candidates'
                : 'jobs'
      }
      logoSrc={appLogo}
      role={normalizedRole}
      canViewDashboard={permissions.canViewDashboard}
      canViewJobs={permissions.canViewJobs}
      canViewCandidates={permissions.canViewCandidates}
      canViewInterviews={permissions.canViewCandidates}
      canManageUsers={permissions.canManageUsers}
      onLogout={handleLogout}
      alerts={alerts}
      alertsLoading={alertsLoading}
      alertsError={alertsError}
      alertPermission={alertPermission}
      onRetryAlerts={() => void loadAlerts()}
      onRequestAlertPermission={() => void requestAlertPermission()}
      onMarkAlertRead={(alertId) =>
        setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, read: true } : alert)))
      }
      onClearReadAlerts={() => setAlerts((prev) => prev.filter((alert) => !alert.read))}
      onClearAllAlerts={() => setAlerts([])}
    >
      {view === 'dashboard' && <DashboardPage jobs={jobs} loading={loading} error={listError} onRetry={() => void loadJobs()} />}
      {view === 'list' && (
        <JobListPage
          jobs={jobs}
          loading={loading}
          error={listError}
          searchTerm={jobListSearchTerm}
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
        <CreateJobPage saving={saving} error={actionError} onCancel={() => navigateTo('list', { jobId: null })} onSubmit={handleCreate} />
      )}
      {view === 'details' && (
        <JobDetailsPage
          job={selectedJob ?? (selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null)}
          loading={detailsLoading}
          error={actionError}
          onBack={() => navigateTo('list', { jobId: null })}
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
          onBack={() => navigateTo('details', { jobId: selectedJobId })}
          onSubmit={handleUpdate}
        />
      )}
      {view === 'candidate-list' && (
        <CandidateListPage
          jobs={jobs}
          initialJobId={selectedCandidateJobId}
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
          onBack={() => navigateTo('candidate-list', { candidateJobId: selectedCandidateJobId })}
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
          onBack={() => navigateTo('candidate-list', { candidateJobId: selectedCandidateJobId })}
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
          onInterviewAlert={pushAlert}
        />
      )}
      {view === 'users' && permissions.canManageUsers && (
        <UserManagementPage role={normalizedRole} onRbacPolicyUpdated={() => setRbacVersion((prev) => prev + 1)} />
      )}
    </Layout>
  )
}

export default AppRoutes
