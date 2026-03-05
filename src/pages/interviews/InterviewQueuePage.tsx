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

function InterviewQueuePage({ role, onInterviewAlert }: InterviewQueuePageProps) {
  const { showToast } = useToast()
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [resultByKey, setResultByKey] = useState<Record<string, InterviewResult>>({})
  const [feedbackByKey, setFeedbackByKey] = useState<Record<string, string>>({})

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

  const pendingCount = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.interview.result ||
          item.interview.result === 'Pending' ||
          item.interview.result === 'On Hold' ||
          item.interview.result === 'Rescheduled',
      ).length,
    [items],
  )

  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Interviews / Queue</p>
          <h1>Interview Assignment Board</h1>
          <p className="subtitle">View assigned interviews, join Teams meetings, and submit interview result with feedback.</p>
        </div>
      </section>

      {loading && <p className="panel-message">Loading interviews...</p>}
      {error && <p className="panel-message panel-message--error">{error}</p>}

      {!loading && !error && (
        <section className="overview-grid">
          <article className="overview-card">
            <h3>
              <span className="material-symbols-rounded">pending_actions</span>
              <span>Pending Interviews</span>
            </h3>
            <p className="overview-note">{pendingCount} interviews still need feedback submission.</p>
          </article>
        </section>
      )}

      {!loading && !error && (
        <section className="editor-grid">
          <article className="editor-card">
            <h3>Assigned Interviews</h3>
            <ul className="overview-list">
              {items.length === 0 && <li className="overview-list__empty">No interviews assigned right now.</li>}
              {items.map((item, index) => {
                const key = item.interview._id || `${item.candidateId}-${index}`
                const selectedResult = resultByKey[key] ?? (item.interview.result || 'Pending')
                const selectedFeedback = feedbackByKey[key] ?? item.interview.feedback ?? ''
                return (
                  <li key={key}>
                    <span className="material-symbols-rounded">event</span>
                    <span style={{ width: '100%' }}>
                      <strong>{item.interview.stage}</strong>
                      <small>
                        {item.candidateName} ({item.candidateEmail}) •{' '}
                        {item.interview.scheduledAt ? new Date(item.interview.scheduledAt).toLocaleString() : 'Not scheduled'}
                      </small>
                      <div className="field-row" style={{ marginTop: '0.6rem' }}>
                        <div className="field">
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
                        <div className="field">
                          <label>Feedback</label>
                          <input
                            value={selectedFeedback}
                            onChange={(event) => setFeedbackByKey((prev) => ({ ...prev, [key]: event.target.value }))}
                            placeholder="Interview summary and recommendation"
                          />
                        </div>
                      </div>
                      <div className="editor-actions">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => window.open(item.interview.meetingLink || 'https://teams.microsoft.com', '_blank', 'noopener,noreferrer')}
                        >
                          <span className="material-symbols-rounded">videocam</span>
                          <span>Take Interview</span>
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={!item.interview._id || savingKey === key}
                          onClick={async () => {
                            if (!item.interview._id) return
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
                    </span>
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
