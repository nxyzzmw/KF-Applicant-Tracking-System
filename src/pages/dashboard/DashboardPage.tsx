import { useMemo } from 'react'
import type { JobRecord } from '../../features/jobs/jobTypes'
import { formatDisplayDateIN } from '../../utils/dateUtils'

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
        </>
      )}
    </>
  )
}

export default DashboardPage
