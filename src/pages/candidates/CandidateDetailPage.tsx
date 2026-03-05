import { useEffect, useMemo, useState } from 'react'
import {
  addInterviewToCandidate,
  getCandidateInterviews,
  getCandidateTimeline,
  getCandidateById,
  updateCandidate,
  updateInterviewForCandidate,
  updateCandidateStatus,
  uploadCandidateResume,
} from '../../features/candidates/candidateAPI'
import {
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_OPTIONS,
  INTERVIEW_RESULT_OPTIONS,
  INTERVIEW_STAGE_OPTIONS,
  type CandidateInterview,
  type CandidateFormValues,
  type CandidateRecord,
  type CandidateStatus,
  type CandidateTimelineEvent,
  type InterviewStage,
} from '../../features/candidates/candidateTypes'
import type { JobRecord } from '../../features/jobs/jobTypes'
import { useToast } from '../../components/common/ToastProvider'
import { getErrorMessage } from '../../utils/errorUtils'

type CandidateDetailPageProps = {
  candidateId: string
  jobs: JobRecord[]
  onBack: () => void
  canEdit?: boolean
  canManageStage?: boolean
  onInterviewAlert?: (title: string, message: string) => void
  onCandidateDataChanged?: () => void
}

function toFormValues(candidate: CandidateRecord): CandidateFormValues {
  return {
    name: candidate.name,
    jobID: candidate.jobID,
    email: candidate.email,
    contactDetails: candidate.contactDetails,
    location: candidate.location,
    skills: candidate.skills.join(', '),
    experience: String(candidate.experience),
    education: candidate.education,
    noticePeriod: String(candidate.noticePeriod),
    referal: candidate.referal ?? '',
    recruiter: candidate.recruiter ?? '',
    status: candidate.status,
    feedback: candidate.feedback ?? '',
  }
}

function CandidateDetailPage({
  candidateId,
  jobs,
  onBack,
  canEdit = true,
  canManageStage = true,
  onInterviewAlert,
  onCandidateDataChanged,
}: CandidateDetailPageProps) {
  const { showToast } = useToast()
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<CandidateFormValues | null>(null)
  const [timeline, setTimeline] = useState<CandidateTimelineEvent[]>([])
  const [interviewsLoading, setInterviewsLoading] = useState(false)
  const [interviewForm, setInterviewForm] = useState<{
    stage: InterviewStage
    interviewerId: string
    scheduledAt: string
    duration: string
    meetingLink: string
    location: string
  }>({
    stage: INTERVIEW_STAGE_OPTIONS[0],
    interviewerId: '',
    scheduledAt: '',
    duration: '60',
    meetingLink: '',
    location: '',
  })

  const jobLabel = useMemo(() => {
    if (!candidate) return 'Unknown role'
    if (candidate.role) return candidate.role
    if (candidate.jobTitle) return candidate.jobTitle
    const job = jobs.find((item) => item.id === candidate.jobID)
    return job ? `${job.title} (${job.reqId})` : candidate.jobID
  }, [candidate, jobs])

  const activityItems = useMemo(() => {
    if (!candidate) return []
    const statusEvents = candidate.statusHistory.map((item, index) => ({
      id: `status-${item.updatedAt ?? index}`,
      type: 'status' as const,
      timestamp: item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
      label: `Stage moved to ${CANDIDATE_STATUS_LABELS[item.status]}`,
    }))
    return [...statusEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 12)
  }, [candidate])

  const journeyItems = useMemo(() => {
    if (!candidate) return []
    const orderedStages: CandidateStatus[] = [
      'Applied',
      'Screened',
      'Shortlisted',
      'Technical Interview 1',
      'Technical Interview 2',
      'HR Interview',
      'Offered',
      'Offer Accepted',
    ]
    const currentRank = orderedStages.indexOf(candidate.status)
    const historyDate = new Map<CandidateStatus, string | undefined>()
    candidate.statusHistory.forEach((item) => {
      if (!historyDate.has(item.status)) historyDate.set(item.status, item.updatedAt)
    })
    historyDate.set('Applied', historyDate.get('Applied') ?? candidate.createdAt)

    return orderedStages.map((stage, index) => {
      const interviewForStage = candidate.interviews.find((item) => item.stage === stage)
      const state = index < currentRank ? 'done' : index === currentRank ? 'current' : 'upcoming'
      return {
        stage,
        state,
        date: historyDate.get(stage),
        interviewForStage,
      }
    })
  }, [candidate])

  async function loadCandidate() {
    setLoading(true)
    setError(null)
    try {
      const result = await getCandidateById(candidateId)
      setCandidate(result)
      setEditValues(toFormValues(result))
    } catch (loadError) {
      const message = getErrorMessage(loadError, 'Unable to load candidate details')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCandidate()
  }, [candidateId])

  useEffect(() => {
    async function loadTimelineAndInterviews() {
      setInterviewsLoading(true)
      try {
        const [timelineResponse, interviewsResponse] = await Promise.allSettled([
          getCandidateTimeline(candidateId),
          getCandidateInterviews(candidateId),
        ])
        if (timelineResponse.status === 'fulfilled') {
          setTimeline(timelineResponse.value.timeline ?? [])
        } else {
          setTimeline([])
        }
        if (interviewsResponse.status === 'fulfilled') {
          setCandidate(interviewsResponse.value)
          setEditValues(toFormValues(interviewsResponse.value))
        }
      } finally {
        setInterviewsLoading(false)
      }
    }
    void loadTimelineAndInterviews()
  }, [candidateId])

  if (loading) return <p className="panel-message">Loading candidate details...</p>
  if (error) return <p className="panel-message panel-message--error">{error} <button onClick={() => void loadCandidate()}>Retry</button></p>
  if (!candidate) return <p className="panel-message panel-message--error">Candidate not found.</p>

  return (
    <>
      <section className="page-head candidate-profile-head">
        <div>
          <p className="breadcrumb">Candidates / {candidate.name}</p>
          <h1>Candidate Profile: {candidate.name}</h1>
          <p className="subtitle">
            <span className="status-chip">{CANDIDATE_STATUS_LABELS[candidate.status]}</span> • {jobLabel} • {candidate.location || 'Location not set'}
          </p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="ghost-btn">
            <span className="material-symbols-rounded">mail</span>
            <span>Email</span>
          </button>
          <button type="button" className="ghost-btn">
            <span className="material-symbols-rounded">chat</span>
            <span>Message</span>
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              if (!candidate.resume?.filePath) {
                showToast('Resume not uploaded yet.', 'error')
                return
              }
              window.open(candidate.resume.filePath, '_blank', 'noopener,noreferrer')
            }}
          >
            <span className="material-symbols-rounded">description</span>
            <span>Resume</span>
          </button>
          {canEdit && (
            <button
              type="button"
              className="ghost-btn"
              onClick={async () => {
                if (!candidate || !editValues) return
                if (!isEditing) {
                  setIsEditing(true)
                  return
                }
                try {
                  const updated = await updateCandidate(candidate.id, editValues)
                  setCandidate(updated)
                  setEditValues(toFormValues(updated))
                  setIsEditing(false)
                  showToast('Candidate profile updated.', 'success')
                } catch (updateError) {
                  const message = getErrorMessage(updateError, 'Unable to update candidate')
                  showToast(message, 'error')
                }
              }}
            >
              <span className="material-symbols-rounded">{isEditing ? 'save' : 'edit'}</span>
              <span>{isEditing ? 'Save Candidate' : 'Edit Candidate'}</span>
            </button>
          )}
          {canEdit && isEditing && (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                if (!candidate) return
                setEditValues(toFormValues(candidate))
                setIsEditing(false)
              }}
            >
              Cancel
            </button>
          )}
          <button type="button" className="ghost-btn" onClick={onBack}>
            Back to Candidates
          </button>
        </div>
      </section>

      <section className="details-grid">
        <article className="editor-card">
          <h3>Profile</h3>
          <ul className="details-list">
            <li>
              <span>Email</span>
              <strong>
                {isEditing ? (
                  <input value={editValues?.email ?? ''} onChange={(event) => setEditValues((prev) => (prev ? { ...prev, email: event.target.value } : prev))} />
                ) : (
                  candidate.email
                )}
              </strong>
            </li>
            <li>
              <span>Contact</span>
              <strong>
                {isEditing ? (
                  <input
                    value={editValues?.contactDetails ?? ''}
                    onChange={(event) => setEditValues((prev) => (prev ? { ...prev, contactDetails: event.target.value } : prev))}
                  />
                ) : (
                  candidate.contactDetails
                )}
              </strong>
            </li>
            <li>
              <span>Location</span>
              <strong>
                {isEditing ? (
                  <input value={editValues?.location ?? ''} onChange={(event) => setEditValues((prev) => (prev ? { ...prev, location: event.target.value } : prev))} />
                ) : (
                  candidate.location
                )}
              </strong>
            </li>
            <li>
              <span>Skills</span>
              <strong>
                {isEditing ? (
                  <input value={editValues?.skills ?? ''} onChange={(event) => setEditValues((prev) => (prev ? { ...prev, skills: event.target.value } : prev))} />
                ) : (
                  candidate.skills.join(', ') || 'No skills added'
                )}
              </strong>
            </li>
            <li>
              <span>Experience</span>
              <strong>
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    value={editValues?.experience ?? '0'}
                    onChange={(event) => setEditValues((prev) => (prev ? { ...prev, experience: event.target.value } : prev))}
                  />
                ) : (
                  `${candidate.experience} years`
                )}
              </strong>
            </li>
            <li>
              <span>Notice Period</span>
              <strong>
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    value={editValues?.noticePeriod ?? '0'}
                    onChange={(event) => setEditValues((prev) => (prev ? { ...prev, noticePeriod: event.target.value } : prev))}
                  />
                ) : (
                  `${candidate.noticePeriod} days`
                )}
              </strong>
            </li>
          </ul>
        </article>

        <article className="editor-card">
          <h3>Stage & Resume</h3>
          <div className="field">
            <label>Current Stage</label>
            <select
              value={candidate.status}
              disabled={!canManageStage}
              onChange={async (event) => {
                try {
                  const updated = await updateCandidateStatus(candidate.id, event.target.value as CandidateRecord['status'])
                  setCandidate(updated)
                  setEditValues(toFormValues(updated))
                  onCandidateDataChanged?.()
                  showToast('Candidate stage updated.', 'success')
                } catch (statusError) {
                  const message = getErrorMessage(statusError, 'Unable to update candidate status')
                  setError(message)
                  showToast(message, 'error')
                }
              }}
            >
              {CANDIDATE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {CANDIDATE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Resume</label>
            <p>{candidate.resume?.fileName || 'No resume uploaded yet.'}</p>
            {candidate.resume?.filePath && (
              <a href={candidate.resume.filePath} target="_blank" rel="noreferrer" className="table-action" style={{ marginBottom: '0.55rem' }}>
                <span className="material-symbols-rounded">description</span>
                <span>Preview Resume</span>
              </a>
            )}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              disabled={!canEdit}
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                try {
                  const updated = await uploadCandidateResume(candidate.id, file)
                  setCandidate(updated)
                  setEditValues(toFormValues(updated))
                  showToast('Resume uploaded successfully.', 'success')
                } catch (uploadError) {
                  const message = getErrorMessage(uploadError, 'Unable to upload resume')
                  setError(message)
                  showToast(message, 'error')
                }
              }}
            />
          </div>
        </article>
      </section>

      <section className="overview-grid">
        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">event</span>
            <span>Interview Schedule</span>
          </h3>
          {interviewsLoading && <p className="overview-note">Loading interviews...</p>}
          <div className="field-row">
            <div className="field">
              <label>Stage</label>
              <select
                value={interviewForm.stage}
                disabled={!canEdit}
                onChange={(event) => setInterviewForm((prev) => ({ ...prev, stage: event.target.value as InterviewStage }))}
              >
                {INTERVIEW_STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Interviewer ID</label>
              <input
                value={interviewForm.interviewerId}
                disabled={!canEdit}
                onChange={(event) => setInterviewForm((prev) => ({ ...prev, interviewerId: event.target.value }))}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Scheduled At (IST)</label>
              <input
                type="datetime-local"
                value={interviewForm.scheduledAt}
                disabled={!canEdit}
                onChange={(event) => setInterviewForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Duration (minutes)</label>
              <input
                type="number"
                min={15}
                value={interviewForm.duration}
                disabled={!canEdit}
                onChange={(event) => setInterviewForm((prev) => ({ ...prev, duration: event.target.value }))}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Meeting Link</label>
              <input
                value={interviewForm.meetingLink}
                disabled={!canEdit}
                onChange={(event) => setInterviewForm((prev) => ({ ...prev, meetingLink: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Location</label>
              <input
                value={interviewForm.location}
                disabled={!canEdit}
                onChange={(event) => setInterviewForm((prev) => ({ ...prev, location: event.target.value }))}
              />
            </div>
          </div>
          <button
            type="button"
            className="ghost-btn"
            disabled={!canEdit}
            onClick={async () => {
              if (!candidate) return
              if (!interviewForm.interviewerId.trim() || !interviewForm.scheduledAt.trim()) {
                showToast('Interviewer ID and scheduled date-time are required.', 'error')
                return
              }
              try {
                const updated = await addInterviewToCandidate(candidate.id, {
                  stage: interviewForm.stage,
                  interviewerId: interviewForm.interviewerId.trim(),
                  scheduledAt: interviewForm.scheduledAt,
                  duration: Number(interviewForm.duration) || 60,
                  meetingLink: interviewForm.meetingLink.trim() || undefined,
                  location: interviewForm.location.trim() || undefined,
                })
                setCandidate(updated)
                onInterviewAlert?.('Interview Scheduled', `${candidate.name} scheduled for ${interviewForm.stage}.`)
                showToast('Interview scheduled.', 'success')
              } catch (addInterviewError) {
                const message = getErrorMessage(addInterviewError, 'Unable to schedule interview')
                showToast(message, 'error')
              }
            }}
          >
            Schedule Interview
          </button>
          <ul className="overview-list">
            {(candidate.interviews ?? []).length === 0 && <li className="overview-list__empty">No interviews scheduled.</li>}
            {(candidate.interviews ?? []).map((interview: CandidateInterview, index) => (
              <li key={`${interview._id ?? index}`}>
                <span className="material-symbols-rounded">event</span>
                <span>
                  <strong>{interview.stage}</strong>
                  <small>
                    {interview.interviewer?.name || 'Interviewer pending'} •{' '}
                    {interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : 'No date'}
                  </small>
                </span>
                {canEdit && interview._id && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={async () => {
                      try {
                        const nextResult = interview.result === 'Passed' ? 'Failed' : 'Passed'
                        const updated = await updateInterviewForCandidate(candidate.id, interview._id as string, {
                          result: nextResult,
                          completedAt: new Date().toISOString(),
                        })
                        setCandidate(updated)
                        onInterviewAlert?.('Interview Result Updated', `${candidate.name} interview marked as ${nextResult}.`)
                        showToast(`Interview marked ${nextResult}.`, 'success')
                      } catch (updateError) {
                        const message = getErrorMessage(updateError, 'Unable to update interview result')
                        showToast(message, 'error')
                      }
                    }}
                  >
                    {INTERVIEW_RESULT_OPTIONS.includes((interview.result ?? 'Pending') as (typeof INTERVIEW_RESULT_OPTIONS)[number])
                      ? interview.result
                      : 'Update Result'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="editor-grid">
        <article className="editor-card">
          <h3>Application Journey & Timeline</h3>
          <ul className="candidate-timeline">
            {journeyItems.map((item) => (
              <li key={item.stage} className={`candidate-timeline__item is-${item.state}`}>
                <span className="candidate-timeline__dot">{item.state === 'done' ? '✓' : ''}</span>
                <div className="candidate-timeline__content">
                  <div className="candidate-timeline__row">
                    <strong>{CANDIDATE_STATUS_LABELS[item.stage]}</strong>
                    <small>{item.date ? new Date(item.date).toLocaleDateString() : item.state === 'upcoming' ? 'Pending' : 'In progress'}</small>
                  </div>
                  {item.interviewForStage?.scheduledAt && (
                    <small>
                      Scheduled: {new Date(item.interviewForStage.scheduledAt).toLocaleString()}
                      {item.interviewForStage.interviewer?.name ? ` • Interview with ${item.interviewForStage.interviewer.name}` : ''}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="editor-card">
          <h3>Activity Timeline</h3>
          <ul className="overview-list">
            {activityItems.length === 0 && <li className="overview-list__empty">No activity captured yet.</li>}
            {activityItems.map((item) => (
              <li key={item.id}>
                <span className="material-symbols-rounded">sync_alt</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently updated'}</small>
                </span>
              </li>
            ))}
            {timeline.map((item, index) => (
              <li key={`timeline-${index}`}>
                <span className="material-symbols-rounded">
                  {item.type === 'status_change' ? 'sync_alt' : item.type === 'interview_completed' ? 'task_alt' : 'event_upcoming'}
                </span>
                <span>
                  <strong>{item.type.replaceAll('_', ' ')}</strong>
                  <small>{item.date ? new Date(item.date).toLocaleString() : 'Recently updated'}</small>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  )
}

export default CandidateDetailPage
