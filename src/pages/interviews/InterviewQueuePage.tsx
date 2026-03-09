import { useEffect, useMemo, useState } from 'react'
import { getCandidates, updateInterviewForCandidate } from '../../features/candidates/candidateAPI'
import { INTERVIEW_RESULT_OPTIONS, type CandidateInterview, type InterviewResult } from '../../features/candidates/candidateTypes'
import { useToast } from '../../components/common/ToastProvider'
import { getErrorMessage } from '../../utils/errorUtils'

type InterviewQueuePageProps = {
  role?: string
  onInterviewAlert?: (title: string, message: string) => void
}

type QueueItem = {
  candidateId: string
  candidateName: string
  candidateEmail: string
  interview: CandidateInterview
}

type SortOrder = 'upcoming' | 'latest'
type InterviewTaskTab = 'pending' | 'finished'
const INTERVIEWS_PAGE_SIZE = 5

type LocalUser = {
  id?: string
  _id?: string
  userId?: string
  email?: string
  name?: string
  fullName?: string
}

function getLocalUser(): LocalUser {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem('user')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as LocalUser
  } catch {
    return {}
  }
}

function normalizeResult(result?: string): InterviewResult {
  const value = (result || 'Pending').trim() as InterviewResult
  return INTERVIEW_RESULT_OPTIONS.includes(value) ? value : 'Pending'
}

function formatDateTime(value?: string): string {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleString()
}

function InterviewQueuePage({ role, onInterviewAlert }: InterviewQueuePageProps) {
  const { showToast } = useToast()
  const normalizedRole = (role || '').trim().toLowerCase()
  const canFilterByInterviewer = normalizedRole === 'super admin' || normalizedRole === 'hr recruiter'
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [resultByKey, setResultByKey] = useState<Record<string, InterviewResult>>({})
  const [feedbackByKey, setFeedbackByKey] = useState<Record<string, string>>({})
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState<'all' | InterviewResult>('all')
  const [interviewerFilter, setInterviewerFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('upcoming')
  const [taskTab, setTaskTab] = useState<InterviewTaskTab>('pending')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    async function loadQueue() {
      setLoading(true)
      setError(null)
      try {
        const allCandidates = await getCandidates(searchQuery ? { search: searchQuery } : {})
        const user = getLocalUser()
        const myId = (user.id || user._id || user.userId || '').trim()
        const myEmail = (user.email || '').trim().toLowerCase()
        const myName = (user.name || user.fullName || '').trim().toLowerCase()
        const normalizedRole = (role || '').trim().toLowerCase()
        const isSuperAdmin = normalizedRole === 'super admin'
        const isHrRecruiter = normalizedRole === 'hr recruiter'

        const queue: QueueItem[] = []
        allCandidates.forEach((candidate) => {
          candidate.interviews.forEach((interview) => {
            if (isSuperAdmin || isHrRecruiter) {
              queue.push({
                candidateId: candidate.id,
                candidateName: candidate.name,
                candidateEmail: candidate.email,
                interview,
              })
              return
            }

            const interviewerId = (interview.interviewer?.id || '').trim()
            const interviewerEmail = (interview.interviewer?.email || '').trim().toLowerCase()
            const interviewerName = (interview.interviewer?.name || '').trim().toLowerCase()
            const assignedToMe =
              (myId.length > 0 && interviewerId === myId) ||
              (myEmail.length > 0 && interviewerEmail === myEmail) ||
              (myName.length > 0 && interviewerName === myName)

            if (!assignedToMe) return
            queue.push({
              candidateId: candidate.id,
              candidateName: candidate.name,
              candidateEmail: candidate.email,
              interview,
            })
          })
        })

        queue.sort((a, b) => new Date(a.interview.scheduledAt || 0).getTime() - new Date(b.interview.scheduledAt || 0).getTime())
        setItems(queue)
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load assigned interviews'))
      } finally {
        setLoading(false)
      }
    }

    void loadQueue()
  }, [role, searchQuery])

  const totalCount = items.length

  const pendingCount = useMemo(() => {
    return items.filter((item) => {
      const result = normalizeResult(item.interview.result)
      const hasFeedback = Boolean((item.interview.feedback || '').trim())
      const hasFinalResult = result === 'Passed' || result === 'Failed'
      return !(hasFinalResult && hasFeedback)
    }).length
  }, [items])

  const completedCount = useMemo(() => {
    return items.filter((item) => {
      const result = normalizeResult(item.interview.result)
      const hasFeedback = Boolean((item.interview.feedback || '').trim())
      return (result === 'Passed' || result === 'Failed') && hasFeedback
    }).length
  }, [items])

  const todayCount = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return items.filter((item) => {
      if (!item.interview.scheduledAt) return false
      const scheduledAt = new Date(item.interview.scheduledAt)
      if (Number.isNaN(scheduledAt.getTime())) return false
      return scheduledAt >= start && scheduledAt < end
    }).length
  }, [items])

  const stageOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.interview.stage).filter(Boolean)))
    if (!unique.includes('HR Interview')) unique.push('HR Interview')
    return unique.sort((first, second) => first.localeCompare(second))
  }, [items])

  const interviewerOptions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => {
      const interviewer = item.interview.interviewer
      if (!interviewer) return
      const value = (interviewer.id || interviewer.email || interviewer.name || '').trim()
      const label = (interviewer.name || interviewer.email || interviewer.id || '').trim()
      if (!value || !label) return
      map.set(value, label)
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [items])

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item, index) => {
      const stage = item.interview.stage || ''
      const key = item.interview._id || `${item.candidateId}-${index}`
      const result = resultByKey[key] ?? normalizeResult(item.interview.result)
      const hasSavedFeedback = Boolean((item.interview.feedback || '').trim())
      const isFinishedTask = (normalizeResult(item.interview.result) === 'Passed' || normalizeResult(item.interview.result) === 'Failed') && hasSavedFeedback
      const isPendingTask = !isFinishedTask

      if (taskTab === 'pending' && !isPendingTask) return false
      if (taskTab === 'finished' && !isFinishedTask) return false
      if (stageFilter !== 'all' && stage !== stageFilter) return false
      if (resultFilter !== 'all' && result !== resultFilter) return false
      if (canFilterByInterviewer && interviewerFilter !== 'all') {
        const interviewer = item.interview.interviewer
        const interviewerValue = (interviewer?.id || interviewer?.email || interviewer?.name || '').trim()
        if (interviewerValue !== interviewerFilter) return false
      }
      return true
    })

    const sorted = [...filtered].sort((first, second) => {
      const firstTime = new Date(first.interview.scheduledAt || 0).getTime()
      const secondTime = new Date(second.interview.scheduledAt || 0).getTime()
      return sortOrder === 'upcoming' ? firstTime - secondTime : secondTime - firstTime
    })
    return sorted
  }, [canFilterByInterviewer, interviewerFilter, items, resultByKey, resultFilter, sortOrder, stageFilter, taskTab])

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / INTERVIEWS_PAGE_SIZE))

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, stageFilter, resultFilter, interviewerFilter, sortOrder, taskTab])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * INTERVIEWS_PAGE_SIZE
    return visibleItems.slice(start, start + INTERVIEWS_PAGE_SIZE)
  }, [currentPage, visibleItems])

  return (
    <>
      {!loading && !error && (
        <section className="overview-grid interviews-overview-grid">
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">groups</span>
              <span>Total Assigned</span>
            </h3>
            <p className="overview-note">
              <strong>{totalCount}</strong>
            </p>
          </article>
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">pending_actions</span>
              <span>Pending Interviews</span>
            </h3>
            <p className="overview-note">
              <strong>{pendingCount}</strong> 
            </p>
          </article>
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">task_alt</span>
              <span>Completed</span>
            </h3>
            <p className="overview-note">
              <strong>{completedCount}</strong> 
            </p>
          </article>
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">today</span>
              <span>Today</span>
            </h3>
            <p className="overview-note">
              <strong>{todayCount}</strong>
            </p>
          </article>
        </section>
      )}

      {!loading && !error && (
        <section className={`editor-card interviews-filters${canFilterByInterviewer ? ' interviews-filters--with-interviewer' : ''}`}>
          <div className="field interviews-filters__search">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search for candidate..."
            />
          </div>
          <div className="interviews-filters__inline">
            <span>Stage</span>
            <div className="field">
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                <option value="all">All stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="interviews-filters__inline">
            <span>Result</span>
            <div className="field">
              <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as 'all' | InterviewResult)}>
                <option value="all">All results</option>
                {INTERVIEW_RESULT_OPTIONS.map((result) => (
                  <option key={result} value={result}>
                    {result}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {canFilterByInterviewer && (
            <div className="interviews-filters__inline">
              <span>Interviewer</span>
              <div className="field">
                <select value={interviewerFilter} onChange={(event) => setInterviewerFilter(event.target.value)}>
                  <option value="all">All interviewers</option>
                  {interviewerOptions.map((interviewer) => (
                    <option key={interviewer.value} value={interviewer.value}>
                      {interviewer.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>
      )}

      {loading && (
        <section className="editor-grid interviews-grid">
          <article className="editor-card">
            <div className="interviews-assigned-head">
              <div>
                <span className="skeleton-block w-20" />
                <span className="skeleton-block w-14" />
              </div>
              <span className="skeleton-block w-12" />
            </div>
            <ul className="overview-list interviews-list">
              {Array.from({ length: 3 }).map((_, index) => (
                <li key={`interview-skeleton-${index}`} className="interviews-list__item interviews-list__item--skeleton">
                  <div className="interviews-list__grid">
                    <div className="interviews-list__visual interviews-list__visual--skeleton">
                      <span className="skeleton-block w-12" />
                      <span className="skeleton-block w-20" />
                      <span className="skeleton-block w-14" />
                    </div>
                    <div className="interviews-list__body">
                      <div className="interviews-list__top">
                        <div className="interviews-list__meta">
                          <span className="skeleton-block w-22" />
                          <span className="skeleton-block w-20" />
                          <span className="skeleton-block w-14" />
                        </div>
                        <span className="skeleton-block w-14" />
                      </div>
                      <span className="skeleton-block w-24" />
                      <div className="interviews-list__actions">
                        <span className="skeleton-block w-12" />
                        <span className="skeleton-block w-12" />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}
      {error && <p className="panel-message panel-message--error">{error}</p>}

      {!loading && !error && (
        <section className="editor-grid interviews-grid">
          <article className="editor-card">
            <div className="interviews-assigned-head">
              <div>
                <h2>Assigned Interviews</h2>
                <p className="editor-muted">
                  {taskTab === 'pending' ? pendingCount : completedCount} interview(s) match current filters. Total assigned: {totalCount}. Scheduled today:{' '}
                  {todayCount}.
                </p>
              </div>
              <div className="interviews-page-head__actions">
                <div className="field interviews-sort-control">
                  <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
                    <option value="upcoming">Sort: Upcoming first</option>
                    <option value="latest">Sort: Latest first</option>
                  </select>
                </div>
                <div className="interviews-task-tabs" role="tablist" aria-label="Interview tasks">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={taskTab === 'pending'}
                    className={`interviews-task-tabs__btn${taskTab === 'pending' ? ' is-active' : ''}`}
                    onClick={() => setTaskTab('pending')}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={taskTab === 'finished'}
                    className={`interviews-task-tabs__btn${taskTab === 'finished' ? ' is-active' : ''}`}
                    onClick={() => setTaskTab('finished')}
                  >
                    Finished
                  </button>
                </div>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setSearchInput('')
                    setSearchQuery('')
                    setStageFilter('all')
                    setResultFilter('all')
                    setInterviewerFilter('all')
                    setSortOrder('upcoming')
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
            <ul className="overview-list interviews-list">
              {visibleItems.length === 0 && <li className="overview-list__empty">No interviews found for the selected filters.</li>}
              {pagedItems.map((item, index) => {
                const key = item.interview._id || `${item.candidateId}-${(currentPage - 1) * INTERVIEWS_PAGE_SIZE + index}`
                const selectedResult = resultByKey[key] ?? normalizeResult(item.interview.result)
                const selectedFeedback = feedbackByKey[key] ?? item.interview.feedback ?? ''
                const interviewResult = normalizeResult(item.interview.result)
                const hasFeedback = Boolean((item.interview.feedback || '').trim())
                const hasFinalResult = interviewResult === 'Passed' || interviewResult === 'Failed'
                const isFinishedInterview = hasFinalResult && hasFeedback
                const isFeedbackPending = hasFinalResult && !hasFeedback
                const statusLabel = isFinishedInterview
                  ? 'Interview Finished'
                  : isFeedbackPending
                    ? 'Feedback Pending'
                    : hasFeedback
                      ? 'Feedback Submitted'
                      : 'Interview Pending'
                const statusClass = isFinishedInterview
                  ? 'finished'
                  : isFeedbackPending
                    ? 'feedback-pending'
                    : hasFeedback
                      ? 'feedback-submitted'
                      : 'pending'
                const resultBadgeClass = selectedResult.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                const meetingLink = item.interview.meetingLink || 'https://teams.microsoft.com'
                return (
                  <li key={key} className="interviews-list__item">
                    <div className="interviews-list__grid">
                      <div className="interviews-list__visual">
                        <span className={`interviews-status-tag interviews-status-tag--${statusClass}`}>
                          {statusLabel}
                        </span>
                        <strong>{item.interview.stage}</strong>
                        <p>{item.candidateName}</p>
                        <small>{item.candidateEmail}</small>
                        <span className={`interviews-list__visual-result interviews-list__visual-result--${resultBadgeClass}`}>
                          Result: {selectedResult}
                        </span>
                      </div>

                      <div className="interviews-list__body">
                        <div className="interviews-list__top">
                          <div className="interviews-list__meta">
                            <span>
                              <span className="material-symbols-rounded">event</span>
                              {formatDateTime(item.interview.scheduledAt)}
                            </span>
                            <span>
                              <span className="material-symbols-rounded">person</span>
                              Interviewer: {item.interview.interviewer?.name || item.interview.interviewer?.email || 'Pending'}
                            </span>
                            <span>
                              <span className="material-symbols-rounded">link</span>
                              <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="interviews-link">
                                Meeting Link
                              </a>
                            </span>
                          </div>

                          {isFinishedInterview ? (
                            <div className="field interviews-list__result-field">
                              <label>Result</label>
                              <div className="interviews-result-display">{interviewResult}</div>
                            </div>
                          ) : (
                            <div className="field interviews-list__result-field">
                              <label>Result</label>
                              <select
                                value={selectedResult}
                                onChange={(event) => setResultByKey((prev) => ({ ...prev, [key]: event.target.value as InterviewResult }))}
                              >
                                {INTERVIEW_RESULT_OPTIONS.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="field interviews-list__feedback-field">
                          <label>Feedback</label>
                          <textarea
                            rows={3}
                            value={isFinishedInterview ? item.interview.feedback || '' : selectedFeedback}
                            onChange={(event) => setFeedbackByKey((prev) => ({ ...prev, [key]: event.target.value }))}
                            placeholder="Enter detailed feedback here..."
                            readOnly={isFinishedInterview}
                          />
                        </div>

                        {!isFinishedInterview && (
                          <div className="editor-actions interviews-list__actions">
                            <button
                              type="button"
                              className="ghost-btn interviews-btn interviews-btn--outline"
                              onClick={() => window.open(meetingLink, '_blank', 'noopener,noreferrer')}
                            >
                              <span className="material-symbols-rounded">videocam</span>
                              <span>Take Interview</span>
                            </button>
                            <button
                              type="button"
                              className="ghost-btn interviews-btn interviews-btn--solid"
                              disabled={!item.interview._id || savingKey === key}
                              onClick={async () => {
                                if (!item.interview._id) return
                                if (!selectedResult || selectedResult === 'Pending') {
                                  showToast('Select a valid interview result before submitting.', 'error')
                                  return
                                }
                                if (!selectedFeedback.trim()) {
                                  showToast('Add interview feedback before submitting.', 'error')
                                  return
                                }
                                setSavingKey(key)
                                try {
                                  const updated = await updateInterviewForCandidate(item.candidateId, item.interview._id, {
                                    result: selectedResult,
                                    feedback: selectedFeedback.trim(),
                                    completedAt: new Date().toISOString(),
                                  })
                                  const refreshed = updated.interviews.find((value) => value._id === item.interview._id)
                                  setItems((prev) =>
                                    prev.map((value) =>
                                      value.candidateId === item.candidateId && value.interview._id === item.interview._id
                                        ? { ...value, interview: refreshed ?? value.interview }
                                        : value,
                                    ),
                                  )
                                  onInterviewAlert?.(
                                    'Interview Feedback Submitted',
                                    `${item.candidateName} - ${item.interview.stage} feedback submitted as ${selectedResult}.`,
                                  )
                                  showToast('Interview result and feedback submitted.', 'success')
                                } catch (submitError) {
                                  showToast(getErrorMessage(submitError, 'Unable to submit interview feedback'), 'error')
                                } finally {
                                  setSavingKey(null)
                                }
                              }}
                            >
                              <span className="material-symbols-rounded">task_alt</span>
                              <span>{savingKey === key ? 'Submitting...' : 'Submit Feedback'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {visibleItems.length > 0 && (
              <div className="table-footer interviews-pagination">
                <p>
                  Showing{' '}
                  <strong>
                    {(currentPage - 1) * INTERVIEWS_PAGE_SIZE + 1}-
                    {Math.min(currentPage * INTERVIEWS_PAGE_SIZE, visibleItems.length)}
                  </strong>{' '}
                  of <strong>{visibleItems.length}</strong> interviews
                </p>
                <div className="pagination">
                  <button type="button" className="ghost-btn interviews-pagination__btn" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => prev - 1)}>
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => {
                    const page = index + 1
                    return (
                      <button
                        key={page}
                        type="button"
                        className={`ghost-btn interviews-pagination__btn${currentPage === page ? ' is-active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className="ghost-btn interviews-pagination__btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </article>
        </section>
      )}
    </>
  )
}

export default InterviewQueuePage
