import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JobRecord, JobStatus } from '../../features/jobs/jobTypes'
import { formatDisplayDateIN } from '../../utils/dateUtils'
import { SkeletonRows } from '../../components/common/Loader'
import Pagination from '../../components/common/Pagination'

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
  onManageCandidates: (jobId: string) => void
  onDelete: (jobId: string) => void
  onStatusChange: (job: JobRecord, status: JobStatus) => void
  busyJobId: string | null
  canCreateJob?: boolean
  canEditJob?: boolean
  canDeleteJob?: boolean
}

const STATUS_OPTIONS: Array<{ value: JobStatus; label: string }> = [
  { value: 'Open', label: 'Open' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Filled', label: 'Filled' },
  { value: 'Cancelled', label: 'Canceled' },
]

function statusClassName(jobStatus: JobStatus) {
  if (jobStatus === 'Open') return 'is-open'
  if (jobStatus === 'On Hold') return 'is-hold'
  if (jobStatus === 'Filled') return 'is-filled'
  if (jobStatus === 'Cancelled') return 'is-cancelled'
  return 'is-closed'
}

function statusLabel(jobStatus: JobStatus): string {
  return jobStatus === 'Cancelled' ? 'Canceled' : jobStatus
}

function getPreviousStatus(current: JobStatus): JobStatus | null {
  const sequence = STATUS_OPTIONS.map((item) => item.value)
  const index = sequence.indexOf(current)
  if (index <= 0) return null
  return sequence[index - 1]
}

function getNextStatus(current: JobStatus): JobStatus | null {
  const sequence = STATUS_OPTIONS.map((item) => item.value)
  const index = sequence.indexOf(current)
  if (index < 0 || index >= sequence.length - 1) return null
  return sequence[index + 1]
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

function isExpired(targetClosureDate?: string): boolean {
  if (!targetClosureDate) return false
  const target = startOfDay(new Date(targetClosureDate))
  if (Number.isNaN(target.getTime())) return false
  const today = startOfDay(new Date())
  return target.getTime() < today.getTime()
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
  onManageCandidates,
  onDelete,
  onStatusChange,
  busyJobId,
  canCreateJob = true,
  canEditJob = true,
  canDeleteJob = true,
}: JobListPageProps) {
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [dragJobId, setDragJobId] = useState<string | null>(null)
  const [dropStatus, setDropStatus] = useState<JobStatus | null>(null)
  const [listPage, setListPage] = useState(1)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<JobStatus>('Open')
  const LIST_PAGE_SIZE = 8
  const departments = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.department))).sort((a, b) => a.localeCompare(b)),
    [jobs],
  )

  useEffect(() => {
    setListPage(1)
  }, [jobs.length, sortDirection])

  useEffect(() => {
    setSelectedJobIds((prev) => {
      if (prev.size === 0) return prev
      const valid = new Set(jobs.map((job) => job.id))
      const next = new Set<string>()
      prev.forEach((key) => {
        if (valid.has(key)) next.add(key)
      })
      return next.size === prev.size ? prev : next
    })
  }, [jobs])

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

  const editableStatusOptions = useMemo(() => STATUS_OPTIONS.filter((status) => status.value !== 'Filled'), [])

  const sortedJobs = useMemo(() => {
    const sorted = [...jobs].sort((first, second) => (first.title || '').localeCompare(second.title || ''))
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [jobs, sortDirection])

  const pageCount = Math.max(1, Math.ceil(sortedJobs.length / LIST_PAGE_SIZE))
  const safePage = Math.min(listPage, pageCount)
  const pagedJobs = useMemo(() => {
    const start = (safePage - 1) * LIST_PAGE_SIZE
    return sortedJobs.slice(start, start + LIST_PAGE_SIZE)
  }, [safePage, sortedJobs])

  const selectedCount = selectedJobIds.size
  const allSelected = sortedJobs.length > 0 && selectedCount === sortedJobs.length

  const selectedRows = useMemo(
    () => sortedJobs.filter((job) => selectedJobIds.has(job.id)),
    [selectedJobIds, sortedJobs],
  )

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedJobIds(new Set())
      return
    }
    setSelectedJobIds(new Set(sortedJobs.map((job) => job.id)))
  }

  function toggleSelectOne(jobId: string, checked: boolean) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(jobId)
      else next.delete(jobId)
      return next
    })
  }

  function applyBulkStatusChange() {
    if (!canEditJob || selectedRows.length === 0) return
    selectedRows.forEach((job) => onStatusChange(job, bulkStatus))
    setSelectedJobIds(new Set())
  }

  return (
    <div className="job-management-layout">
      <section className="page-head">
        <div>
          <p className="breadcrumb">Jobs / Management</p>
          <h1>Job Management</h1>
          <p className="subtitle">Centralized hub for tracking all organizational recruitment pipelines.</p>
        </div>
        <div className="page-head__actions">
          {viewMode === 'list' && (
            <div className="candidate-toolbar-inline">
              <button
                type="button"
                className="ghost-btn"
                aria-label="Sort ascending"
                title="Sort ascending"
                onClick={() => setSortDirection('asc')}
                disabled={sortDirection === 'asc'}
              >
                <span className="material-symbols-rounded">north</span>
              </button>
              <button
                type="button"
                className="ghost-btn"
                aria-label="Sort descending"
                title="Sort descending"
                onClick={() => setSortDirection('desc')}
                disabled={sortDirection === 'desc'}
              >
                <span className="material-symbols-rounded">south</span>
              </button>
            </div>
          )}
          {viewMode === 'list' && canEditJob && selectedCount > 0 && (
            <div className="candidate-toolbar-inline">
              <span>{selectedCount} selected</span>
              <select
                className={`candidate-toolbar-select table-action--status ${statusClassName(bulkStatus)}`}
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as JobStatus)}
              >
                {editableStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button type="button" className="ghost-btn" onClick={applyBulkStatusChange}>
                Apply
              </button>
            </div>
          )}
          <button type="button" className="ghost-btn" onClick={() => setViewMode((prev) => (prev === 'list' ? 'board' : 'list'))}>
            <span className="material-symbols-rounded">{viewMode === 'list' ? 'view_kanban' : 'table_rows'}</span>
            <span>{viewMode === 'list' ? 'Board View' : 'List View'}</span>
          </button>
          <button type="button" className="ghost-btn" onClick={handleExportExcel}>
            <span className="material-symbols-rounded">download</span>
            <span>Export Excel</span>
          </button>
          <button type="button" className="ghost-btn" onClick={handleExportPdf}>
            <span className="material-symbols-rounded">picture_as_pdf</span>
            <span>Export PDF</span>
          </button>
          {canCreateJob && (
            <button type="button" className="primary-btn" onClick={onCreate}>
              <span className="material-symbols-rounded">add</span>
              <span>Create New Job</span>
            </button>
          )}
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

      {viewMode === 'list' && <section className="table-panel">
        {loading && (
          <div style={{ padding: '0.8rem' }}>
            <p className="panel-message">Loading jobs...</p>
            <div style={{ padding: '0.4rem 0' }}>
              <SkeletonRows rows={8} />
            </div>
          </div>
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
            {canCreateJob && (
              <button type="button" className="primary-btn" onClick={onCreate}>
                <span className="material-symbols-rounded">add</span>
                <span>Create First Job</span>
              </button>
            )}
          </div>
        )}
        {!loading && !error && jobs.length > 0 && (
          <>
            <div className="table-footer" style={{ borderBottom: 'none', paddingBottom: '0.4rem' }}>
              <p>
                Showing <strong>{sortedJobs.length}</strong> jobs
              </p>
            </div>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th style={{ width: '48px' }}>
                      <input
                        type="checkbox"
                        className="table-checkbox"
                        checked={allSelected}
                        onChange={(event) => toggleSelectAll(event.target.checked)}
                        aria-label="Select all jobs"
                      />
                    </th>
                    <th>Job Title & ID</th>
                    <th>Department</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Openings</th>
                    <th style={{ textAlign: 'center' }}>Candidates Applied</th>
                    <th style={{ textAlign: 'center' }}>Expires In</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedJobs.map((job) => {
                    const ratio = job.openings === 0 ? 0 : Math.round((job.filled / job.openings) * 100)
                    return (
                      <tr key={job.id}>
                        <td>
                          <input
                            type="checkbox"
                            className="table-checkbox"
                            checked={selectedJobIds.has(job.id)}
                            onChange={(event) => toggleSelectOne(job.id, event.target.checked)}
                            aria-label={`Select ${job.title}`}
                          />
                        </td>
                        <td>
                          <strong>{job.title || 'Untitled Job'}</strong>
                          <div>{job.reqId || 'ID pending'}</div>
                        </td>
                        <td>{job.department}</td>
                        <td style={{ textAlign: 'center' }}>
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
                        <td style={{ textAlign: 'center' }}>{job.candidatesApplied}</td>
                        <td style={{ textAlign: 'center' }}>{getExpiryLabel(job.targetClosureDate)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="actions-cell">
                            <button
                              type="button"
                              className="table-action"
                              disabled={busyJobId === job.id || isExpired(job.targetClosureDate)}
                              onClick={() => onManageCandidates(job.id)}
                            >
                              <span className="material-symbols-rounded">group</span>
                              <span>Candidates</span>
                            </button>
                            <button type="button" className="table-action" disabled={busyJobId === job.id} onClick={() => onView(job.id)}>
                              <span className="material-symbols-rounded">visibility</span>
                              <span>View</span>
                            </button>
                            {canEditJob && (
                              <>
                                <button
                                  type="button"
                                  className="table-action"
                                  disabled={busyJobId === job.id || isExpired(job.targetClosureDate)}
                                  onClick={() => onEdit(job.id)}
                                >
                                  <span className="material-symbols-rounded">edit</span>
                                  <span>Edit</span>
                                </button>
                                <select
                                  className={`table-action table-action--status ${statusClassName(job.status)}`}
                                  aria-label={`Update status for ${job.title || 'job'}`}
                                  value={job.status}
                                  disabled={busyJobId === job.id || isExpired(job.targetClosureDate)}
                                  onChange={(event) => onStatusChange(job, event.target.value as JobStatus)}
                                >
                                  {job.status === 'Filled' && (
                                    <option value="Filled" disabled>
                                      Filled
                                    </option>
                                  )}
                                  {editableStatusOptions.map((status) => (
                                    <option key={status.value} value={status.value}>
                                      {status.label}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}
                            {canDeleteJob && (
                              <button
                                type="button"
                                className="table-action table-action--danger"
                                disabled={busyJobId === job.id}
                                onClick={() => onDelete(job.id)}
                              >
                                <span className="material-symbols-rounded">delete</span>
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setListPage} />
            </div>
          </>
        )}
      </section>}

      {!loading && !error && viewMode === 'board' && (
        <section className="candidate-board">
          {STATUS_OPTIONS.map((statusItem) => {
            const status = statusItem.value
            const statusJobs = jobs.filter((job) => job.status === status)

            return (
              <article
                key={status}
                className={`candidate-column candidate-column--${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onDragOver={(event) => {
                  if (!canEditJob) return
                  event.preventDefault()
                  setDropStatus(status)
                }}
                onDragLeave={() => setDropStatus((prev) => (prev === status ? null : prev))}
                onDrop={(event) => {
                  if (!canEditJob) return
                  event.preventDefault()
                  if (dragJobId) {
                    const dragged = jobs.find((job) => job.id === dragJobId)
                    if (dragged && dragged.status !== status) {
                      onStatusChange(dragged, status)
                    }
                  }
                  setDragJobId(null)
                  setDropStatus(null)
                }}
                data-drop-target={dropStatus === status ? 'true' : 'false'}
              >
                <h3>
                  <span>{statusLabel(status)}</span>
                  <small>{statusJobs.length}</small>
                </h3>
                <div className="candidate-column__list job-board__list">
                  {statusJobs.map((job) => {
                    const previousStatus = getPreviousStatus(job.status)
                    const nextStatus = getNextStatus(job.status)
                    return (
                    <article
                      key={job.id}
                      className="candidate-card"
                      draggable={canEditJob && !isExpired(job.targetClosureDate)}
                      onDragStart={() => setDragJobId(job.id)}
                      onDragEnd={() => {
                        setDragJobId(null)
                        setDropStatus(null)
                      }}
                    >
                      <div className="candidate-card__row">
                        <strong>{job.title}</strong>
                        <span>{job.reqId}</span>
                      </div>
                      <small>{job.department}</small>
                      <div className="candidate-card__quick-actions">
                        {previousStatus && (
                          <button
                            type="button"
                            className="candidate-card__quick-btn"
                            disabled={isExpired(job.targetClosureDate)}
                            onClick={() => onStatusChange(job, previousStatus)}
                            aria-label={`Move ${job.title} back to ${statusLabel(previousStatus)}`}
                          >
                            <span aria-hidden="true">←</span>
                          </button>
                        )}
                        <button type="button" className="candidate-card__quick-btn" onClick={() => onView(job.id)} aria-label={`View ${job.title}`}>
                          <span className="material-symbols-rounded" aria-hidden="true">visibility</span>
                        </button>
                        {canEditJob && (
                          <button
                            type="button"
                            className="candidate-card__quick-btn"
                            disabled={isExpired(job.targetClosureDate)}
                            onClick={() => onEdit(job.id)}
                            aria-label={`Edit ${job.title}`}
                          >
                            <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="candidate-card__quick-btn"
                          disabled={isExpired(job.targetClosureDate)}
                          onClick={() => onManageCandidates(job.id)}
                          aria-label={`Manage candidates for ${job.title}`}
                        >
                          <span className="material-symbols-rounded" aria-hidden="true">group</span>
                        </button>
                        {nextStatus && (
                          <button
                            type="button"
                            className="candidate-card__quick-btn"
                            disabled={isExpired(job.targetClosureDate)}
                            onClick={() => onStatusChange(job, nextStatus)}
                            aria-label={`Move ${job.title} forward to ${statusLabel(nextStatus)}`}
                          >
                            <span aria-hidden="true">→</span>
                          </button>
                        )}
                      </div>
                    </article>
                    )
                  })}
                  {statusJobs.length === 0 && <p className="candidate-column__empty">No jobs in this stage.</p>}
                </div>
              </article>
            )
          })}
        </section>
      )}

    </div>
  )
}

export default JobListPage
