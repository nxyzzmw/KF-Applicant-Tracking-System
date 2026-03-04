import { useCallback, useMemo } from 'react'
import type { JobRecord, JobStatus } from '../../features/jobs/jobTypes'
import { formatDisplayDateIN } from '../../utils/dateUtils'
import DataTable, { type TableColumn } from '../../components/common/Table'
import { SkeletonRows } from '../../components/common/Loader'

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
  onManageCandidates,
  onDelete,
  onStatusChange,
  busyJobId,
  canCreateJob = true,
  canEditJob = true,
  canDeleteJob = true,
}: JobListPageProps) {
  const departments = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.department))).sort((a, b) => a.localeCompare(b)),
    [jobs],
  )

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

  const columns: Array<TableColumn<JobRecord>> = useMemo(
    () => [
      {
        id: 'title',
        header: 'Job Title & ID',
        sortable: true,
        accessor: (row) => `${row.title || 'Untitled Job'} ${row.reqId || 'ID pending'}`,
        cell: (row) => (
          <>
            <strong>{row.title || 'Untitled Job'}</strong>
            <span>{row.reqId || 'ID pending'}</span>
          </>
        ),
      },
      {
        id: 'department',
        header: 'Department',
        sortable: true,
        accessor: (row) => row.department,
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        accessor: (row) => row.status,
        align: 'center',
        cell: (row) => <span className={`job-status ${statusClassName(row.status)}`}>{statusLabel(row.status)}</span>,
      },
      {
        id: 'openings',
        header: 'Openings',
        sortable: true,
        accessor: (row) => `${row.filled}/${row.openings}`,
        cell: (row) => {
          const ratio = row.openings === 0 ? 0 : Math.round((row.filled / row.openings) * 100)
          return (
            <div className="openings-cell">
              <p>
                {row.filled}/{row.openings} Filled
              </p>
              <div className="progress-track">
                <span style={{ width: `${ratio}%` }} />
              </div>
              <small>{ratio}%</small>
            </div>
          )
        },
      },
      {
        id: 'candidatesApplied',
        header: 'Candidates Applied',
        sortable: true,
        accessor: (row) => row.candidatesApplied,
        align: 'center',
      },
      {
        id: 'expiresIn',
        header: 'Expires In',
        sortable: true,
        accessor: (row) => getExpiryLabel(row.targetClosureDate),
        align: 'center',
        cell: (row) => getExpiryLabel(row.targetClosureDate),
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        cell: (row) => (
          <div className="actions-cell">
            <button type="button" className="table-action" disabled={busyJobId === row.id} onClick={() => onManageCandidates(row.id)}>
              <span className="material-symbols-rounded">group</span>
              <span>Candidates</span>
            </button>
            <button type="button" className="table-action" disabled={busyJobId === row.id} onClick={() => onView(row.id)}>
              <span className="material-symbols-rounded">visibility</span>
              <span>View</span>
            </button>
            {canEditJob && (
              <>
                <button type="button" className="table-action" disabled={busyJobId === row.id} onClick={() => onEdit(row.id)}>
                  <span className="material-symbols-rounded">edit</span>
                  <span>Edit</span>
                </button>
                <select
                  className={`table-action table-action--status ${statusClassName(row.status)}`}
                  aria-label={`Update status for ${row.title || 'job'}`}
                  value={row.status}
                  disabled={busyJobId === row.id}
                  onChange={(event) => onStatusChange(row, event.target.value as JobStatus)}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {canDeleteJob && (
              <button type="button" className="table-action table-action--danger" disabled={busyJobId === row.id} onClick={() => onDelete(row.id)}>
                <span className="material-symbols-rounded">delete</span>
                <span>Delete</span>
              </button>
            )}
          </div>
        ),
      },
    ],
    [busyJobId, canDeleteJob, canEditJob, onDelete, onEdit, onManageCandidates, onStatusChange, onView],
  )

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

      <section className="table-panel">
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
                Showing <strong>{jobs.length}</strong> jobs
              </p>
            </div>
            <DataTable
              rows={jobs}
              rowKey={(row) => row.id}
              columns={columns}
              pageSize={8}
              selectable
              bulkActions={
                canEditJob
                  ? [
                      {
                        label: 'Mark Open',
                        onClick: (rows) => rows.forEach((row) => onStatusChange(row, 'Open')),
                      },
                      {
                        label: 'Mark On Hold',
                        onClick: (rows) => rows.forEach((row) => onStatusChange(row, 'On Hold')),
                      },
                    ]
                  : []
              }
            />
          </>
        )}
      </section>

    </>
  )
}

export default JobListPage
