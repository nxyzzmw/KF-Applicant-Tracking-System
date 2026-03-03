import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JobRecord, JobStatus } from '../../features/jobs/jobTypes'
import { formatDayCountLabel, formatDisplayDateIN } from '../../utils/dateUtils'

type JobListPageProps = {
  jobs: JobRecord[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onCreate: () => void
  onView: (jobId: string) => void
  onEdit: (jobId: string) => void
  onDelete: (jobId: string) => void
  onStatusChange: (job: JobRecord) => void
  busyJobId: string | null
}

const PAGE_SIZE = 5

function statusClassName(status: JobStatus) {
  if (status === 'Open') return 'is-open'
  if (status === 'On Hold') return 'is-hold'
  if (status === 'Filled') return 'is-filled'
  if (status === 'Cancelled') return 'is-cancelled'
  return 'is-closed'
}

function formatShortDate(value?: string): string {
  return formatDisplayDateIN(value, 'No target date')
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function JobListPage({
  jobs,
  loading,
  error,
  onRetry,
  onCreate,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  busyJobId,
}: JobListPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const departments = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.department))).sort((a, b) => a.localeCompare(b)),
    [jobs],
  )

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return jobs.filter((job) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        job.title.toLowerCase().includes(normalizedSearch) ||
        job.reqId.toLowerCase().includes(normalizedSearch) ||
        job.department.toLowerCase().includes(normalizedSearch)

      const matchesDepartment = departmentFilter === 'all' || job.department === departmentFilter
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter
      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [jobs, searchTerm, departmentFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, departmentFilter, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagedJobs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredJobs.slice(start, start + PAGE_SIZE)
  }, [filteredJobs, currentPage])

  const stats = useMemo(() => {
    const totalActiveJobs = jobs.filter((job) => job.status === 'Open').length
    const totalOpenings = jobs.reduce((sum, job) => sum + job.openings, 0)
    const averageAging =
      jobs.length === 0 ? 0 : Math.round(jobs.reduce((sum, job) => sum + job.agingDays, 0) / jobs.length)
    const totalFilled = jobs.reduce((sum, job) => sum + job.filled, 0)
    const fillRate = totalOpenings === 0 ? 0 : Math.round((totalFilled / totalOpenings) * 100)
    return { totalActiveJobs, totalOpenings, averageAging, fillRate }
  }, [jobs])

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setDepartmentFilter('all')
    setStatusFilter('all')
  }, [])

  const goPrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1))
  }, [])

  const goNextPage = useCallback(() => {
    setPage((prev) => Math.min(pageCount, prev + 1))
  }, [pageCount])

  const overview = useMemo(() => {
    const now = startOfDay(new Date())
    const daysAhead7 = new Date(now)
    daysAhead7.setDate(now.getDate() + 7)

    const openCount = jobs.filter((job) => job.status === 'Open').length
    const holdCount = jobs.filter((job) => job.status === 'On Hold').length
    const closedCount = jobs.filter((job) => job.status === 'Closed').length
    const filledCount = jobs.filter((job) => job.status === 'Filled').length
    const cancelledCount = jobs.filter((job) => job.status === 'Cancelled').length
    const openPipelineJobs = jobs.filter((job) => !['Closed', 'Filled', 'Cancelled'].includes(job.status))
    const urgentAging = [...openPipelineJobs]
      .filter((job) => job.agingDays >= 7)
      .sort((a, b) => b.agingDays - a.agingDays)
      .slice(0, 3)
    const upcomingClosures = jobs
      .filter((job) => {
        if (!job.targetClosureDate) return false
        const target = startOfDay(new Date(job.targetClosureDate))
        return !Number.isNaN(target.getTime()) && target >= now && target <= daysAhead7
      })
      .sort((a, b) => new Date(a.targetClosureDate ?? '').getTime() - new Date(b.targetClosureDate ?? '').getTime())
      .slice(0, 5)
    const overdueClosures = openPipelineJobs
      .filter((job) => {
        if (!job.targetClosureDate) return false
        const target = startOfDay(new Date(job.targetClosureDate))
        return !Number.isNaN(target.getTime()) && target < now
      })
      .sort((a, b) => new Date(a.targetClosureDate ?? '').getTime() - new Date(b.targetClosureDate ?? '').getTime())
      .slice(0, 2)
    const missingTargetDates = openPipelineJobs.filter((job) => !job.targetClosureDate).slice(0, 2)

    const pendingOpenings = jobs.reduce((sum, job) => sum + Math.max(job.openings - job.filled, 0), 0)
    const totalFilled = jobs.reduce((sum, job) => sum + job.filled, 0)

    const departmentMap = new Map<string, { roles: number; openings: number }>()
    jobs.forEach((job) => {
      const entry = departmentMap.get(job.department) ?? { roles: 0, openings: 0 }
      entry.roles += 1
      entry.openings += Math.max(job.openings - job.filled, 0)
      departmentMap.set(job.department, entry)
    })
    const departments = Array.from(departmentMap.entries())
      .map(([department, values]) => ({ department, ...values }))
      .sort((a, b) => b.openings - a.openings)
      .slice(0, 5)

    return {
      openCount,
      holdCount,
      closedCount,
      filledCount,
      cancelledCount,
      urgentAging,
      upcomingClosures,
      overdueClosures,
      missingTargetDates,
      pendingOpenings,
      totalFilled,
      departments,
    }
  }, [jobs])

  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Jobs / Management</p>
          <h1>Job Management</h1>
          <p className="subtitle">Centralized hub for tracking all organizational recruitment pipelines.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="ghost-btn">
            <span className="material-symbols-rounded">download</span>
            <span>Export CSV</span>
          </button>
          <button type="button" className="primary-btn" onClick={onCreate}>
            <span className="material-symbols-rounded">add</span>
            <span>Create New Job</span>
          </button>
        </div>
      </section>

      <section className="filters-panel">
        <input
          type="search"
          placeholder="Search by title, department or ID..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select value={departmentFilter} aria-label="Department" onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="all">Department</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        <select value={statusFilter} aria-label="Status" onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Status</option>
          <option value="Open">Open</option>
          <option value="On Hold">On Hold</option>
          <option value="Closed">Closed</option>
          <option value="Filled">Filled</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <button
          type="button"
          className="ghost-btn clear-btn"
          onClick={clearFilters}
        >
          Clear All
        </button>
      </section>

      <section className="table-panel">
        {loading && (
          <>
            <p className="panel-message">Loading jobs...</p>
            <div className="skeleton-table" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton-row">
                  <span className="skeleton-block w-24" />
                  <span className="skeleton-block w-14" />
                  <span className="skeleton-block w-12" />
                  <span className="skeleton-block w-20" />
                  <span className="skeleton-block w-14" />
                  <span className="skeleton-block w-22" />
                </div>
              ))}
            </div>
          </>
        )}
        {error && (
          <p className="panel-message panel-message--error">
            {error} <button onClick={onRetry}>Retry</button>
          </p>
        )}
        {!loading && !error && filteredJobs.length === 0 && (
          <div className="empty-state">
            <h3>No Data Available</h3>
            <p>No job records. Create your first requisition to get started.</p>
            <button type="button" className="primary-btn" onClick={onCreate}>
              <span className="material-symbols-rounded">add</span>
              <span>Create First Job</span>
            </button>
          </div>
        )}
        {!loading && (
          <table>
          <thead>
            <tr>
              <th>Job Title & ID</th>
              <th>Department</th>
              <th>Status</th>
              <th>Openings</th>
              <th>Aging</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedJobs.map((job) => {
              const ratio = job.openings === 0 ? 0 : Math.round((job.filled / job.openings) * 100)
              return (
                <tr key={job.id}>
                  <td>
                    <strong>{job.title || 'Untitled Job'}</strong>
                    <span>{job.reqId || 'ID pending'}</span>
                  </td>
                  <td>{job.department}</td>
                  <td>
                    <span className={`job-status ${statusClassName(job.status)}`}>{job.status}</span>
                  </td>
                  <td>
                    <div className="openings-cell">
                      <p>
                        {job.filled}/{job.openings} Filled
                      </p>
                      <div className="progress-track">
                        <span style={{ width: `${ratio}%` }} />
                      </div>
                      <small>{ratio}%</small>
                    </div>
                  </td>
                  <td>{formatDayCountLabel(job.agingDays)}</td>
                  <td className="actions-cell">
                    <button type="button" className="table-action" disabled={busyJobId === job.id} onClick={() => onView(job.id)}>
                      <span className="material-symbols-rounded">visibility</span>
                      <span>View</span>
                    </button>
                    <button type="button" className="table-action" disabled={busyJobId === job.id} onClick={() => onEdit(job.id)}>
                      <span className="material-symbols-rounded">edit</span>
                      <span>Edit</span>
                    </button>
                    <button type="button" className="table-action" disabled={busyJobId === job.id} onClick={() => onStatusChange(job)}>
                      <span className="material-symbols-rounded">sync</span>
                      <span>Status</span>
                    </button>
                    <button
                      type="button"
                      className="table-action table-action--danger"
                      disabled={busyJobId === job.id}
                      onClick={() => onDelete(job.id)}
                    >
                      <span className="material-symbols-rounded">delete</span>
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
        )}

        {!loading && filteredJobs.length > 0 && (
          <div className="table-footer">
          <p>
            Showing <strong>{filteredJobs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * PAGE_SIZE, filteredJobs.length)}</strong> of <strong>{filteredJobs.length}</strong> jobs
          </p>
          <div className="pagination">
            <button type="button" className="ghost-btn" disabled={currentPage === 1} onClick={goPrevPage}>
              Prev
            </button>
            <button type="button" className="page-active">
              {currentPage}
            </button>
            <button type="button" className="ghost-btn" disabled={currentPage >= pageCount} onClick={goNextPage}>
              Next
            </button>
          </div>
          </div>
        )}
      </section>

      <section className="stats-grid">
        <article>
          <p>
            <span className="material-symbols-rounded">query_stats</span>
            <span>Total Active Jobs</span>
          </p>
          <h3>{stats.totalActiveJobs}</h3>
          <small>Live from API</small>
        </article>
        <article>
          <p>
            <span className="material-symbols-rounded">groups</span>
            <span>Total Openings</span>
          </p>
          <h3>{stats.totalOpenings}</h3>
          <small>Across all requisitions</small>
        </article>
        <article>
          <p>
            <span className="material-symbols-rounded">schedule</span>
            <span>Avg. Time to Hire</span>
          </p>
          <h3>{stats.averageAging} Days</h3>
          <small className="negative">Based on created date</small>
        </article>
        <article>
          <p>
            <span className="material-symbols-rounded">check_circle</span>
            <span>Fill Rate</span>
          </p>
          <h3>{stats.fillRate}%</h3>
          <small>Filled vs total openings</small>
        </article>
      </section>

      <section className="overview-grid">
        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">monitoring</span>
            <span>Pipeline Status</span>
          </h3>
          <div className="status-split">
            <div>
              <span>Open</span>
              <strong>{overview.openCount}</strong>
            </div>
            <div>
              <span>On Hold</span>
              <strong>{overview.holdCount}</strong>
            </div>
            <div>
              <span>Closed</span>
              <strong>{overview.closedCount}</strong>
            </div>
            <div>
              <span>Filled</span>
              <strong>{overview.filledCount}</strong>
            </div>
            <div>
              <span>Cancelled</span>
              <strong>{overview.cancelledCount}</strong>
            </div>
          </div>
          <p className="overview-note">
            Pending openings: <strong>{overview.pendingOpenings}</strong> | Filled: <strong>{overview.totalFilled}</strong>
          </p>
        </article>

        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">notifications_active</span>
            <span>Priority Alerts</span>
          </h3>
          <ul className="overview-list">
            {overview.urgentAging.length === 0 &&
              overview.upcomingClosures.length === 0 &&
              overview.overdueClosures.length === 0 &&
              overview.missingTargetDates.length === 0 && (
              <li className="overview-list__empty">No urgent alerts right now.</li>
            )}
            {overview.overdueClosures.map((job) => (
              <li key={`overdue-${job.id}`}>
                <span className="material-symbols-rounded">error</span>
                <span>
                  <strong>{job.title}</strong> closure overdue since {formatShortDate(job.targetClosureDate)}
                </span>
              </li>
            ))}
            {overview.urgentAging.slice(0, 3).map((job) => (
              <li key={`urgent-${job.id}`}>
                <span className="material-symbols-rounded">warning</span>
                <span>
                  <strong>{job.title}</strong> is open for {job.agingDays} days
                </span>
              </li>
            ))}
            {overview.upcomingClosures.map((job) => (
              <li key={`closure-${job.id}`}>
                <span className="material-symbols-rounded">event_upcoming</span>
                <span>
                  <strong>{job.title}</strong> closes on {formatShortDate(job.targetClosureDate)}
                </span>
              </li>
            ))}
            {overview.missingTargetDates.map((job) => (
              <li key={`missing-target-${job.id}`}>
                <span className="material-symbols-rounded">event_busy</span>
                <span>
                  <strong>{job.title}</strong> has no target closure date
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">domain</span>
            <span>Department Workload</span>
          </h3>
          <ul className="overview-list overview-list--compact">
            {overview.departments.length === 0 && <li className="overview-list__empty">No department data yet.</li>}
            {overview.departments.map((item) => (
              <li key={item.department}>
                <span>{item.department}</span>
                <span>
                  {item.openings} openings across {item.roles} roles
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  )
}

export default JobListPage
