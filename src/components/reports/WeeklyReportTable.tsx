import type { WeeklyReportRow } from '../../features/reports/reportTypes'
import { formatDisplayDateIN } from '../../utils/dateUtils'

type WeeklyReportTableProps = {
  rows: WeeklyReportRow[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

function WeeklyReportTable({ rows, loading, error, onRetry }: WeeklyReportTableProps) {
  if (loading) {
    return <p className="panel-message">Loading report data...</p>
  }

  if (error) {
    return (
      <p className="panel-message panel-message--error">
        {error}
        <button type="button" onClick={onRetry}>Retry</button>
      </p>
    )
  }

  if (rows.length === 0) {
    return <p className="panel-message">No records match the selected filters.</p>
  }

  return (
    <div className="table-panel report-table-panel">
      <table>
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Email</th>
            <th>Department</th>
            <th>Job Title</th>
            <th>Recruiter</th>
            <th>Location</th>
            <th>Status</th>
            <th>Applied Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.candidateId}>
              <td>{row.candidateName}</td>
              <td>{row.candidateEmail || '-'}</td>
              <td>{row.department}</td>
              <td>{row.jobTitle}</td>
              <td>{row.recruiter}</td>
              <td>{row.location}</td>
              <td>{row.status}</td>
              <td>{formatDisplayDateIN(row.appliedDate, '-')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default WeeklyReportTable
