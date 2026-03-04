import { useEffect, useMemo, useRef, useState } from 'react'
import type { JobRecord } from '../../features/jobs/jobTypes'
import {
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_OPTIONS,
  type CandidateRecord,
  type CandidateStatus,
} from '../../features/candidates/candidateTypes'
import { getCandidates, updateCandidateStatus } from '../../features/candidates/candidateAPI'
import { useToast } from '../../components/common/ToastProvider'
import { getErrorMessage } from '../../utils/errorUtils'
import DataTable, { type TableColumn } from '../../components/common/Table'
import { SkeletonRows } from '../../components/common/Loader'

type CandidateListPageProps = {
  jobs: JobRecord[]
  initialJobId?: string | null
  canCreateCandidate?: boolean
  canEditCandidate?: boolean
  canManageCandidateStage?: boolean
  onAddCandidate: () => void
  onViewCandidate: (candidateId: string) => void
  onEditCandidate: (candidateId: string) => void
}

function CandidateListPage({
  jobs,
  initialJobId,
  canCreateCandidate = true,
  canEditCandidate = true,
  canManageCandidateStage = true,
  onAddCandidate,
  onViewCandidate,
  onEditCandidate,
}: CandidateListPageProps) {
  const { showToast } = useToast()
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [jobFilter, setJobFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | CandidateStatus>('all')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [dragCandidateId, setDragCandidateId] = useState<string | null>(null)
  const [dropStatus, setDropStatus] = useState<CandidateStatus | null>(null)
  const loadRequestIdRef = useRef(0)
  const boardRef = useRef<HTMLElement | null>(null)

  const jobMap = useMemo(() => new Map(jobs.map((job) => [job.id, `${job.title} (${job.reqId})`])), [jobs])

  useEffect(() => {
    if (initialJobId) {
      setJobFilter(initialJobId)
    }
  }, [initialJobId])

  async function loadCandidateList() {
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    setLoading(true)
    setError(null)
    try {
      const result = await getCandidates({
        search: searchTerm.trim() || undefined,
        jobID: jobFilter === 'all' ? undefined : jobFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      if (loadRequestIdRef.current === requestId) {
        setCandidates(result)
      }
    } catch (loadError) {
      const message = getErrorMessage(loadError, 'Unable to load candidates')
      if (loadRequestIdRef.current === requestId) {
        setError(message)
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidateList()
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchTerm, jobFilter, statusFilter])

  async function handleStatusDrop(candidateId: string, status: CandidateStatus) {
    try {
      const updated = await updateCandidateStatus(candidateId, status)
      setCandidates((prev) => prev.map((candidate) => (candidate.id === candidateId ? updated : candidate)))
    } catch (statusError) {
      const message = getErrorMessage(statusError, 'Unable to update candidate status')
      setError(message)
      showToast(message, 'error')
      return
    }
    showToast('Candidate stage updated.', 'success')
  }

  function getNextStage(current: CandidateStatus): CandidateStatus | null {
    const index = CANDIDATE_STATUS_OPTIONS.indexOf(current)
    if (index < 0 || index >= CANDIDATE_STATUS_OPTIONS.length - 1) return null
    return CANDIDATE_STATUS_OPTIONS[index + 1]
  }

  function getPreviousStage(current: CandidateStatus): CandidateStatus | null {
    const index = CANDIDATE_STATUS_OPTIONS.indexOf(current)
    if (index <= 0) return null
    return CANDIDATE_STATUS_OPTIONS[index - 1]
  }

  function getCandidateRoleLabel(candidate: CandidateRecord): string {
    return candidate.role || candidate.jobTitle || jobMap.get(candidate.jobID) || 'Role not mapped'
  }

  const columns: Array<TableColumn<CandidateRecord>> = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      accessor: (row) => row.name,
      cell: (row) => (
        <>
          <strong>{row.name}</strong>
          <span>{row.email}</span>
          <span>{getCandidateRoleLabel(row)}</span>
        </>
      ),
    },
    {
      id: 'stage',
      header: 'Current Stage',
      sortable: true,
      accessor: (row) => CANDIDATE_STATUS_LABELS[row.status],
      cell: (row) => CANDIDATE_STATUS_LABELS[row.status],
      align: 'center',
    },
    {
      id: 'recruiter',
      header: 'Recruiter',
      sortable: true,
      accessor: (row) => row.recruiter || row.referal || '',
      cell: (row) => row.recruiter || row.referal || 'Unassigned',
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="actions-cell">
          <select
            className="table-action table-action--status"
            value={row.status}
            disabled={!canManageCandidateStage}
            onChange={(event) => void handleStatusDrop(row.id, event.target.value as CandidateStatus)}
          >
            {CANDIDATE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {CANDIDATE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <button type="button" className="table-action" onClick={() => onViewCandidate(row.id)}>
            <span className="material-symbols-rounded">visibility</span>
            <span>View</span>
          </button>
          {canEditCandidate && (
            <button type="button" className="table-action" onClick={() => onEditCandidate(row.id)}>
              <span className="material-symbols-rounded">edit</span>
              <span>Edit</span>
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Candidates / Management</p>
          <h1>Candidate Management</h1>
          <p className="subtitle">Track every candidate by stage and role with board and list views.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="ghost-btn" onClick={() => setViewMode((prev) => (prev === 'list' ? 'board' : 'list'))}>
            <span className="material-symbols-rounded">{viewMode === 'list' ? 'view_kanban' : 'table_rows'}</span>
            <span>{viewMode === 'list' ? 'Board View' : 'List View'}</span>
          </button>
          {canCreateCandidate && (
            <button type="button" className="primary-btn" onClick={onAddCandidate}>
              <span className="material-symbols-rounded">person_add</span>
              <span>Add Candidate</span>
            </button>
          )}
        </div>
      </section>

      <section className="filters-panel">
        <input
          type="search"
          placeholder="Search candidate name or email..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)} aria-label="Filter by role">
          <option value="all">Role</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} ({job.reqId})
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | CandidateStatus)} aria-label="Filter by stage">
          <option value="all">Stage</option>
          {CANDIDATE_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {CANDIDATE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ghost-btn clear-btn"
          onClick={() => {
            setSearchTerm('')
            setJobFilter('all')
            setStatusFilter('all')
          }}
        >
          Clear All
        </button>
      </section>

      {loading && (
        <section className="table-panel">
          <p className="panel-message">Loading candidates...</p>
          <div style={{ padding: '0.8rem' }}>
            <SkeletonRows rows={8} />
          </div>
        </section>
      )}
      {error && (
        <p className="panel-message panel-message--error">
          {error} <button onClick={() => void loadCandidateList()}>Retry</button>
        </p>
      )}

      {!loading && !error && viewMode === 'list' && (
        <DataTable
          rows={candidates}
          rowKey={(row) => row.id}
          columns={columns}
          selectable
          pageSize={8}
          bulkActions={
            canManageCandidateStage
              ? [
                  {
                    label: 'Bulk Screened',
                    onClick: (rows) => {
                      rows.forEach((row) => {
                        void handleStatusDrop(row.id, 'Screened')
                      })
                    },
                  },
                ]
              : []
          }
          emptyState="No candidates found for current filters."
        />
      )}

      {!loading && !error && viewMode === 'board' && (
        <section
          className="candidate-board"
          ref={boardRef}
          onDragOver={(event) => {
            const container = boardRef.current
            if (!container) return
            const rect = container.getBoundingClientRect()
            const edge = 120
            if (event.clientX < rect.left + edge) {
              container.scrollLeft -= 16
            } else if (event.clientX > rect.right - edge) {
              container.scrollLeft += 16
            }
          }}
        >
          {CANDIDATE_STATUS_OPTIONS.map((status) => (
            <article
              key={status}
              className={`candidate-column candidate-column--${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDropStatus(status)
              }}
              onDragLeave={() => setDropStatus((prev) => (prev === status ? null : prev))}
              onDrop={(event) => {
                event.preventDefault()
                if (dragCandidateId && canManageCandidateStage) void handleStatusDrop(dragCandidateId, status)
                setDragCandidateId(null)
                setDropStatus(null)
              }}
              data-drop-target={dropStatus === status ? 'true' : 'false'}
            >
              <h3>
                <span>{CANDIDATE_STATUS_LABELS[status]}</span>
                <small>{candidates.filter((candidate) => candidate.status === status).length}</small>
              </h3>
              <div className="candidate-column__list">
                {candidates
                  .filter((candidate) => candidate.status === status)
                  .map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className="candidate-card"
                      draggable={canManageCandidateStage}
                      onDragStart={() => setDragCandidateId(candidate.id)}
                      onDragEnd={() => {
                        setDragCandidateId(null)
                        setDropStatus(null)
                      }}
                      onClick={() => onViewCandidate(candidate.id)}
                    >
                      <strong>{candidate.name}</strong>
                      <span>Email ID: {candidate.email || 'Not provided'}</span>
                      <small>Applied Position: {getCandidateRoleLabel(candidate)}</small>
                      {getPreviousStage(candidate.status) && (
                        <button
                          type="button"
                          className="candidate-card__quick-btn"
                          disabled={!canManageCandidateStage}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (!canManageCandidateStage) return
                            const prev = getPreviousStage(candidate.status)
                            if (prev) void handleStatusDrop(candidate.id, prev)
                          }}
                        >
                          Move back to {CANDIDATE_STATUS_LABELS[getPreviousStage(candidate.status) as CandidateStatus]}
                        </button>
                      )}
                      {getNextStage(candidate.status) && (
                        <button
                          type="button"
                          className="candidate-card__quick-btn"
                          disabled={!canManageCandidateStage}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (!canManageCandidateStage) return
                            const next = getNextStage(candidate.status)
                            if (next) void handleStatusDrop(candidate.id, next)
                          }}
                        >
                          Move forward to {CANDIDATE_STATUS_LABELS[getNextStage(candidate.status) as CandidateStatus]}
                        </button>
                      )}
                    </button>
                  ))}
                {candidates.filter((candidate) => candidate.status === status).length === 0 && (
                  <p className="candidate-column__empty">No candidates in this stage.</p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  )
}

export default CandidateListPage
