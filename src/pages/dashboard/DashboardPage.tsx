import { useEffect, useMemo, useState } from 'react'
import { getCandidates } from '../../features/candidates/candidateAPI'
import { CANDIDATE_STATUS_LABELS, type CandidateRecord, type CandidateStatus } from '../../features/candidates/candidateTypes'
import type { JobRecord } from '../../features/jobs/jobTypes'
import { formatDisplayDateIN } from '../../utils/dateUtils'
import { getErrorMessage } from '../../utils/errorUtils'

type DashboardPageProps = {
  jobs: JobRecord[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

function formatShortDate(value?: string): string {
  return formatDisplayDateIN(value, 'No target date')
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function DashboardPage({ jobs, loading, error, onRetry }: DashboardPageProps) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(true)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)

  async function loadCandidateOverview() {
    setCandidatesLoading(true)
    setCandidatesError(null)
    try {
      const result = await getCandidates()
      setCandidates(result)
    } catch (loadError) {
      const message = getErrorMessage(loadError, 'Unable to load candidate overview')
      setCandidatesError(message)
    } finally {
      setCandidatesLoading(false)
    }
  }

  useEffect(() => {
    void loadCandidateOverview()
  }, [])

  const overview = useMemo(() => {
    const now = startOfDay(new Date())
    const daysAhead7 = new Date(now)
    daysAhead7.setDate(now.getDate() + 7)

    const openCount = jobs.filter((job) => job.status === 'Open').length
    const holdCount = jobs.filter((job) => job.status === 'On Hold').length
    const closedCount = jobs.filter((job) => job.status === 'Closed').length
    const filledCount = jobs.filter((job) => job.status === 'Filled').length
    const cancelledCount = jobs.filter((job) => job.status === 'Cancelled').length
    const openPipelineJobs = jobs.filter((job) => !['Closed', 'Filled', 'Cancelled'].includes(job.status))
    const urgentAging = [...openPipelineJobs]
      .filter((job) => job.agingDays >= 7)
      .sort((a, b) => b.agingDays - a.agingDays)
      .slice(0, 3)
    const upcomingClosures = jobs
      .filter((job) => {
        if (!job.targetClosureDate) return false
        const target = startOfDay(new Date(job.targetClosureDate))
        return !Number.isNaN(target.getTime()) && target >= now && target <= daysAhead7
      })
      .sort((a, b) => new Date(a.targetClosureDate ?? '').getTime() - new Date(b.targetClosureDate ?? '').getTime())
      .slice(0, 5)
    const overdueClosures = openPipelineJobs
      .filter((job) => {
        if (!job.targetClosureDate) return false
        const target = startOfDay(new Date(job.targetClosureDate))
        return !Number.isNaN(target.getTime()) && target < now
      })
      .sort((a, b) => new Date(a.targetClosureDate ?? '').getTime() - new Date(b.targetClosureDate ?? '').getTime())
      .slice(0, 2)
    const missingTargetDates = openPipelineJobs.filter((job) => !job.targetClosureDate).slice(0, 2)

    const pendingOpenings = jobs.reduce((sum, job) => sum + Math.max(job.openings - job.filled, 0), 0)
    const totalFilled = jobs.reduce((sum, job) => sum + job.filled, 0)

    const departmentMap = new Map<string, { roles: number; openings: number }>()
    jobs.forEach((job) => {
      const entry = departmentMap.get(job.department) ?? { roles: 0, openings: 0 }
      entry.roles += 1
      entry.openings += Math.max(job.openings - job.filled, 0)
      departmentMap.set(job.department, entry)
    })
    const departments = Array.from(departmentMap.entries())
      .map(([department, values]) => ({ department, ...values }))
      .sort((a, b) => b.openings - a.openings)
      .slice(0, 5)

    return {
      openCount,
      holdCount,
      closedCount,
      filledCount,
      cancelledCount,
      urgentAging,
      upcomingClosures,
      overdueClosures,
      missingTargetDates,
      pendingOpenings,
      totalFilled,
      departments,
    }
  }, [jobs])

  const stats = useMemo(() => {
    const totalActiveJobs = jobs.filter((job) => job.status === 'Open').length
    const totalOpenings = jobs.reduce((sum, job) => sum + job.openings, 0)
    const totalFilled = jobs.reduce((sum, job) => sum + job.filled, 0)
    const fillRate = totalOpenings === 0 ? 0 : Math.round((totalFilled / totalOpenings) * 100)
    return { totalActiveJobs, totalOpenings, fillRate }
  }, [jobs])

  const candidateOverview = useMemo(() => {
    const stageCounts = new Map<CandidateStatus, number>()
    candidates.forEach((candidate) => {
      stageCounts.set(candidate.status, (stageCounts.get(candidate.status) ?? 0) + 1)
    })

    const topStages = Array.from(stageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([status, count]) => ({ status, count }))

    const unassigned = candidates.filter((candidate) => !candidate.recruiter || candidate.recruiter.trim().length === 0).length
    const noNotes = candidates.filter((candidate) => candidate.notes.length === 0).length
    const noResume = candidates.filter((candidate) => !candidate.resume?.fileName).length
    const activePipeline = candidates.filter((candidate) => !['Joined', 'Cancelled'].includes(candidate.status)).length
    const closureRisk = candidates.filter((candidate) =>
      ['Offer Declined', 'Offer Revoked', 'Rejected Technical Interview 1', 'Rejected Technical Interview 2', 'Candidate Not Interested', 'No Answer', 'Rejected'].includes(
        candidate.status,
      ),
    ).length

    return {
      total: candidates.length,
      activePipeline,
      joined: stageCounts.get('Joined') ?? 0,
      offered: (stageCounts.get('Offered') ?? 0) + (stageCounts.get('Offer Accepted') ?? 0),
      noResume,
      noNotes,
      unassigned,
      closureRisk,
      topStages,
    }
  }, [candidates])

  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Dashboard / Job Management</p>
          <h1>Dashboard</h1>
          <p className="subtitle">Pipeline overview and hiring alerts across all requisitions.</p>
        </div>
      </section>

      {loading && <p className="panel-message">Loading dashboard...</p>}
      {error && (
        <p className="panel-message panel-message--error">
          {error} <button onClick={onRetry}>Retry</button>
        </p>
      )}

      {!loading && !error && (
        <>
          <section className="stats-grid">
            <article>
              <p>
                <span className="material-symbols-rounded">query_stats</span>
                <span>Total Active Jobs</span>
              </p>
              <h3>{stats.totalActiveJobs}</h3>
              <small>Live from API</small>
            </article>
            <article>
              <p>
                <span className="material-symbols-rounded">groups</span>
                <span>Total Openings</span>
              </p>
              <h3>{stats.totalOpenings}</h3>
              <small>Across all requisitions</small>
            </article>
            <article>
              <p>
                <span className="material-symbols-rounded">check_circle</span>
                <span>Fill Rate</span>
              </p>
              <h3>{stats.fillRate}%</h3>
              <small>Filled vs total openings</small>
            </article>
          </section>

          <section className="page-head" style={{ marginTop: '0.25rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Job Management Overview</h2>
              <p className="subtitle">Role pipeline, aging risk, and department workload across requisitions.</p>
            </div>
          </section>
          <section className="overview-grid">
            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">monitoring</span>
                <span>Pipeline Status</span>
              </h3>
              <div className="status-split">
                <div>
                  <span>Open</span>
                  <strong>{overview.openCount}</strong>
                </div>
                <div>
                  <span>On Hold</span>
                  <strong>{overview.holdCount}</strong>
                </div>
                <div>
                  <span>Closed</span>
                  <strong>{overview.closedCount}</strong>
                </div>
                <div>
                  <span>Filled</span>
                  <strong>{overview.filledCount}</strong>
                </div>
                <div>
                  <span>Canceled</span>
                  <strong>{overview.cancelledCount}</strong>
                </div>
              </div>
              <p className="overview-note">
                Pending openings: <strong>{overview.pendingOpenings}</strong> | Filled: <strong>{overview.totalFilled}</strong>
              </p>
            </article>

            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">notifications_active</span>
                <span>Priority Alerts</span>
              </h3>
              <ul className="overview-list">
                {overview.urgentAging.length === 0 &&
                  overview.upcomingClosures.length === 0 &&
                  overview.overdueClosures.length === 0 &&
                  overview.missingTargetDates.length === 0 && (
                    <li className="overview-list__empty">No urgent alerts right now.</li>
                  )}
                {overview.overdueClosures.map((job) => (
                  <li key={`overdue-${job.id}`}>
                    <span className="material-symbols-rounded">error</span>
                    <span>
                      <strong>{job.title}</strong> closure overdue since {formatShortDate(job.targetClosureDate)}
                    </span>
                  </li>
                ))}
                {overview.urgentAging.slice(0, 3).map((job) => (
                  <li key={`urgent-${job.id}`}>
                    <span className="material-symbols-rounded">warning</span>
                    <span>
                      <strong>{job.title}</strong> is open for {job.agingDays} days
                    </span>
                  </li>
                ))}
                {overview.upcomingClosures.map((job) => (
                  <li key={`closure-${job.id}`}>
                    <span className="material-symbols-rounded">event_upcoming</span>
                    <span>
                      <strong>{job.title}</strong> closes on {formatShortDate(job.targetClosureDate)}
                    </span>
                  </li>
                ))}
                {overview.missingTargetDates.map((job) => (
                  <li key={`missing-target-${job.id}`}>
                    <span className="material-symbols-rounded">event_busy</span>
                    <span>
                      <strong>{job.title}</strong> has no target closure date
                    </span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">domain</span>
                <span>Department Workload</span>
              </h3>
              <ul className="overview-list overview-list--compact">
                {overview.departments.length === 0 && <li className="overview-list__empty">No department data yet.</li>}
                {overview.departments.map((item) => (
                  <li key={item.department}>
                    <span>{item.department}</span>
                    <span>
                      {item.openings} openings across {item.roles} roles
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="page-head" style={{ marginTop: '0.25rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Candidate Management Overview</h2>
              <p className="subtitle">Live hiring funnel, recruiter ownership, and candidate action alerts.</p>
            </div>
          </section>
          <section className="overview-grid">
            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">group</span>
                <span>Candidate Management Overview</span>
              </h3>
              {candidatesLoading && <p className="overview-note">Loading candidate overview...</p>}
              {candidatesError && (
                <p className="overview-note" style={{ color: 'var(--error)' }}>
                  {candidatesError} <button onClick={() => void loadCandidateOverview()}>Retry</button>
                </p>
              )}
              {!candidatesLoading && !candidatesError && (
                <>
                  <div className="status-split">
                    <div>
                      <span>Total Candidates</span>
                      <strong>{candidateOverview.total}</strong>
                    </div>
                    <div>
                      <span>Active Pipeline</span>
                      <strong>{candidateOverview.activePipeline}</strong>
                    </div>
                    <div>
                      <span>Offered</span>
                      <strong>{candidateOverview.offered}</strong>
                    </div>
                    <div>
                      <span>Joined</span>
                      <strong>{candidateOverview.joined}</strong>
                    </div>
                  </div>
                  <p className="overview-note">
                    Missing resume: <strong>{candidateOverview.noResume}</strong> | Missing notes:{' '}
                    <strong>{candidateOverview.noNotes}</strong> | Unassigned recruiter: <strong>{candidateOverview.unassigned}</strong>
                  </p>
                </>
              )}
            </article>

            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">stacked_bar_chart</span>
                <span>Candidate Stage Distribution</span>
              </h3>
              <ul className="overview-list overview-list--compact">
                {!candidatesLoading && candidateOverview.topStages.length === 0 && (
                  <li className="overview-list__empty">No candidate stage data yet.</li>
                )}
                {candidateOverview.topStages.map((item) => (
                  <li key={item.status}>
                    <span>{CANDIDATE_STATUS_LABELS[item.status]}</span>
                    <span>{item.count} candidates</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">priority_high</span>
                <span>Candidate Action Alerts</span>
              </h3>
              <ul className="overview-list">
                {!candidatesLoading && candidateOverview.unassigned === 0 && candidateOverview.noResume === 0 && candidateOverview.closureRisk === 0 && (
                  <li className="overview-list__empty">No urgent candidate actions right now.</li>
                )}
                {candidateOverview.unassigned > 0 && (
                  <li>
                    <span className="material-symbols-rounded">person_off</span>
                    <span>
                      <strong>{candidateOverview.unassigned}</strong> candidates are not assigned to a recruiter.
                    </span>
                  </li>
                )}
                {candidateOverview.noResume > 0 && (
                  <li>
                    <span className="material-symbols-rounded">description</span>
                    <span>
                      <strong>{candidateOverview.noResume}</strong> candidates do not have resumes uploaded.
                    </span>
                  </li>
                )}
                {candidateOverview.closureRisk > 0 && (
                  <li>
                    <span className="material-symbols-rounded">report</span>
                    <span>
                      <strong>{candidateOverview.closureRisk}</strong> candidates are in risk/rejection stages.
                    </span>
                  </li>
                )}
              </ul>
            </article>
          </section>
        </>
      )}
    </>
  )
}

export default DashboardPage
