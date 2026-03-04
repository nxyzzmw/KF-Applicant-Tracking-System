import type { JobRecord } from '../../features/jobs/jobTypes'
import { formatDayCountLabel, formatDisplayDateIN } from '../../utils/dateUtils'

type JobDetailsPageProps = {
  job: JobRecord | null
  loading: boolean
  error: string | null
  onBack: () => void
  onEdit: () => void
}

function JobDetailsPage({ job, loading, error, onBack, onEdit }: JobDetailsPageProps) {
  if (loading) return <p className="panel-message">Loading job details...</p>
  if (error) return <p className="panel-message panel-message--error">{error}</p>
  if (!job) return <p className="panel-message panel-message--error">Job not found.</p>

  const fillRatio = job.openings === 0 ? 0 : Math.round((job.filled / job.openings) * 100)

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
          <button type="button" onClick={onEdit}>
            Edit Requisition
          </button>
        </div>
      </section>

      <section className="details-grid">
        <article className="editor-card">
          <h3>Job Description</h3>
          <p>{job.description || 'No description provided by the recruiter yet.'}</p>
          <ul className="job-description-list">
            <li>
              <span>Candidates Applied</span>
              <strong>{job.candidatesApplied}</strong>
            </li>
            <li>
              <span>Filled Positions</span>
              <strong>
                {job.filled} / {job.openings}
              </strong>
            </li>
            <li>
              <span>Pipeline Pending</span>
              <strong>{Math.max(job.candidatesApplied - job.filled, 0)}</strong>
            </li>
          </ul>
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
