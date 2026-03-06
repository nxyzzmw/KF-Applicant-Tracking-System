import type { CandidateRecord } from '../candidates/candidateTypes'
import type { JobRecord } from '../jobs/jobTypes'
import type { HistoricalReportRecord, ReportExportFormat, WeeklyReportFilters, WeeklyReportRow, WeeklyReportSchedule } from './reportTypes'

const REPORT_SCHEDULE_STORAGE_KEY = 'ats:reports:autoSchedule'
const REPORT_HISTORY_STORAGE_KEY = 'ats:reports:history'
const DEFAULT_REPORT_DAY = 5
const DEFAULT_REPORT_TIME = '10:00'
const MAX_HISTORY_ITEMS = 20

export const DEFAULT_WEEKLY_REPORT_FILTERS: WeeklyReportFilters = {
  department: 'all',
  jobTitle: 'all',
  recruiter: 'all',
  location: 'all',
  dateFrom: '',
  dateTo: '',
}

export const DEFAULT_WEEKLY_REPORT_SCHEDULE: WeeklyReportSchedule = {
  enabled: false,
  frequency: 'weekly',
  dayOfWeek: DEFAULT_REPORT_DAY,
  time: DEFAULT_REPORT_TIME,
  recipients: [],
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim()
}

function normalizeDate(value: string | undefined): number {
  if (!value) return Number.NaN
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? Number.NaN : parsed.getTime()
}

function escapeCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function triggerDownload(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return
  const link = window.document.createElement('a')
  const url = window.URL.createObjectURL(blob)
  link.href = url
  link.download = fileName
  link.click()
  window.URL.revokeObjectURL(url)
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function getJobByIdMap(jobs: JobRecord[]): Map<string, JobRecord> {
  return new Map(jobs.map((job) => [job.id, job]))
}

function startsWithDay(date: Date, day: number): Date {
  const next = new Date(date)
  next.setSeconds(0, 0)
  const diff = (day - next.getDay() + 7) % 7
  next.setDate(next.getDate() + diff)
  return next
}

export function buildWeeklyReportRows(candidates: CandidateRecord[], jobs: JobRecord[]): WeeklyReportRow[] {
  const jobsMap = getJobByIdMap(jobs)
  return candidates.map((candidate) => {
    const relatedJob = jobsMap.get(candidate.jobID)
    return {
      candidateId: candidate.id,
      candidateName: candidate.name || 'Unnamed Candidate',
      candidateEmail: candidate.email || '',
      department: relatedJob?.department || 'Unassigned',
      jobTitle: relatedJob?.title || candidate.jobTitle || candidate.role || 'Unassigned',
      recruiter: normalizeText(candidate.recruiter) || 'Unassigned',
      location: normalizeText(candidate.location) || normalizeText(relatedJob?.location) || 'Unassigned',
      status: candidate.status,
      appliedDate: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    }
  })
}

export function filterWeeklyReportRows(rows: WeeklyReportRow[], filters: WeeklyReportFilters): WeeklyReportRow[] {
  const fromTime = normalizeDate(filters.dateFrom)
  const toTime = normalizeDate(filters.dateTo)

  return rows.filter((row) => {
    if (filters.department !== 'all' && row.department !== filters.department) return false
    if (filters.jobTitle !== 'all' && row.jobTitle !== filters.jobTitle) return false
    if (filters.recruiter !== 'all' && row.recruiter !== filters.recruiter) return false
    if (filters.location !== 'all' && row.location !== filters.location) return false

    if (!Number.isNaN(fromTime) || !Number.isNaN(toTime)) {
      const rowTime = normalizeDate(row.appliedDate)
      if (Number.isNaN(rowTime)) return false
      if (!Number.isNaN(fromTime) && rowTime < fromTime) return false
      if (!Number.isNaN(toTime)) {
        const endDate = new Date(toTime)
        endDate.setHours(23, 59, 59, 999)
        if (rowTime > endDate.getTime()) return false
      }
    }
    return true
  })
}

export function createReportFileName(format: ReportExportFormat, createdAt = new Date()): string {
  const datePart = createdAt.toISOString().slice(0, 10)
  return `weekly-hiring-report-${datePart}.${format === 'excel' ? 'csv' : 'pdf'}`
}

export function exportWeeklyReport(rows: WeeklyReportRow[], format: ReportExportFormat, fileName?: string): string {
  const resolvedFileName = fileName ?? createReportFileName(format)
  if (format === 'excel') {
    const csvRows = [
      ['Candidate Name', 'Email', 'Department', 'Job Title', 'Recruiter', 'Location', 'Status', 'Applied Date'],
      ...rows.map((row) => [
        row.candidateName,
        row.candidateEmail,
        row.department,
        row.jobTitle,
        row.recruiter,
        row.location,
        row.status,
        row.appliedDate ? new Date(row.appliedDate).toLocaleDateString('en-GB') : '-',
      ]),
    ].map((cells) => cells.map((cell) => escapeCsvValue(String(cell))).join(','))
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    triggerDownload(blob, resolvedFileName)
    return resolvedFileName
  }

  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.candidateName)}</td>
          <td>${escapeHtml(row.candidateEmail)}</td>
          <td>${escapeHtml(row.department)}</td>
          <td>${escapeHtml(row.jobTitle)}</td>
          <td>${escapeHtml(row.recruiter)}</td>
          <td>${escapeHtml(row.location)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.appliedDate ? new Date(row.appliedDate).toLocaleDateString('en-GB') : '-')}</td>
        </tr>`,
    )
    .join('')

  if (typeof window !== 'undefined') {
    const printWindow = window.open('', '_blank', 'width=1100,height=760')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${escapeHtml(resolvedFileName)}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
              h1 { margin: 0 0 14px; font-size: 22px; }
              p { margin: 0 0 12px; color: #475569; font-size: 13px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #dbe1ea; padding: 8px; font-size: 12px; text-align: left; }
              th { background: #f1f5f9; }
            </style>
          </head>
          <body>
            <h1>Weekly Hiring Report</h1>
            <p>Generated on ${new Date().toLocaleString('en-GB')}</p>
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
              <tbody>${rowsHtml}</tbody>
            </table>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  return resolvedFileName
}

export function getWeeklyReportHistory(): HistoricalReportRecord[] {
  return readJsonStorage<HistoricalReportRecord[]>(REPORT_HISTORY_STORAGE_KEY, [])
}

export function saveWeeklyReportHistory(record: HistoricalReportRecord): HistoricalReportRecord[] {
  const previous = getWeeklyReportHistory()
  const next = [record, ...previous].slice(0, MAX_HISTORY_ITEMS)
  writeJsonStorage(REPORT_HISTORY_STORAGE_KEY, next)
  return next
}

export function getWeeklyReportSchedule(): WeeklyReportSchedule {
  const schedule = readJsonStorage<WeeklyReportSchedule>(REPORT_SCHEDULE_STORAGE_KEY, DEFAULT_WEEKLY_REPORT_SCHEDULE)
  const parsedTime = normalizeText(schedule.time)
  return {
    ...DEFAULT_WEEKLY_REPORT_SCHEDULE,
    ...schedule,
    dayOfWeek: Number.isInteger(schedule.dayOfWeek) ? schedule.dayOfWeek : DEFAULT_REPORT_DAY,
    time: /^\d{2}:\d{2}$/.test(parsedTime) ? parsedTime : DEFAULT_REPORT_TIME,
    recipients: Array.isArray(schedule.recipients) ? schedule.recipients.filter((email) => normalizeText(email).length > 0) : [],
  }
}

export function saveWeeklyReportSchedule(schedule: WeeklyReportSchedule): WeeklyReportSchedule {
  const cleaned: WeeklyReportSchedule = {
    enabled: Boolean(schedule.enabled),
    frequency: 'weekly',
    dayOfWeek: Number.isInteger(schedule.dayOfWeek) ? schedule.dayOfWeek : DEFAULT_REPORT_DAY,
    time: /^\d{2}:\d{2}$/.test(schedule.time) ? schedule.time : DEFAULT_REPORT_TIME,
    recipients: schedule.recipients.map((email) => normalizeText(email)).filter((email) => email.length > 0),
  }
  writeJsonStorage(REPORT_SCHEDULE_STORAGE_KEY, cleaned)
  return cleaned
}

export function getNextScheduledRun(schedule: WeeklyReportSchedule, now = new Date()): Date | null {
  if (!schedule.enabled) return null
  const [hourText, minuteText] = schedule.time.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

  const dayTarget = startsWithDay(now, schedule.dayOfWeek)
  dayTarget.setHours(hour, minute, 0, 0)
  if (dayTarget.getTime() <= now.getTime()) {
    dayTarget.setDate(dayTarget.getDate() + 7)
  }
  return dayTarget
}
