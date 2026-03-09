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
  searchTerm: string
  onSearchTermChange: (value: string) => void
  sortDirection: 'asc' | 'desc'
  onToggleSortDirection: () => void
  canCreateCandidate?: boolean
  canEditCandidate?: boolean
  canManageCandidateStage?: boolean
  onAddCandidate: () => void
  onViewCandidate: (candidateId: string) => void
  onEditCandidate: (candidateId: string) => void
  onInterviewAlert?: (title: string, message: string) => void
  onCandidateDataChanged?: () => void
}

function getAllowedInterviewerRolesByStage(stage: InterviewStage): ManagedUser['role'][] {
  if (stage === 'HR Interview') return ['HR Recruiter', 'Hiring Manager']
  if (stage === 'Technical Interview 1' || stage === 'Technical Interview 2') return ['Interview Panel']
  return ['Interview Panel', 'HR Recruiter', 'Hiring Manager']
}

function getInterviewerLabelByStage(stage: InterviewStage): string {
  if (stage === 'HR Interview') return 'Select Interviewer (HR Recruiter / Hiring Manager)'
  if (stage === 'Technical Interview 1' || stage === 'Technical Interview 2') return 'Select Interviewer (Interview Panel)'
  return 'Select Interviewer'
}

function isStageConstraintMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return normalized.includes('before moving to') || normalized.includes('cannot move candidate stage')
}

function CandidateListPage({
  jobs,
  initialJobId,
  searchTerm,
  onSearchTermChange,
  sortDirection,
  onToggleSortDirection,
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
  const [jobFilter, setJobFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | CandidateStatus>('all')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [dragCandidateId, setDragCandidateId] = useState<string | null>(null)
  const [dropStatus, setDropStatus] = useState<CandidateStatus | null>(null)
  const [listPage, setListPage] = useState(1)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<CandidateStatus>('Screened')
  const [scheduleTarget, setScheduleTarget] = useState<{ candidateId: string; candidateName: string; stage: InterviewStage } | null>(null)
  const [stageConstraintMessage, setStageConstraintMessage] = useState<string | null>(null)
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
  const [activeUsers, setActiveUsers] = useState<ManagedUser[]>([])
  const loadRequestIdRef = useRef(0)
  const boardRef = useRef<HTMLElement | null>(null)
  const boardDragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  })
  const boardPanRafRef = useRef<number | null>(null)
  const boardPanTargetRef = useRef<number | null>(null)
  const didCardDragRef = useRef(false)
  const LIST_PAGE_SIZE = 8
  const allowedInterviewerRoles = useMemo(() => getAllowedInterviewerRolesByStage(scheduleForm.stage), [scheduleForm.stage])
  const filteredInterviewers = useMemo(
    () => interviewers.filter((user) => allowedInterviewerRoles.includes(user.role)),
    [allowedInterviewerRoles, interviewers],
  )

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
        const active = users.filter((user) => user.isActive)
        setActiveUsers(active)
        setInterviewers(active.filter((user) => user.role === 'Interview Panel' || user.role === 'HR Recruiter' || user.role === 'Hiring Manager'))
      } catch {
        setActiveUsers([])
        setInterviewers([])
      }
    }
    void loadInterviewers()
  }, [])

  useEffect(() => {
    if (!scheduleForm.interviewerId) return
    const stillAllowed = filteredInterviewers.some((user) => user.id === scheduleForm.interviewerId)
    if (!stillAllowed) {
      setScheduleForm((prev) => ({ ...prev, interviewerId: '' }))
    }
  }, [filteredInterviewers, scheduleForm.interviewerId])

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

  function getCandidateStatusUpdateErrorMessage(error: unknown): string {
    const fallback = getErrorMessage(error, 'Unable to update candidate status')
    const normalized = fallback.toLowerCase()

    const feedbackMissing =
      normalized.includes('interviews.') &&
      normalized.includes('feedback') &&
      normalized.includes('required')
    const resultMissing =
      normalized.includes('interviews.') &&
      normalized.includes('result') &&
      normalized.includes('required')

    if (feedbackMissing || resultMissing) {
      if (feedbackMissing && resultMissing) {
        return 'Cannot move candidate stage. Add interview result and feedback first.'
      }
      if (feedbackMissing) {
        return 'Cannot move candidate stage. Add interview feedback first.'
      }
      return 'Cannot move candidate stage. Add interview result first.'
    }

    return fallback
  }

  function getLatestInterviewForStage(candidate: CandidateRecord, stage: InterviewStage): CandidateRecord['interviews'][number] | null {
    const byStage = (candidate.interviews ?? []).filter((interview) => interview.stage === stage)
    if (byStage.length === 0) return null
    return [...byStage].sort((a, b) => {
      const aTime = new Date(a.completedAt || a.updatedAt || a.scheduledAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.completedAt || b.updatedAt || b.scheduledAt || b.createdAt || 0).getTime()
      return bTime - aTime
    })[0]
  }

  function validateStageTransition(candidate: CandidateRecord, nextStatus: CandidateStatus): string | null {
    if (nextStatus === 'Technical Interview 2') {
      const interview = getLatestInterviewForStage(candidate, 'Technical Interview 1')
      if (!interview) return 'Schedule Technical Interview 1 before moving to Technical Interview 2.'
      const hasResult = Boolean(interview.result && interview.result !== 'Pending')
      const hasFeedback = Boolean((interview.feedback || '').trim())
      if (!hasResult || !hasFeedback) return 'Add result and feedback for Technical Interview 1 before moving to Technical Interview 2.'
    }
    if (nextStatus === 'HR Interview') {
      const interview = getLatestInterviewForStage(candidate, 'Technical Interview 2')
      if (!interview) return 'Schedule Technical Interview 2 before moving to HR Interview.'
      const hasResult = Boolean(interview.result && interview.result !== 'Pending')
      const hasFeedback = Boolean((interview.feedback || '').trim())
      if (!hasResult || !hasFeedback) return 'Add result and feedback for Technical Interview 2 before moving to HR Interview.'
    }
    return null
  }

  async function handleStatusDrop(candidateId: string, status: CandidateStatus): Promise<CandidateRecord | null> {
    const existing = candidates.find((candidate) => candidate.id === candidateId)
    if (!existing) {
      showToast('Candidate not found for status update.', 'error')
      return null
    }
    const transitionError = validateStageTransition(existing, status)
    if (transitionError) {
      setStageConstraintMessage(transitionError)
      return null
    }

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
      showToast('Candidate stage updated.', 'success')
      return updated
    } catch (statusError) {
      const message = getCandidateStatusUpdateErrorMessage(statusError)
      if (isStageConstraintMessage(message)) {
        setStageConstraintMessage(message)
        return null
      }
      setError(message)
      showToast(message, 'error')
      return null
    }
  }

  async function handleScheduleInterview() {
    if (!scheduleTarget) return
    if (!scheduleForm.interviewerId.trim() || !scheduleForm.scheduledAt.trim()) {
      showToast('Interviewer and schedule time are required.', 'error')
      return
    }
    const selectedInterviewer = filteredInterviewers.find((user) => user.id === scheduleForm.interviewerId.trim())
    if (!selectedInterviewer) {
      showToast(`Invalid interviewer for ${scheduleForm.stage}. Choose ${getInterviewerLabelByStage(scheduleForm.stage)}.`, 'error')
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

  const userById = useMemo(() => {
    return activeUsers.reduce<Record<string, ManagedUser>>((acc, user) => {
      acc[user.id] = user
      return acc
    }, {})
  }, [activeUsers])

  function getCandidateAssigneeLabel(candidate: CandidateRecord): string {
    if (candidate.recruiter?.trim()) return candidate.recruiter.trim()
    if (candidate.referal?.trim()) return candidate.referal.trim()

    const latestAssignedInterview = [...(candidate.interviews ?? [])]
      .sort((a, b) => {
        const aTime = new Date(a.scheduledAt || a.updatedAt || a.createdAt || 0).getTime()
        const bTime = new Date(b.scheduledAt || b.updatedAt || b.createdAt || 0).getTime()
        return bTime - aTime
      })
      .find((interview) => interview.interviewer?.id || interview.interviewer?.name || interview.interviewer?.email)

    if (!latestAssignedInterview) return 'Unassigned'

    const interviewerId = latestAssignedInterview.interviewer?.id || ''
    const fromDirectory = interviewerId ? userById[interviewerId] : undefined
    if (fromDirectory) {
      const fullName = `${fromDirectory.firstName} ${fromDirectory.lastName}`.trim()
      return fullName || fromDirectory.email || 'Unassigned'
    }

    return latestAssignedInterview.interviewer?.name || latestAssignedInterview.interviewer?.email || 'Unassigned'
  }

  function getStageClassName(status: CandidateStatus): string {
    return status.toLowerCase().replace(/[^a-z0-9]+/g, '-')
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

  function autoScrollBoardWhileDragging(clientX: number) {
    if (!dragCandidateId) return
    const board = boardRef.current
    if (!board) return

    const rect = board.getBoundingClientRect()
    const edgeThreshold = Math.max(56, Math.min(120, rect.width * 0.12))
    let delta = 0

    if (clientX < rect.left + edgeThreshold) {
      const ratio = (rect.left + edgeThreshold - clientX) / edgeThreshold
      delta = -Math.ceil(6 + ratio * 18)
    } else if (clientX > rect.right - edgeThreshold) {
      const ratio = (clientX - (rect.right - edgeThreshold)) / edgeThreshold
      delta = Math.ceil(6 + ratio * 18)
    }

    if (delta !== 0) {
      board.scrollLeft += delta
    }
  }

  function handleBoardMouseDown(event: React.MouseEvent<HTMLElement>) {
    if (viewMode !== 'board') return
    if (event.button !== 0) return
    if (!(event.target instanceof Element)) return
    if (event.target.closest('button, select, input, a, textarea, [draggable="true"]')) return
    const board = boardRef.current
    if (!board) return
    event.preventDefault()
    boardDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: board.scrollLeft,
    }
    board.classList.add('is-dragging')
  }

  function handleBoardMouseMove(event: React.MouseEvent<HTMLElement>) {
    if (!boardDragRef.current.active) return
    const board = boardRef.current
    if (!board) return
    const delta = event.clientX - boardDragRef.current.startX
    const target = boardDragRef.current.startScrollLeft - delta
    boardPanTargetRef.current = target
    if (boardPanRafRef.current !== null) return
    const animate = () => {
      const activeBoard = boardRef.current
      const nextTarget = boardPanTargetRef.current
      if (!activeBoard || nextTarget === null) {
        boardPanRafRef.current = null
        return
      }
      const current = activeBoard.scrollLeft
      const diff = nextTarget - current
      if (Math.abs(diff) < 0.75) {
        activeBoard.scrollLeft = nextTarget
        boardPanRafRef.current = null
        return
      }
      activeBoard.scrollLeft = current + diff * 0.35
      boardPanRafRef.current = window.requestAnimationFrame(animate)
    }
    boardPanRafRef.current = window.requestAnimationFrame(animate)
  }

  function stopBoardDrag() {
    if (!boardDragRef.current.active) return
    boardDragRef.current.active = false
    boardRef.current?.classList.remove('is-dragging')
    if (boardPanRafRef.current !== null) {
      window.cancelAnimationFrame(boardPanRafRef.current)
      boardPanRafRef.current = null
    }
    boardPanTargetRef.current = null
  }

  return (
    <>
      <section className="page-head candidate-page-head">
        <div>
          <p className="breadcrumb">Candidates / Management</p>
          <h1>Candidate Management</h1>
          <p className="subtitle">Track every candidate by stage and role with board and list views.</p>
        </div>
        <div className="page-head__actions">
          {viewMode === 'list' && (
            <button type="button" className="ghost-btn" onClick={onToggleSortDirection}>
              <span className="material-symbols-rounded">sort_by_alpha</span>
              <span>{sortDirection === 'asc' ? 'A-Z' : 'Z-A'}</span>
            </button>
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

      <section className="filters-panel candidate-filters-panel">
        <label className="candidate-search-input">
          <span className="material-symbols-rounded" aria-hidden="true">search</span>
          <input
            type="search"
            placeholder="Search candidate name or email..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </label>
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
            onSearchTermChange('')
            setJobFilter('all')
            setStatusFilter('all')
          }}
        >
          Clear All
        </button>
      </section>

      {loading && (
        <section className="table-panel">
          <div style={{ padding: '0.8rem' }}>
            <SkeletonRows rows={8} />
          </div>
        </section>
      )}
      {!loading && !error && viewMode === 'list' && (
        <section className="table-panel candidate-table-panel">
          {sortedCandidates.length === 0 ? (
            <div className="ui-table__empty">No candidates found for current filters.</div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table candidate-ui-table">
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
                      <td style={{ textAlign: 'center' }}>
                        <span className={`candidate-stage-pill stage-${getStageClassName(candidate.status)}`}>
                          {CANDIDATE_STATUS_LABELS[candidate.status]}
                        </span>
                      </td>
                      <td>{getCandidateAssigneeLabel(candidate)}</td>
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
        <section
          className="candidate-board"
          ref={boardRef}
          onMouseDown={handleBoardMouseDown}
          onMouseMove={handleBoardMouseMove}
          onMouseUp={stopBoardDrag}
          onMouseLeave={stopBoardDrag}
          onDragOver={(event) => autoScrollBoardWhileDragging(event.clientX)}
        >
          {CANDIDATE_STATUS_OPTIONS.map((status) => (
            <article
              key={status}
              className={`candidate-column candidate-column--${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              onDragOver={(event) => {
                autoScrollBoardWhileDragging(event.clientX)
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
                const stageCandidates = sortedCandidates.filter((candidate) => candidate.status === status)
                return (
                  <>
              <h3>
                <span>{CANDIDATE_STATUS_LABELS[status]}</span>
                    <small>{stageCandidates.length}</small>
              </h3>
              <div className="candidate-column__list job-board__list">
                    {stageCandidates.map((candidate) => {
                    const previousStage = getPreviousStage(candidate.status)
                    const nextStage = getNextStage(candidate.status)
                    return (
                      <article
                        key={candidate.id}
                        className="candidate-card"
                        draggable={canManageCandidateStage}
                        onDragStart={() => {
                          stopBoardDrag()
                          didCardDragRef.current = true
                          setDragCandidateId(candidate.id)
                        }}
                        onDragEnd={() => {
                          setDragCandidateId(null)
                          setDropStatus(null)
                          window.setTimeout(() => {
                            didCardDragRef.current = false
                          }, 0)
                        }}
                        onClick={() => {
                          if (didCardDragRef.current) return
                          onViewCandidate(candidate.id)
                        }}
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
                              <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
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
                              <span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
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
                  </>
                )
              })()}
            </article>
          ))}
        </section>
        </>
      )}

      <Modal
        open={Boolean(error)}
        title="Error"
        onClose={() => setError(null)}
        actions={(
          <>
            <button type="button" className="ghost-btn" onClick={() => setError(null)}>
              Close
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setError(null)
                void loadCandidateList()
              }}
            >
              Retry
            </button>
          </>
        )}
      >
        <p className="panel-message panel-message--error" style={{ margin: 0 }}>
          {error}
        </p>
      </Modal>

      <Modal
        open={Boolean(stageConstraintMessage)}
        title="Stage Update Blocked"
        onClose={() => setStageConstraintMessage(null)}
        actions={(
          <button type="button" className="primary-btn" onClick={() => setStageConstraintMessage(null)}>
            OK
          </button>
        )}
      >
        <p className="panel-message panel-message--error" style={{ margin: 0 }}>
          {stageConstraintMessage}
        </p>
      </Modal>

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
            <label>{getInterviewerLabelByStage(scheduleForm.stage)}</label>
            <select
              value={scheduleForm.interviewerId}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, interviewerId: event.target.value }))}
            >
              <option value="">Select interviewer</option>
              {filteredInterviewers.map((user) => (
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
