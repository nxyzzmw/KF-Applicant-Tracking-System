export type ReportExportFormat = 'excel' | 'pdf'

export type WeeklyReportFilters = {
  department: string
  jobTitle: string
  recruiter: string
  location: string
  dateFrom: string
  dateTo: string
}

export type WeeklyReportRow = {
  candidateId: string
  candidateName: string
  candidateEmail: string
  department: string
  jobTitle: string
  recruiter: string
  location: string
  status: string
  appliedDate?: string
  updatedAt?: string
}

export type WeeklyReportSchedule = {
  enabled: boolean
  frequency: 'weekly'
  dayOfWeek: number
  time: string
  recipients: string[]
}

export type HistoricalReportRecord = {
  id: string
  createdAt: string
  format: ReportExportFormat
  fileName: string
  rowCount: number
  filters: WeeklyReportFilters
  rows: WeeklyReportRow[]
}
