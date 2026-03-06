import { useCallback, useEffect, useMemo, useState } from 'react'
import DownloadReportButton from '../../components/reports/DownloadReportButton'
import WeeklyReportTable from '../../components/reports/WeeklyReportTable'
import { getCandidates } from '../../features/candidates/candidateAPI'
import type { CandidateRecord } from '../../features/candidates/candidateTypes'
import type { JobRecord } from '../../features/jobs/jobTypes'
import {
  DEFAULT_WEEKLY_REPORT_FILTERS,
  buildWeeklyReportRows,
  createReportFileName,
  exportWeeklyReport,
  filterWeeklyReportRows,
  getNextScheduledRun,
  getWeeklyReportHistory,
  getWeeklyReportSchedule,
  saveWeeklyReportHistory,
  saveWeeklyReportSchedule,
} from '../../features/reports/reportsAPI'
import type { HistoricalReportRecord, ReportExportFormat, WeeklyReportFilters, WeeklyReportSchedule } from '../../features/reports/reportTypes'
import { getErrorMessage } from '../../utils/errorUtils'

type WeeklyReportPageProps = {
  jobs: JobRecord[]
  jobsLoading: boolean
  jobsError: string | null
  onRetryJobs: () => void
}

const DAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

function formatScheduleDateTime(value: Date | null): string {
  if (!value) return 'Not scheduled'
  return value.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFilterLabel(value: string): string {
  return value === 'all' ? 'All' : value
}

function WeeklyReportPage({ jobs, jobsLoading, jobsError, onRetryJobs }: WeeklyReportPageProps) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [candidateLoading, setCandidateLoading] = useState(true)
  const [candidateError, setCandidateError] = useState<string | null>(null)
  const [filters, setFilters] = useState<WeeklyReportFilters>(DEFAULT_WEEKLY_REPORT_FILTERS)
  const [schedule, setSchedule] = useState<WeeklyReportSchedule>(getWeeklyReportSchedule)
  const [scheduleSavedMessage, setScheduleSavedMessage] = useState('')
  const [historicalReports, setHistoricalReports] = useState<HistoricalReportRecord[]>(getWeeklyReportHistory)

  const loadCandidates = useCallback(async () => {
    setCandidateLoading(true)
    setCandidateError(null)
    try {
      const result = await getCandidates()
      setCandidates(result)
    } catch (loadError) {
      setCandidateError(getErrorMessage(loadError, 'Unable to load candidates for reports'))
    } finally {
      setCandidateLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCandidates()
  }, [loadCandidates])

  useEffect(() => {
    if (!scheduleSavedMessage) return
    const timer = window.setTimeout(() => setScheduleSavedMessage(''), 2800)
    return () => {
      window.clearTimeout(timer)
    }
  }, [scheduleSavedMessage])

  const allRows = useMemo(() => buildWeeklyReportRows(candidates, jobs), [candidates, jobs])
  const filteredRows = useMemo(() => filterWeeklyReportRows(allRows, filters), [allRows, filters])
  const isLoading = jobsLoading || candidateLoading
  const loadError = jobsError || candidateError

  const departments = useMemo(() => Array.from(new Set(allRows.map((row) => row.department))).sort((a, b) => a.localeCompare(b)), [allRows])
  const jobTitles = useMemo(() => Array.from(new Set(allRows.map((row) => row.jobTitle))).sort((a, b) => a.localeCompare(b)), [allRows])
  const recruiters = useMemo(() => Array.from(new Set(allRows.map((row) => row.recruiter))).sort((a, b) => a.localeCompare(b)), [allRows])
  const locations = useMemo(() => Array.from(new Set(allRows.map((row) => row.location))).sort((a, b) => a.localeCompare(b)), [allRows])
  const nextSchedule = useMemo(() => getNextScheduledRun(schedule), [schedule])

  function handleFilterChange<K extends keyof WeeklyReportFilters>(key: K, value: WeeklyReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleClearFilters() {
    setFilters(DEFAULT_WEEKLY_REPORT_FILTERS)
  }

  function handleExport(format: ReportExportFormat) {
    if (filteredRows.length === 0) return
    const fileName = createReportFileName(format)
    exportWeeklyReport(filteredRows, format, fileName)
    const entry: HistoricalReportRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      format,
      fileName,
      rowCount: filteredRows.length,
      filters,
      rows: filteredRows,
    }
    const saved = saveWeeklyReportHistory(entry)
    setHistoricalReports(saved)
  }

  function handleSaveSchedule() {
    const saved = saveWeeklyReportSchedule(schedule)
    setSchedule(saved)
    setScheduleSavedMessage(`Saved. Auto-email runs weekly on ${DAYS.find((day) => day.value === saved.dayOfWeek)?.label ?? 'Friday'} at ${saved.time}.`)
  }

  function handleDownloadHistorical(item: HistoricalReportRecord) {
    exportWeeklyReport(item.rows, item.format, item.fileName)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Dashboard / Reports</p>
          <h1>Report Center</h1>
          <p className="subtitle">Export weekly reports with filters and automated weekly email scheduling.</p>
        </div>
        <DownloadReportButton disabled={isLoading || Boolean(loadError) || filteredRows.length === 0} onExport={handleExport} />
      </div>

      <section className="filters-panel reports-filters-panel">
        <select value={filters.department} onChange={(event) => handleFilterChange('department', event.target.value)}>
          <option value="all">Department: All</option>
          {departments.map((department) => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>
        <select value={filters.jobTitle} onChange={(event) => handleFilterChange('jobTitle', event.target.value)}>
          <option value="all">Job Title: All</option>
          {jobTitles.map((jobTitle) => (
            <option key={jobTitle} value={jobTitle}>{jobTitle}</option>
          ))}
        </select>
        <select value={filters.recruiter} onChange={(event) => handleFilterChange('recruiter', event.target.value)}>
          <option value="all">Recruiter: All</option>
          {recruiters.map((recruiter) => (
            <option key={recruiter} value={recruiter}>{recruiter}</option>
          ))}
        </select>
        <select value={filters.location} onChange={(event) => handleFilterChange('location', event.target.value)}>
          <option value="all">Location: All</option>
          {locations.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(event) => handleFilterChange('dateFrom', event.target.value)} />
        <input type="date" value={filters.dateTo} onChange={(event) => handleFilterChange('dateTo', event.target.value)} />
        <button type="button" className="ghost-btn clear-btn" onClick={handleClearFilters}>Clear Filters</button>
      </section>

      <WeeklyReportTable
        rows={filteredRows}
        loading={isLoading}
        error={loadError}
        onRetry={() => {
          onRetryJobs()
          void loadCandidates()
        }}
      />

      <section className="overview-grid reports-overview-grid">
        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">schedule_send</span>
            <span>Auto-Schedule Email Delivery</span>
          </h3>
          <label className="report-toggle">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(event) => setSchedule((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            Enable weekly auto-email
          </label>
          <div className="reports-schedule-grid">
            <select
              value={String(schedule.dayOfWeek)}
              onChange={(event) => setSchedule((prev) => ({ ...prev, dayOfWeek: Number(event.target.value) }))}
            >
              {DAYS.map((day) => (
                <option key={day.value} value={String(day.value)}>{day.label}</option>
              ))}
            </select>
            <input type="time" value={schedule.time} onChange={(event) => setSchedule((prev) => ({ ...prev, time: event.target.value }))} />
            <input
              type="text"
              placeholder="Recipients (comma separated emails)"
              value={schedule.recipients.join(', ')}
              onChange={(event) =>
                setSchedule((prev) => ({
                  ...prev,
                  recipients: event.target.value.split(',').map((email) => email.trim()).filter((email) => email.length > 0),
                }))
              }
            />
          </div>
          <div className="page-head__actions">
            <button type="button" className="primary-btn" onClick={handleSaveSchedule}>Save Schedule</button>
          </div>
          <p className="overview-note">Next delivery: <strong>{formatScheduleDateTime(nextSchedule)}</strong></p>
          {scheduleSavedMessage && <p className="overview-note">{scheduleSavedMessage}</p>}
        </article>

        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">history</span>
            <span>Historical Reports</span>
          </h3>
          <ul className="overview-list">
            {historicalReports.length === 0 && <li className="overview-list__empty">No historical reports downloaded yet.</li>}
            {historicalReports.map((item) => (
              <li key={item.id} className="report-history-item">
                <span>
                  <strong>{item.fileName}</strong>
                  <br />
                  {new Date(item.createdAt).toLocaleString('en-GB')} • {item.rowCount} rows • {item.format.toUpperCase()}
                  <br />
                  Filters: {formatFilterLabel(item.filters.department)} / {formatFilterLabel(item.filters.jobTitle)} / {formatFilterLabel(item.filters.recruiter)} / {formatFilterLabel(item.filters.location)}
                </span>
                <button type="button" className="ghost-btn" onClick={() => handleDownloadHistorical(item)}>
                  <span className="material-symbols-rounded">download</span>
                  Download
                </button>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  )
}

export default WeeklyReportPage
