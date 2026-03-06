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

function getResultClass(result: InterviewResult): string {
  const normalized = result.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `interview-result-chip is-${normalized}`
}

function formatDateTime(value?: string): string {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleString()
}

function InterviewQueuePage({ role, onInterviewAlert }: InterviewQueuePageProps) {
  const { showToast } = useToast()
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [resultByKey, setResultByKey] = useState<Record<string, InterviewResult>>({})
  const [feedbackByKey, setFeedbackByKey] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState<'all' | InterviewResult>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('upcoming')

  useEffect(() => {
    async function loadQueue() {
      setLoading(true)
      setError(null)
      try {
        const allCandidates = await getCandidates()
        const user = getLocalUser()
        const myId = (user.id || user._id || user.userId || '').trim()
        const myEmail = (user.email || '').trim().toLowerCase()
        const myName = (user.name || user.fullName || '').trim().toLowerCase()
        const isSuperAdmin = (role || '').trim().toLowerCase() === 'super admin'

        const queue: QueueItem[] = []
        allCandidates.forEach((candidate) => {
          candidate.interviews.forEach((interview) => {
            if (isSuperAdmin) {
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
  }, [role])

  const totalCount = items.length

  const pendingCount = useMemo(() => {
    return items.filter((item) => {
      const result = normalizeResult(item.interview.result)
      return result === 'Pending' || result === 'On Hold' || result === 'Rescheduled'
    }).length
  }, [items])

  const completedCount = useMemo(() => {
    return items.filter((item) => {
      const result = normalizeResult(item.interview.result)
      return result === 'Passed' || result === 'Failed'
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
    return unique.sort((first, second) => first.localeCompare(second))
  }, [items])

  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const filtered = items.filter((item) => {
      const stage = item.interview.stage || ''
      const result = normalizeResult(item.interview.result)

      if (stageFilter !== 'all' && stage !== stageFilter) return false
      if (resultFilter !== 'all' && result !== resultFilter) return false

      if (!query) return true
      const haystack = [
        item.candidateName,
        item.candidateEmail,
        stage,
        item.interview.interviewer?.name || '',
        item.interview.interviewer?.email || '',
        item.interview.location || '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })

    const sorted = [...filtered].sort((first, second) => {
      const firstTime = new Date(first.interview.scheduledAt || 0).getTime()
      const secondTime = new Date(second.interview.scheduledAt || 0).getTime()
      return sortOrder === 'upcoming' ? firstTime - secondTime : secondTime - firstTime
    })
    return sorted
  }, [items, resultFilter, searchTerm, sortOrder, stageFilter])

  return (
    <>
      <section className="page-head interviews-page-head">
        <div>
          <p className="breadcrumb">Interviews / Queue</p>
          <h1>Interview Management</h1>
          <p className="subtitle">Track assigned interviews, join meetings, and submit structured feedback from one workspace.</p>
        </div>
        <div className="interviews-page-head__actions">
          <button type="button" className="ghost-btn" onClick={() => setSortOrder((prev) => (prev === 'upcoming' ? 'latest' : 'upcoming'))}>
            <span className="material-symbols-rounded">sort</span>
            <span>{sortOrder === 'upcoming' ? 'Upcoming First' : 'Latest First'}</span>
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setSearchTerm('')
              setStageFilter('all')
              setResultFilter('all')
            }}
          >
            <span>Clear Filters</span>
          </button>
        </div>
      </section>

      {loading && <p className="panel-message">Loading interviews...</p>}
      {error && <p className="panel-message panel-message--error">{error}</p>}

      {!loading && !error && (
        <section className="overview-grid interviews-overview-grid">
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">groups</span>
              <span>Total Assigned</span>
            </h3>
            <p className="overview-note">
              <strong>{totalCount}</strong> interviews currently in your queue.
            </p>
          </article>
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">pending_actions</span>
              <span>Pending Interviews</span>
            </h3>
            <p className="overview-note">
              <strong>{pendingCount}</strong> interviews still need feedback submission.
            </p>
          </article>
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">task_alt</span>
              <span>Completed</span>
            </h3>
            <p className="overview-note">
              <strong>{completedCount}</strong> interviews marked passed/failed.
            </p>
          </article>
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">today</span>
              <span>Today</span>
            </h3>
            <p className="overview-note">
              <strong>{todayCount}</strong> interviews scheduled for today.
            </p>
          </article>
        </section>
      )}

      {!loading && !error && (
        <section className="editor-card interviews-filters">
          <div className="field interviews-filters__search">
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search candidate, stage, interviewer, location..." />
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
        </section>
      )}

      {!loading && !error && (
        <section className="editor-grid interviews-grid">
          <article className="editor-card">
            <h3>Assigned Interviews</h3>
            <p className="editor-muted">{visibleItems.length} interview(s) match current filters.</p>
            <ul className="overview-list interviews-list">
              {visibleItems.length === 0 && <li className="overview-list__empty">No interviews found for the selected filters.</li>}
              {visibleItems.map((item, index) => {
                const key = item.interview._id || `${item.candidateId}-${index}`
                const selectedResult = resultByKey[key] ?? normalizeResult(item.interview.result)
                const selectedFeedback = feedbackByKey[key] ?? item.interview.feedback ?? ''
                return (
                  <li key={key} className="interviews-list__item">
                    <div className="interviews-list__grid">
                      <div className="interviews-list__candidate">
                        <div className="interviews-list__head">
                          <strong>{item.interview.stage}</strong>
                          <span className={getResultClass(selectedResult)}>{selectedResult}</span>
                        </div>
                        <p>{item.candidateName}</p>
                        <small>{item.candidateEmail}</small>
                      </div>

                      <div className="interviews-list__meta">
                        <span>
                          <span className="material-symbols-rounded">event</span>
                          {formatDateTime(item.interview.scheduledAt)}
                        </span>
                        <span>
                          <span className="material-symbols-rounded">person</span>
                          {item.interview.interviewer?.name || item.interview.interviewer?.email || 'Interviewer pending'}
                        </span>
                        <span>
                          <span className="material-symbols-rounded">location_on</span>
                          {item.interview.location || 'Microsoft Teams'}
                        </span>
                      </div>

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

                      <div className="field interviews-list__feedback-field">
                        <label>Feedback</label>
                        <textarea
                          rows={2}
                          value={selectedFeedback}
                          onChange={(event) => setFeedbackByKey((prev) => ({ ...prev, [key]: event.target.value }))}
                          placeholder="Enter feedback..."
                        />
                      </div>

                      <div className="editor-actions interviews-list__actions">
                        <button
                          type="button"
                          className="ghost-btn interviews-btn interviews-btn--outline"
                          onClick={() => window.open(item.interview.meetingLink || 'https://teams.microsoft.com', '_blank', 'noopener,noreferrer')}
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
                            setSavingKey(key)
                            try {
                              const updated = await updateInterviewForCandidate(item.candidateId, item.interview._id, {
                                result: selectedResult,
                                feedback: selectedFeedback.trim() || undefined,
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
                    </div>
                  </li>
                )
              })}
            </ul>
          </article>
        </section>
      )}
    </>
  )
}

export default InterviewQueuePage
