import { useCallback, useEffect, useRef, useState } from 'react'
import Layout from '../components/layout/Layout'
import appLogo from '../assets/kf-logo.png'
import { apiRequest } from '../services/axiosInstance'
import { createJob, deleteJob, getJobById, getJobs, updateJob, updateJobStatus } from '../features/jobs/jobsAPI'
import type { JobFormValues, JobRecord, JobStatus } from '../features/jobs/jobTypes'
import { toApiDateValue } from '../utils/dateUtils'
import CreateJobPage from '../pages/jobs/CreateJobPage'
import EditJobPage from '../pages/jobs/EditJobPage'
import JobDetailsPage from '../pages/jobs/JobDetailsPage'
import JobListPage from '../pages/jobs/JobListPage'

type JobView = 'list' | 'create' | 'details' | 'edit'
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

const AUTH_ME_ENDPOINT = import.meta.env.VITE_AUTH_ME_ENDPOINT ?? ''

function nextStatus(status: JobStatus): JobStatus {
  if (status === 'Open') return 'On Hold'
  if (status === 'On Hold') return 'Closed'
  return 'Open'
}

function generateTempReqId(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `REQ-${yy}${mm}${dd}-${rand}`
}

function toApiPayload(values: JobFormValues) {
  const salaryRange = `${Number(values.salaryMin) || 0}-${Number(values.salaryMax) || 0}`
  const reqId = generateTempReqId()
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
    reqId,
    requisitionId: reqId,
  }
}

function AppRoutes({ onInitialDataReady, onNavigationLoadingChange }: AppRoutesProps) {
  const [view, setView] = useState<JobView>('list')
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [sidebarRole, setSidebarRole] = useState<string>('HR Recruiter')
  const hasReportedInitialLoadRef = useRef(false)

  const navigateTo = useCallback((nextView: JobView) => {
    onNavigationLoadingChange?.(true)
    setActionError(null)
    setView(nextView)
    window.setTimeout(() => onNavigationLoadingChange?.(false), 520)
  }, [onNavigationLoadingChange])

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const result = await getJobs()
      setJobs(result)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load jobs'
      setListError(message)
    } finally {
      setLoading(false)
      if (!hasReportedInitialLoadRef.current) {
        onInitialDataReady?.()
        hasReportedInitialLoadRef.current = true
      }
    }
  }, [onInitialDataReady])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (!AUTH_ME_ENDPOINT) return
    let isMounted = true

    async function loadUserRole() {
      try {
        const profile = await apiRequest<UserProfileResponse>(AUTH_ME_ENDPOINT)
        const fetchedRole = profile.role ?? profile.user?.role
        if (isMounted && fetchedRole && fetchedRole.trim().length > 0) {
          setSidebarRole(fetchedRole)
        }
      } catch {
        // Keep fallback role so app remains usable before auth module integration.
      }
    }

    void loadUserRole()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedJobId || (view !== 'details' && view !== 'edit')) return
    const jobId = selectedJobId
    let isMounted = true

    async function loadDetails() {
      setDetailsLoading(true)
      setActionError(null)
      try {
        const result = await getJobById(jobId)
        if (isMounted) setSelectedJob(result)
      } catch (detailsError) {
        const message = detailsError instanceof Error ? detailsError.message : 'Unable to load job details'
        if (isMounted) setActionError(message)
      } finally {
        if (isMounted) setDetailsLoading(false)
      }
    }
    void loadDetails()
    return () => {
      isMounted = false
    }
  }, [selectedJobId, view])

  const handleCreate = useCallback(async (values: JobFormValues) => {
    setSaving(true)
    setActionError(null)
    try {
      const created = await createJob(toApiPayload(values))
      await loadJobs()
      setSelectedJobId(created.id)
      setSelectedJob(created)
      navigateTo('details')
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unable to create job'
      setActionError(message)
    } finally {
      setSaving(false)
    }
  }, [loadJobs, navigateTo])

  const handleUpdate = useCallback(async (values: JobFormValues) => {
    if (!selectedJobId) return
    setSaving(true)
    setActionError(null)
    try {
      const updated = await updateJob(selectedJobId, toApiPayload(values))
      await loadJobs()
      setSelectedJob(updated)
      navigateTo('details')
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update job'
      setActionError(message)
    } finally {
      setSaving(false)
    }
  }, [selectedJobId, loadJobs, navigateTo])

  const handleDelete = useCallback(async (jobId: string) => {
    if (!window.confirm('Soft delete this job?')) return
    setBusyJobId(jobId)
    setActionError(null)
    try {
      await deleteJob(jobId)
      await loadJobs()
      if (selectedJobId === jobId) {
        setSelectedJobId(null)
        setSelectedJob(null)
        navigateTo('list')
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete job'
      setActionError(message)
    } finally {
      setBusyJobId(null)
    }
  }, [loadJobs, navigateTo, selectedJobId])

  const handleStatusChange = useCallback(async (job: JobRecord) => {
    setBusyJobId(job.id)
    setActionError(null)
    try {
      const updated = await updateJobStatus(job.id, nextStatus(job.status))
      setJobs((prev) => prev.map((item) => (item.id === job.id ? updated : item)))
      if (selectedJobId === job.id) setSelectedJob(updated)
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : 'Unable to update job status'
      setActionError(message)
    } finally {
      setBusyJobId(null)
    }
  }, [selectedJobId])

  const openDetails = useCallback((jobId: string) => {
    setSelectedJobId(jobId)
    navigateTo('details')
  }, [navigateTo])

  const openEdit = useCallback((jobId: string) => {
    setSelectedJobId(jobId)
    navigateTo('edit')
  }, [navigateTo])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('role')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('refreshToken')
    window.location.reload()
  }, [])

  return (
    <Layout onShowJobs={() => navigateTo('list')} logoSrc={appLogo} role={sidebarRole} onLogout={handleLogout}>
      {view === 'list' && (
        <JobListPage
          jobs={jobs}
          loading={loading}
          error={listError}
          onRetry={() => void loadJobs()}
          onCreate={() => navigateTo('create')}
          onView={openDetails}
          onEdit={openEdit}
          onDelete={(jobId) => void handleDelete(jobId)}
          onStatusChange={(job) => void handleStatusChange(job)}
          busyJobId={busyJobId}
        />
      )}
      {view === 'create' && <CreateJobPage saving={saving} error={actionError} onCancel={() => navigateTo('list')} onSubmit={handleCreate} />}
      {view === 'details' && (
        <JobDetailsPage
          job={selectedJob}
          loading={detailsLoading}
          error={actionError}
          onBack={() => navigateTo('list')}
          onEdit={() => navigateTo('edit')}
        />
      )}
      {view === 'edit' && (
        <EditJobPage
          job={selectedJob}
          loading={detailsLoading}
          saving={saving}
          error={actionError}
          onBack={() => navigateTo('details')}
          onSubmit={handleUpdate}
        />
      )}
    </Layout>
  )
}

export default AppRoutes
