import { useEffect, useMemo, useRef, useState } from 'react'
import type { JobRecord } from '../../features/jobs/jobTypes'
import {
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_OPTIONS,
  type AddInterviewInput,
  type CandidateRecord,
  type CandidateStatus,
  type InterviewStage,
} from '../../features/candidates/candidateTypes'
import { addInterviewToCandidate, getCandidates, updateCandidateStatus } from '../../features/candidates/candidateAPI'
import { getUsers, type ManagedUser } from '../../features/users/usersAdminAPI'
import { useToast } from '../../components/common/ToastProvider'
import { getErrorMessage } from '../../utils/errorUtils'
import { SkeletonRows } from '../../components/common/Loader'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'

type CandidateListPageProps = {
  jobs: JobRecord[]
  initialJobId?: string | null
  canCreateCandidate?: boolean
  canEditCandidate?: boolean
  canManageCandidateStage?: boolean
  onAddCandidate: () => void
  onViewCandidate: (candidateId: string) => void
  onEditCandidate: (candidateId: string) => void
  onInterviewAlert?: (title: string, message: string) => void
  onCandidateDataChanged?: () => void
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
  onInterviewAlert,
  onCandidateDataChanged,
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
  const [boardPageByStatus, setBoardPageByStatus] = useState<Record<string, number>>({})
  const [listPage, setListPage] = useState(1)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<CandidateStatus>('Screened')
  const [scheduleTarget, setScheduleTarget] = useState<{ candidateId: string; candidateName: string; stage: InterviewStage } | null>(null)
  const [scheduleForm, setScheduleForm] = useState<AddInterviewInput>({
    stage: 'Technical Interview 1',
    interviewerId: '',
    scheduledAt: '',
    duration: 60,
    meetingLink: '',
    location: 'Microsoft Teams',
  })
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [interviewers, setInterviewers] = useState<ManagedUser[]>([])
  const loadRequestIdRef = useRef(0)
  const boardRef = useRef<HTMLElement | null>(null)
  const BOARD_PAGE_SIZE = 6
  const LIST_PAGE_SIZE = 8

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

  useEffect(() => {
    async function loadInterviewers() {
      try {
        const users = await getUsers()
        setInterviewers(users.filter((user) => user.role === 'Interview Panel' && user.isActive))
      } catch {
        setInterviewers([])
      }
    }
    void loadInterviewers()
  }, [])

  useEffect(() => {
    setListPage(1)
  }, [searchTerm, jobFilter, statusFilter, sortDirection])

  useEffect(() => {
    setSelectedCandidateIds((prev) => {
      if (prev.size === 0) return prev
      const validKeys = new Set(candidates.map((candidate) => candidate.id))
      const next = new Set<string>()
      prev.forEach((key) => {
        if (validKeys.has(key)) next.add(key)
      })
      return next.size === prev.size ? prev : next
    })
  }, [candidates])

  function toInterviewStage(status: CandidateStatus): InterviewStage | null {
    if (status === 'Technical Interview 1') return 'Technical Interview 1'
    if (status === 'Technical Interview 2') return 'Technical Interview 2'
    if (status === 'HR Interview') return 'HR Interview'
    return null
  }

  async function handleStatusDrop(candidateId: string, status: CandidateStatus): Promise<CandidateRecord | null> {
    try {
      const updated = await updateCandidateStatus(candidateId, status)
      setCandidates((prev) => prev.map((candidate) => (candidate.id === candidateId ? updated : candidate)))
      onCandidateDataChanged?.()
      const interviewStage = toInterviewStage(status)
      if (interviewStage && canManageCandidateStage) {
        setScheduleTarget({ candidateId: updated.id, candidateName: updated.name, stage: interviewStage })
        setScheduleForm({
          stage: interviewStage,
          interviewerId: '',
          scheduledAt: '',
          duration: 60,
          meetingLink: '',
          location: 'Microsoft Teams',
        })
      }
      return updated
    } catch (statusError) {
      const message = getErrorMessage(statusError, 'Unable to update candidate status')
      setError(message)
      showToast(message, 'error')
      return null
    }
    showToast('Candidate stage updated.', 'success')
  }

  async function handleScheduleInterview() {
    if (!scheduleTarget) return
    if (!scheduleForm.interviewerId.trim() || !scheduleForm.scheduledAt.trim()) {
      showToast('Interviewer and schedule time are required.', 'error')
      return
    }
    setScheduleSaving(true)
    try {
      const updated = await addInterviewToCandidate(scheduleTarget.candidateId, {
        stage: scheduleForm.stage,
        interviewerId: scheduleForm.interviewerId.trim(),
        scheduledAt: scheduleForm.scheduledAt,
        duration: Number(scheduleForm.duration) || 60,
        meetingLink: scheduleForm.meetingLink?.trim() || undefined,
        location: scheduleForm.location?.trim() || undefined,
      })
      setCandidates((prev) => prev.map((candidate) => (candidate.id === updated.id ? updated : candidate)))
      onInterviewAlert?.(
        'Interview Scheduled',
        `${scheduleTarget.candidateName} has been scheduled for ${scheduleForm.stage}.`,
      )
      setScheduleTarget(null)
      showToast('Interview assigned and scheduled.', 'success')
    } catch (scheduleError) {
      const message = getErrorMessage(scheduleError, 'Unable to schedule interview')
      showToast(message, 'error')
    } finally {
      setScheduleSaving(false)
    }
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

  const sortedCandidates = useMemo(() => {
    const sorted = [...candidates].sort((first, second) => first.name.localeCompare(second.name))
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [candidates, sortDirection])

  const pageCount = Math.max(1, Math.ceil(sortedCandidates.length / LIST_PAGE_SIZE))
  const safePage = Math.min(listPage, pageCount)
  const pagedCandidates = useMemo(() => {
    const start = (safePage - 1) * LIST_PAGE_SIZE
    return sortedCandidates.slice(start, start + LIST_PAGE_SIZE)
  }, [safePage, sortedCandidates])

  const selectedCount = selectedCandidateIds.size
  const allSelected = sortedCandidates.length > 0 && selectedCount === sortedCandidates.length

  const selectedCandidateRows = useMemo(
    () => sortedCandidates.filter((candidate) => selectedCandidateIds.has(candidate.id)),
    [selectedCandidateIds, sortedCandidates],
  )

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedCandidateIds(new Set())
      return
    }
    setSelectedCandidateIds(new Set(sortedCandidates.map((candidate) => candidate.id)))
  }

  function toggleSelectOne(candidateId: string, checked: boolean) {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(candidateId)
      else next.delete(candidateId)
      return next
    })
  }

  async function applyBulkStatusChange() {
    if (!canManageCandidateStage || selectedCandidateRows.length === 0) return
    const results = await Promise.allSettled(selectedCandidateRows.map((candidate) => updateCandidateStatus(candidate.id, bulkStatus)))
    const updated = results
      .filter((result): result is PromiseFulfilledResult<CandidateRecord> => result.status === 'fulfilled')
      .map((result) => result.value)

    if (updated.length > 0) {
      const byId = new Map(updated.map((candidate) => [candidate.id, candidate]))
      setCandidates((prev) => prev.map((candidate) => byId.get(candidate.id) ?? candidate))
      onCandidateDataChanged?.()
    }
    const failed = results.length - updated.length
    if (failed > 0) {
      showToast(`Updated ${updated.length} candidates. ${failed} failed.`, 'error')
    } else {
      showToast(`Updated ${updated.length} candidates to ${CANDIDATE_STATUS_LABELS[bulkStatus]}.`, 'success')
    }
    setSelectedCandidateIds(new Set())
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Candidates / Management</p>
          <h1>Candidate Management</h1>
          <p className="subtitle">Track every candidate by stage and role with board and list views.</p>
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
          {viewMode === 'list' && canManageCandidateStage && selectedCount > 0 && (
            <div className="candidate-toolbar-inline">
              <span>{selectedCount} selected</span>
              <select
                className="candidate-toolbar-select"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as CandidateStatus)}
              >
                {CANDIDATE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {CANDIDATE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <button type="button" className="ghost-btn" onClick={() => void applyBulkStatusChange()}>
                Apply
              </button>
            </div>
          )}
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
        <section className="table-panel">
          {sortedCandidates.length === 0 ? (
            <div className="ui-table__empty">No candidates found for current filters.</div>
          ) : (
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
                        aria-label="Select all candidates"
                      />
                    </th>
                    <th>Name</th>
                    <th style={{ textAlign: 'center' }}>Current Stage</th>
                    <th>Recruiter</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCandidates.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={selectedCandidateIds.has(candidate.id)}
                          onChange={(event) => toggleSelectOne(candidate.id, event.target.checked)}
                          aria-label={`Select ${candidate.name}`}
                        />
                      </td>
                      <td>
                        <strong>{candidate.name}</strong>
                        <div>{candidate.email}</div>
                        <div>{getCandidateRoleLabel(candidate)}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{CANDIDATE_STATUS_LABELS[candidate.status]}</td>
                      <td>{candidate.recruiter || candidate.referal || 'Unassigned'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="actions-cell">
                          <select
                            className="table-action table-action--status"
                            value={candidate.status}
                            disabled={!canManageCandidateStage}
                            onChange={(event) => void handleStatusDrop(candidate.id, event.target.value as CandidateStatus)}
                          >
                            {CANDIDATE_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {CANDIDATE_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="table-action" onClick={() => onViewCandidate(candidate.id)}>
                            <span className="material-symbols-rounded">visibility</span>
                            <span>View</span>
                          </button>
                          {canEditCandidate && (
                            <button type="button" className="table-action" onClick={() => onEditCandidate(candidate.id)}>
                              <span className="material-symbols-rounded">edit</span>
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setListPage} />
            </div>
          )}
        </section>
      )}

      {!loading && !error && viewMode === 'board' && (
        <>
        {canCreateCandidate && (
          <div style={{ marginBottom: '0.6rem' }}>
            <button type="button" className="primary-btn" onClick={onAddCandidate}>
              <span className="material-symbols-rounded">person_add</span>
              <span>Add Candidate</span>
            </button>
          </div>
        )}
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
              {(() => {
                const stageCandidates = candidates.filter((candidate) => candidate.status === status)
                const page = boardPageByStatus[status] ?? 1
                const pageCount = Math.max(1, Math.ceil(stageCandidates.length / BOARD_PAGE_SIZE))
                const safePage = Math.min(page, pageCount)
                const start = (safePage - 1) * BOARD_PAGE_SIZE
                const pagedCandidates = stageCandidates.slice(start, start + BOARD_PAGE_SIZE)
                return (
                  <>
              <h3>
                <span>{CANDIDATE_STATUS_LABELS[status]}</span>
                    <small>{stageCandidates.length}</small>
              </h3>
              <div className="candidate-column__list">
                    {pagedCandidates.map((candidate) => {
                    const previousStage = getPreviousStage(candidate.status)
                    const nextStage = getNextStage(candidate.status)
                    return (
                      <article
                        key={candidate.id}
                        className="candidate-card"
                        draggable={canManageCandidateStage}
                        onDragStart={() => setDragCandidateId(candidate.id)}
                        onDragEnd={() => {
                          setDragCandidateId(null)
                          setDropStatus(null)
                        }}
                        onClick={() => onViewCandidate(candidate.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onViewCandidate(candidate.id)
                          }
                        }}
                      >
                        <div className="candidate-card__row">
                          <strong>{candidate.name}</strong>
                          <span>{candidate.email || 'Not provided'}</span>
                        </div>
                        <small>{getCandidateRoleLabel(candidate)}</small>
                        <div className="candidate-card__quick-actions">
                          {previousStage && (
                            <button
                              type="button"
                              className="candidate-card__quick-btn"
                              disabled={!canManageCandidateStage}
                              aria-label={`Move back to ${CANDIDATE_STATUS_LABELS[previousStage]}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                if (!canManageCandidateStage) return
                                void handleStatusDrop(candidate.id, previousStage)
                              }}
                            >
                              <span aria-hidden="true">←</span>
                            </button>
                          )}
                          {nextStage && (
                            <button
                              type="button"
                              className="candidate-card__quick-btn"
                              disabled={!canManageCandidateStage}
                              aria-label={`Move forward to ${CANDIDATE_STATUS_LABELS[nextStage]}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                if (!canManageCandidateStage) return
                                void handleStatusDrop(candidate.id, nextStage)
                              }}
                            >
                              <span aria-hidden="true">→</span>
                            </button>
                          )}
                        </div>
                      </article>
                    )
                    })}
                    {stageCandidates.length === 0 && (
                  <p className="candidate-column__empty">No candidates in this stage.</p>
                )}
              </div>
                    {pageCount > 1 && (
                      <Pagination
                        page={safePage}
                        pageCount={pageCount}
                        onPageChange={(nextPage) => setBoardPageByStatus((prev) => ({ ...prev, [status]: nextPage }))}
                      />
                    )}
                  </>
                )
              })()}
            </article>
          ))}
        </section>
        </>
      )}

      <Modal
        open={Boolean(scheduleTarget)}
        title="Schedule Interview"
        onClose={() => {
          if (scheduleSaving) return
          setScheduleTarget(null)
        }}
        actions={(
          <>
            <button type="button" className="ghost-btn" onClick={() => setScheduleTarget(null)} disabled={scheduleSaving}>
              Skip
            </button>
            <button type="button" className="primary-btn" onClick={() => void handleScheduleInterview()} disabled={scheduleSaving}>
              {scheduleSaving ? 'Assigning...' : 'Assign Interview'}
            </button>
          </>
        )}
      >
        <div className="field">
          <label>Candidate</label>
          <input value={scheduleTarget?.candidateName ?? ''} disabled />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Stage</label>
            <input value={scheduleForm.stage} disabled />
          </div>
          <div className="field">
            <label>Select Interviewer (Interview Panel)</label>
            <select
              value={scheduleForm.interviewerId}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, interviewerId: event.target.value }))}
            >
              <option value="">Select interviewer</option>
              {interviewers.map((user) => (
                <option key={user.id} value={user.id}>
                  {`${user.firstName} ${user.lastName}`.trim()} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Scheduled At</label>
            <input
              type="datetime-local"
              value={scheduleForm.scheduledAt}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
            />
          </div>
          <div className="field">
            <label>Duration (minutes)</label>
            <input
              type="number"
              min={15}
              value={String(scheduleForm.duration ?? 60)}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, duration: Number(event.target.value) || 60 }))}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Meeting Link (Teams)</label>
            <input
              value={scheduleForm.meetingLink ?? ''}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, meetingLink: event.target.value }))}
              placeholder="https://teams.microsoft.com/..."
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input
              value={scheduleForm.location ?? ''}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="Microsoft Teams"
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default CandidateListPage
