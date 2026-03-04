import { useEffect, useMemo, useState } from 'react'
import { getCandidates } from '../../features/candidates/candidateAPI'
import type { CandidateRecord } from '../../features/candidates/candidateTypes'
import type { JobRecord } from '../../features/jobs/jobTypes'
import { formatDayCountLabel, formatDisplayDateIN } from '../../utils/dateUtils'
import { getErrorMessage } from '../../utils/errorUtils'

type JobDetailsPageProps = {
  job: JobRecord | null
  loading: boolean
  error: string | null
  onBack: () => void
  onEdit: () => void
  onManageCandidates: (jobId: string) => void
  canEditJob?: boolean
}

function JobDetailsPage({ job, loading, error, onBack, onEdit, onManageCandidates, canEditJob = true }: JobDetailsPageProps) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)

  useEffect(() => {
    async function loadJobCandidates(jobId: string) {
      setCandidatesLoading(true)
      setCandidatesError(null)
      try {
        const result = await getCandidates({ jobID: jobId })
        setCandidates(result)
      } catch (loadError) {
        setCandidatesError(getErrorMessage(loadError, 'Unable to load candidate list for this job'))
      } finally {
        setCandidatesLoading(false)
      }
    }

    if (job?.id) {
      void loadJobCandidates(job.id)
      return
    }
    setCandidates([])
  }, [job?.id])

  if (loading) return <p className="panel-message">Loading job details...</p>
  if (error) return <p className="panel-message panel-message--error">{error}</p>
  if (!job) return <p className="panel-message panel-message--error">Job not found.</p>

  const fillRatio = job.openings === 0 ? 0 : Math.round((job.filled / job.openings) * 100)
  const candidatesAppliedCount = candidates.length
  const candidatePreview = useMemo(() => candidates.slice(0, 5), [candidates])

  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Jobs / {job.title}</p>
          <h1>{job.title}</h1>
          <p className="subtitle">
            {job.reqId} • {job.department} • {formatDayCountLabel(job.agingDays)}
          </p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="ghost-btn" onClick={onBack}>
            Back to List
          </button>
          <button type="button" className="ghost-btn" onClick={() => onManageCandidates(job.id)}>
            View Candidates
          </button>
          {canEditJob && (
            <button type="button" onClick={onEdit}>
              Edit Requisition
            </button>
          )}
        </div>
      </section>

      <section className="details-grid">
        <article className="editor-card">
          <h3>Job Description</h3>
          <p>{job.description || 'No description provided by the recruiter yet.'}</p>
          <ul className="job-description-list">
            <li>
              <span>Candidates Applied</span>
              <strong>{candidatesAppliedCount}</strong>
            </li>
            <li>
              <span>Filled Positions</span>
              <strong>
                {job.filled} / {job.openings}
              </strong>
            </li>
            <li>
              <span>Pipeline Pending</span>
              <strong>{Math.max(candidatesAppliedCount - job.filled, 0)}</strong>
            </li>
          </ul>
          <h4 style={{ margin: '0.75rem 0 0.35rem' }}>Candidates Applied (Live Sync)</h4>
          {candidatesLoading && <p className="overview-note">Loading candidates...</p>}
          {candidatesError && (
            <p className="panel-message panel-message--error">
              {candidatesError}{' '}
              <button type="button" onClick={() => onManageCandidates(job.id)}>
                Open Candidates
              </button>
            </p>
          )}
          {!candidatesLoading && !candidatesError && candidatePreview.length === 0 && (
            <p className="overview-note">No candidates have applied to this role yet.</p>
          )}
          {!candidatesLoading && !candidatesError && candidatePreview.length > 0 && (
            <ul className="overview-list">
              {candidatePreview.map((candidate) => (
                <li key={candidate.id}>
                  <span className="material-symbols-rounded">person</span>
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.email}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="editor-card">
          <h3>Quick Stats</h3>
          <ul className="details-list">
            <li>
              <span>Status</span>
              <strong>{job.status}</strong>
            </li>
            <li>
              <span>Department</span>
              <strong>{job.department}</strong>
            </li>
            <li>
              <span>Location</span>
              <strong>{job.location || 'Not set'}</strong>
            </li>
            <li>
              <span>Hiring Manager</span>
              <strong>{job.hiringManager || 'Not assigned'}</strong>
            </li>
            <li>
              <span>Employment Type</span>
              <strong>{job.employmentType || 'Not set'}</strong>
            </li>
            <li>
              <span>Target Closure</span>
              <strong>{formatDisplayDateIN(job.targetClosureDate)}</strong>
            </li>
          </ul>
          <div className="progress-block">
            <p>
              Openings Progress <strong>{job.filled} / {job.openings} seats</strong>
            </p>
            <div className="progress-track">
              <span style={{ width: `${fillRatio}%` }} />
            </div>
          </div>
        </article>
      </section>
    </>
  )
}

export default JobDetailsPage
