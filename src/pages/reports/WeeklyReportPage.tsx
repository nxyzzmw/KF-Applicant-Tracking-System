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
} from '../../features/reports/reportsAPI'
import type { ReportExportFormat, WeeklyReportFilters } from '../../features/reports/reportTypes'
import { getErrorMessage } from '../../utils/errorUtils'

type WeeklyReportPageProps = {
  jobs: JobRecord[]
  jobsLoading: boolean
  jobsError: string | null
  onRetryJobs: () => void
}

function WeeklyReportPage({ jobs, jobsLoading, jobsError, onRetryJobs }: WeeklyReportPageProps) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [candidateLoading, setCandidateLoading] = useState(true)
  const [candidateError, setCandidateError] = useState<string | null>(null)
  const [filters, setFilters] = useState<WeeklyReportFilters>(DEFAULT_WEEKLY_REPORT_FILTERS)

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

  const allRows = useMemo(() => buildWeeklyReportRows(candidates, jobs), [candidates, jobs])
  const filteredRows = useMemo(() => filterWeeklyReportRows(allRows, filters), [allRows, filters])
  const isLoading = jobsLoading || candidateLoading
  const loadError = jobsError || candidateError

  const departments = useMemo(() => Array.from(new Set(allRows.map((row) => row.department))).sort((a, b) => a.localeCompare(b)), [allRows])
  const jobTitles = useMemo(() => Array.from(new Set(allRows.map((row) => row.jobTitle))).sort((a, b) => a.localeCompare(b)), [allRows])
  const recruiters = useMemo(() => Array.from(new Set(allRows.map((row) => row.recruiter))).sort((a, b) => a.localeCompare(b)), [allRows])
  const locations = useMemo(() => Array.from(new Set(allRows.map((row) => row.location))).sort((a, b) => a.localeCompare(b)), [allRows])
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
        <label className="report-date-filter-field">
          <span>From</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => handleFilterChange('dateFrom', event.target.value)} />
        </label>
        <label className="report-date-filter-field">
          <span>To</span>
          <input type="date" value={filters.dateTo} onChange={(event) => handleFilterChange('dateTo', event.target.value)} />
        </label>
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

      {/* <section className="overview-grid reports-overview-grid">
        Auto scheduling email delivery and historical reports are intentionally commented out.
      </section> */}
    </>
  )
}

export default WeeklyReportPage
