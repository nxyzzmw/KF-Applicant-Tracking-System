import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthLayout from '../components/auth/AuthLayout'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/ToastProvider'
import type { HeaderAlertItem } from '../components/layout/Header'
import Layout from '../components/layout/Layout'
import { createJob, deleteJob, getJobById, getJobs, updateJob, updateJobStatus } from '../features/jobs/jobsAPI'
import type { JobsQueryParams } from '../features/jobs/jobsAPI'
import type { JobFormValues, JobRecord } from '../features/jobs/jobTypes'
import AuthSuccessPage from '../pages/auth/AuthSuccessPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import { getRolePermissions, normalizeRole } from '../features/auth/roleAccess'
import AddCandidatePage from '../pages/candidates/AddCandidatePage'
import CandidateDetailPage from '../pages/candidates/CandidateDetailPage'
import CandidateListPage from '../pages/candidates/CandidateListPage'
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

type JobView = 'dashboard' | 'list' | 'create' | 'details' | 'edit' | 'candidate-list' | 'candidate-add' | 'candidate-details' | 'users'
type AuthPage = 'login' | 'forgot' | 'success'

type AppRoutesProps = {
  onInitialDataReady?: () => void
  onNavigationLoadingChange?: (loading: boolean) => void
}

type UserProfileResponse = {
  role?: string
  user?: {
    role?: string
  }
}

type AlertsResponse =
  | HeaderAlertItem[]
  | { data?: HeaderAlertItem[]; alerts?: HeaderAlertItem[] }
  | null
  | undefined

const AUTH_ME_ENDPOINT = import.meta.env.VITE_AUTH_ME_ENDPOINT ?? ''

function getInitialAuthPage(): AuthPage {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
  return normalizedPath === '/reset-password' ? 'forgot' : 'login'
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

  const hasReportedInitialLoadRef = useRef(false)
  const loadJobsRequestIdRef = useRef(0)
  const normalizedRole = normalizeRole(sidebarRole)
  const permissions = useMemo(() => getRolePermissions(normalizedRole), [normalizedRole, rbacVersion])

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
    (nextView: JobView) => {
      onNavigationLoadingChange?.(true)
      setActionError(null)
      setView(nextView)
      window.setTimeout(() => onNavigationLoadingChange?.(false), 520)
    },
    [onNavigationLoadingChange],
  )

  const loadJobs = useCallback(
    async (query: JobsQueryParams = {}) => {
      const requestId = loadJobsRequestIdRef.current + 1
      loadJobsRequestIdRef.current = requestId
      setLoading(true)
      setListError(null)
      try {
        const result = await getJobs(query)
        if (loadJobsRequestIdRef.current === requestId) {
          setJobs(result)
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
    try {
      const response = await apiRequest<AlertsResponse>('/alerts')
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
      const endpoints = [AUTH_ME_ENDPOINT, '/me', '/auth/me'].filter((value, index, all) => value && all.indexOf(value) === index)
      try {
        for (const endpoint of endpoints) {
          try {
            const profile = await apiRequest<UserProfileResponse>(endpoint)
            const fetchedRole = profile.role ?? profile.user?.role
            if (isMounted && fetchedRole && fetchedRole.trim().length > 0) {
              setSidebarRole(fetchedRole)
              return
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
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !selectedJobId || (view !== 'details' && view !== 'edit')) return
    const jobId = selectedJobId
    let isMounted = true

    async function loadDetails() {
      setDetailsLoading(true)
      setActionError(null)
      try {
        const result = await getJobById(jobId)
        if (isMounted) setSelectedJob(result)
      } catch (detailsError) {
        const message = getErrorMessage(detailsError, 'Unable to load job details')
        if (isMounted) setActionError(message)
      } finally {
        if (isMounted) setDetailsLoading(false)
      }
    }
    void loadDetails()
    return () => {
      isMounted = false
    }
  }, [isAuthenticated, selectedJobId, view])

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
        navigateTo('details')
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
        navigateTo('details')
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
      setSelectedJobId(jobId)
      navigateTo('details')
    },
    [navigateTo],
  )

  const openEdit = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId)
      navigateTo('edit')
    },
    [navigateTo],
  )

  const openCandidatesForJob = useCallback(
    (jobId: string) => {
      if (!permissions.canViewCandidates) {
        showToast('You do not have access to candidate management.', 'error')
        return
      }
      setSelectedCandidateJobId(jobId)
      setSelectedCandidateId(null)
      navigateTo('candidate-list')
    },
    [navigateTo, permissions.canViewCandidates, showToast],
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
        navigateTo('list')
      }}
      onShowDashboard={() => navigateTo('dashboard')}
      onShowCandidates={() => {
        if (!permissions.canViewCandidates) {
          showToast('Your role has no access to Candidates module.', 'error')
          return
        }
        setSelectedCandidateJobId(null)
        navigateTo('candidate-list')
      }}
      onShowUsers={() => {
        if (!permissions.canManageUsers) {
          showToast('Only Super Admin can access users and roles.', 'error')
          return
        }
        navigateTo('users')
      }}
      activeNav={view === 'dashboard' ? 'dashboard' : view === 'users' ? 'users' : view.startsWith('candidate') ? 'candidates' : 'jobs'}
      logoSrc={appLogo}
      role={normalizedRole}
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
          onCreate={() => (permissions.canCreateJob ? navigateTo('create') : showToast('You do not have access to create jobs.', 'error'))}
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
        <CreateJobPage saving={saving} error={actionError} onCancel={() => navigateTo('list')} onSubmit={handleCreate} />
      )}
      {view === 'details' && (
        <JobDetailsPage
          job={selectedJob}
          loading={detailsLoading}
          error={actionError}
          onBack={() => navigateTo('list')}
          onEdit={() => navigateTo('edit')}
          onManageCandidates={openCandidatesForJob}
          canEditJob={permissions.canEditJob}
        />
      )}
      {view === 'edit' && permissions.canEditJob && (
        <EditJobPage
          job={selectedJob}
          loading={detailsLoading}
          saving={saving}
          error={actionError}
          onBack={() => navigateTo('details')}
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
          onAddCandidate={() =>
            permissions.canCreateCandidate ? navigateTo('candidate-add') : showToast('You do not have access to add candidates.', 'error')
          }
          onViewCandidate={(candidateId) => {
            setSelectedCandidateId(candidateId)
            navigateTo('candidate-details')
          }}
          onEditCandidate={(candidateId) => {
            setSelectedCandidateId(candidateId)
            navigateTo('candidate-details')
          }}
        />
      )}
      {view === 'candidate-add' && permissions.canCreateCandidate && (
        <AddCandidatePage
          jobs={jobs}
          initialJobId={selectedCandidateJobId}
          onBack={() => navigateTo('candidate-list')}
          onCreated={(candidateId) => {
            setSelectedCandidateId(candidateId)
            navigateTo('candidate-details')
          }}
        />
      )}
      {view === 'candidate-details' && selectedCandidateId && (
        <CandidateDetailPage
          candidateId={selectedCandidateId}
          jobs={jobs}
          onBack={() => navigateTo('candidate-list')}
          canEdit={permissions.canEditCandidate}
          canManageStage={permissions.canManageCandidateStage}
        />
      )}
      {view === 'users' && permissions.canManageUsers && (
        <UserManagementPage role={normalizedRole} onRbacPolicyUpdated={() => setRbacVersion((prev) => prev + 1)} />
      )}
    </Layout>
  )
}

export default AppRoutes
