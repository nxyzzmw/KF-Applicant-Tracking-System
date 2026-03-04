import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JobRecord, JobStatus } from '../../features/jobs/jobTypes'
import { formatDisplayDateIN } from '../../utils/dateUtils'

type JobListPageProps = {
  jobs: JobRecord[]
  loading: boolean
  error: string | null
  searchTerm: string
  departmentFilter: string
  statusFilter: 'all' | JobStatus
  onSearchTermChange: (value: string) => void
  onDepartmentFilterChange: (value: string) => void
  onStatusFilterChange: (value: 'all' | JobStatus) => void
  onClearFilters: () => void
  onRetry: () => void
  onCreate: () => void
  onView: (jobId: string) => void
  onEdit: (jobId: string) => void
  onDelete: (jobId: string) => void
  onStatusChange: (job: JobRecord, status: JobStatus) => void
  busyJobId: string | null
}

const PAGE_SIZE = 5
const STATUS_OPTIONS: Array<{ value: JobStatus; label: string }> = [
  { value: 'Open', label: 'Open' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Filled', label: 'Filled' },
  { value: 'Cancelled', label: 'Canceled' },
]

function statusClassName(status: JobStatus) {
  if (status === 'Open') return 'is-open'
  if (status === 'On Hold') return 'is-hold'
  if (status === 'Filled') return 'is-filled'
  if (status === 'Cancelled') return 'is-cancelled'
  return 'is-closed'
}

function statusLabel(status: JobStatus): string {
  return status === 'Cancelled' ? 'Canceled' : status
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getExpiryLabel(targetClosureDate?: string): string {
  if (!targetClosureDate) return 'No target date'
  const today = startOfDay(new Date())
  const target = startOfDay(new Date(targetClosureDate))
  if (Number.isNaN(target.getTime())) return 'No target date'

  const msPerDay = 1000 * 60 * 60 * 24
  const dayDiff = Math.round((target.getTime() - today.getTime()) / msPerDay)

  if (dayDiff < 0) return 'Expired'
  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Tomorrow'
  return `${dayDiff} days`
}

function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function JobListPage({
  jobs,
  loading,
  error,
  searchTerm,
  departmentFilter,
  statusFilter,
  onSearchTermChange,
  onDepartmentFilterChange,
  onStatusFilterChange,
  onClearFilters,
  onRetry,
  onCreate,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  busyJobId,
}: JobListPageProps) {
  const [page, setPage] = useState(1)

  const departments = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.department))).sort((a, b) => a.localeCompare(b)),
    [jobs],
  )

  useEffect(() => {
    setPage(1)
  }, [searchTerm, departmentFilter, statusFilter])

  const pageCount = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagedJobs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return jobs.slice(start, start + PAGE_SIZE)
  }, [jobs, currentPage])

  const goPrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1))
  }, [])

  const goNextPage = useCallback(() => {
    setPage((prev) => Math.min(pageCount, prev + 1))
  }, [pageCount])

  const handleExportExcel = useCallback(() => {
    const rows = jobs.map((job) => [
      job.reqId || 'ID pending',
      job.title || 'Untitled Job',
      job.department,
      statusLabel(job.status),
      `${job.filled}/${job.openings}`,
      String(job.candidatesApplied),
      getExpiryLabel(job.targetClosureDate),
      formatDisplayDateIN(job.targetClosureDate, 'No target date'),
    ])
    const csvRows = [
      ['Req ID', 'Job Title', 'Department', 'Status', 'Openings', 'Candidates Applied', 'Expires In', 'Target Closure Date'],
      ...rows,
    ].map((row) => row.map((cell) => escapeCsvValue(String(cell))).join(','))

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `jobs-export-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [jobs])

  const handleExportPdf = useCallback(() => {
    const rowsHtml = jobs
      .map((job) => (
        `<tr>
          <td>${escapeHtml(job.reqId || 'ID pending')}</td>
          <td>${escapeHtml(job.title || 'Untitled Job')}</td>
          <td>${escapeHtml(job.department)}</td>
          <td>${escapeHtml(statusLabel(job.status))}</td>
          <td>${escapeHtml(`${job.filled}/${job.openings}`)}</td>
          <td>${escapeHtml(String(job.candidatesApplied))}</td>
          <td>${escapeHtml(getExpiryLabel(job.targetClosureDate))}</td>
          <td>${escapeHtml(formatDisplayDateIN(job.targetClosureDate, 'No target date'))}</td>
        </tr>`
      ))
      .join('')

    const printWindow = window.open('', '_blank', 'width=1100,height=800')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Jobs Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
            h1 { font-size: 20px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Jobs Export (${new Date().toLocaleDateString()})</h1>
          <table>
            <thead>
              <tr>
                <th>Req ID</th>
                <th>Job Title</th>
                <th>Department</th>
                <th>Status</th>
                <th>Openings</th>
                <th>Candidates Applied</th>
                <th>Expires In</th>
                <th>Target Closure Date</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
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
          <button type="button" className="ghost-btn" onClick={handleExportExcel}>
            <span className="material-symbols-rounded">download</span>
            <span>Export Excel</span>
          </button>
          <button type="button" className="ghost-btn" onClick={handleExportPdf}>
            <span className="material-symbols-rounded">picture_as_pdf</span>
            <span>Export PDF</span>
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
          placeholder="Search by title or ID..."
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
        <select value={departmentFilter} aria-label="Department" onChange={(event) => onDepartmentFilterChange(event.target.value)}>
          <option value="all">Department</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        <select value={statusFilter} aria-label="Status" onChange={(event) => onStatusFilterChange(event.target.value as 'all' | JobStatus)}>
          <option value="all">Status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ghost-btn clear-btn"
          onClick={onClearFilters}
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
                  <span className="skeleton-block w-12" />
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
        {!loading && !error && jobs.length === 0 && (
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
                <th>Candidates Applied</th>
                <th>Expires In</th>
                <th className="actions-head">Actions</th>
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
                    <span className={`job-status ${statusClassName(job.status)}`}>{statusLabel(job.status)}</span>
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
                  <td>{job.candidatesApplied}</td>
                  <td>{getExpiryLabel(job.targetClosureDate)}</td>
                  <td className="actions-cell">
                    <button type="button" className="table-action" disabled={busyJobId === job.id} onClick={() => onView(job.id)}>
                      <span className="material-symbols-rounded">visibility</span>
                      <span>View</span>
                    </button>
                    <button type="button" className="table-action" disabled={busyJobId === job.id} onClick={() => onEdit(job.id)}>
                      <span className="material-symbols-rounded">edit</span>
                      <span>Edit</span>
                    </button>
                    <select
                      className={`table-action table-action--status ${statusClassName(job.status)}`}
                      aria-label={`Update status for ${job.title || 'job'}`}
                      value={job.status}
                      disabled={busyJobId === job.id}
                      onChange={(event) => onStatusChange(job, event.target.value as JobStatus)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
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

        {!loading && jobs.length > 0 && (
          <div className="table-footer">
          <p>
            Showing <strong>{jobs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * PAGE_SIZE, jobs.length)}</strong> of <strong>{jobs.length}</strong> jobs
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

    </>
  )
}

export default JobListPage
