import { useCallback, useEffect, useMemo, useState } from 'react'
import { SkeletonRows } from '../../components/common/Loader'
import { getCandidates } from '../../features/candidates/candidateAPI'
import { CANDIDATE_STATUS_LABELS, type CandidateRecord, type CandidateStatus } from '../../features/candidates/candidateTypes'
import { getDashboardFunnel, getDashboardWeeklyStats } from '../../features/dashboard/dashboardAPI'
import type { FunnelStageStats, WeeklyHiringStats } from '../../features/dashboard/dashboardTypes'
import type { JobRecord } from '../../features/jobs/jobTypes'
import { formatDisplayDateIN } from '../../utils/dateUtils'
import { getErrorMessage } from '../../utils/errorUtils'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
 
type DashboardPageProps = {
  jobs: JobRecord[]
  loading: boolean
  error: string | null
  onRetry: () => void
}
 
const PIPELINE_STAGE_ORDER = [
  { label: 'Applied', aliases: ['Applied'] },
  { label: 'Screened', aliases: ['Screened', 'Screening'] },
  { label: 'Shortlisted', aliases: ['Shortlisted'] },
  { label: 'Technical Intv 1', aliases: ['Technical Interview 1', 'Technical Intv 1', 'Technical Round 1'] },
  { label: 'Technical Intv 2', aliases: ['Technical Interview 2', 'Technical Intv 2', 'Technical Round 2'] },
  { label: 'HR Round', aliases: ['HR Round', 'HR Interview'] },
  { label: 'Selected', aliases: ['Selected'] },
  { label: 'Rejected', aliases: ['Rejected', 'Rejected Technical Interview 1', 'Rejected Technical Interview 2'] },
] as const
 
const OUTCOME_COLORS = ['#16a34a', '#dc2626', '#2563eb']
const PIPELINE_STAGE_COLORS = ['#2563eb', '#06b6d4', '#14b8a6', '#f59e0b', '#f97316', '#8b5cf6', '#22c55e', '#ef4444']
const DEPARTMENT_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e']
 
function formatShortDate(value?: string): string {
  return formatDisplayDateIN(value, 'No target date')
}
 
function normalizeStageKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
 
function asChartNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
 
function formatStageDisplayLabel(stage: string): string {
  if (!stage.trim()) return stage
  return stage
    .trim()
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}
 
function formatDateTime(value?: string): { date: string; time: string } {
  if (!value) return { date: 'No date', time: 'No time' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: value, time: '-' }
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}
 
function formatEventTime(value?: string): string {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
 
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(date)
  start.setDate(date.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function toDayKey(date: Date): string {
  return startOfDay(date).toISOString()
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
type TrendViewMode = 'weekly' | 'monthly' | 'yearly'

type DailyHiringTrendPoint = {
  date: Date
  dateKey: string
  dayLabel: string
  newCandidates: number
  filledPositions: number
  openPositions: number
}

type HiringTrendPoint = {
  label: string
  newCandidates: number
  filledPositions: number
  openPositions: number
}

function DashboardPage({ jobs, loading, error, onRetry }: DashboardPageProps) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(true)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const [funnelData, setFunnelData] = useState<FunnelStageStats[]>([])
  const [weeklyStatsData, setWeeklyStatsData] = useState<WeeklyHiringStats[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<TrendViewMode>('weekly')
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0)
 
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
 
  async function loadDashboardCharts() {
    setChartLoading(true)
    setChartError(null)
    try {
      const [funnel, weeklyStats] = await Promise.all([getDashboardFunnel(), getDashboardWeeklyStats()])
      setFunnelData(funnel)
      setWeeklyStatsData(weeklyStats)
    } catch (loadError) {
      const message = getErrorMessage(loadError, 'Unable to load dashboard charts')
      setChartError(message)
    } finally {
      setChartLoading(false)
    }
  }
 
  useEffect(() => {
    void loadCandidateOverview()
    void loadDashboardCharts()
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
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const positionsClosedThisMonth = jobs.filter((job) => {
      if (!job.updatedAt) return false
      const updatedDate = new Date(job.updatedAt)

      return (
        (job.status === 'Closed' || job.status === 'Filled') &&
        updatedDate.getMonth() === currentMonth &&
        updatedDate.getFullYear() === currentYear
      )
    }).length
    const offersMade = candidates.filter((candidate) => candidate.status === 'Offered' || candidate.status === 'Offer Accepted').length
    const offersAccepted = candidates.filter((candidate) => candidate.status === 'Offer Accepted').length
    const offerAcceptanceRatio = offersMade === 0 ? 0 : Math.round((offersAccepted / offersMade) * 100)
    return { totalActiveJobs, totalOpenings, fillRate, positionsClosedThisMonth, offersMade, offersAccepted, offerAcceptanceRatio }
  }, [jobs, candidates])
 
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
 
  const dailyTrendData = useMemo(() => {
    const now = new Date()
    const currentWeek = startOfWeek(now)
    const defaultStart = new Date(currentWeek)
    defaultStart.setDate(defaultStart.getDate() - 11 * 7)
    const timelineStartCandidates: Date[] = []

    weeklyStatsData.forEach((item) => {
      const weekStart = new Date(item.weekStart)
      if (!Number.isNaN(weekStart.getTime())) {
        timelineStartCandidates.push(startOfWeek(weekStart))
      }
    })

    const newCandidatesByDay = new Map<string, number>()
    const filledByDay = new Map<string, number>()

    candidates.forEach((candidate) => {
      if (candidate.createdAt) {
        const createdAt = new Date(candidate.createdAt)
        if (!Number.isNaN(createdAt.getTime())) {
          timelineStartCandidates.push(startOfDay(createdAt))
          const key = toDayKey(createdAt)
          newCandidatesByDay.set(key, (newCandidatesByDay.get(key) ?? 0) + 1)
        }
      }

      candidate.statusHistory.forEach((history) => {
        if (!history.updatedAt) return
        if (!['Selected', 'Joined', 'Offer Accepted'].includes(history.status)) return
        const updatedAt = new Date(history.updatedAt)
        if (Number.isNaN(updatedAt.getTime())) return
        timelineStartCandidates.push(startOfDay(updatedAt))
        const key = toDayKey(updatedAt)
        filledByDay.set(key, (filledByDay.get(key) ?? 0) + 1)
      })
    })

    const earliestDate =
      timelineStartCandidates.length > 0
        ? timelineStartCandidates.reduce((min, current) => (current.getTime() < min.getTime() ? current : min), timelineStartCandidates[0])
        : defaultStart
    const timelineStart = startOfWeek(earliestDate)
    const timelineEnd = new Date(currentWeek)
    timelineEnd.setDate(timelineEnd.getDate() + 6)

    const openPositionsSnapshot = jobs.reduce((sum, job) => sum + Math.max(job.openings - job.filled, 0), 0)

    const points: DailyHiringTrendPoint[] = []
    for (let cursor = new Date(timelineStart); cursor <= timelineEnd; cursor.setDate(cursor.getDate() + 1)) {
      const pointDate = new Date(cursor)
      const dateKey = pointDate.toISOString()
      points.push({
        date: pointDate,
        dateKey,
        dayLabel: DAY_LABELS[pointDate.getDay()] ?? 'Day',
        newCandidates: newCandidatesByDay.get(dateKey) ?? 0,
        filledPositions: filledByDay.get(dateKey) ?? 0,
        openPositions: openPositionsSnapshot,
      })
    }

    return points
  }, [weeklyStatsData, candidates, jobs])

  const weeklyGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; points: DailyHiringTrendPoint[] }> = []
    for (let index = 0; index < dailyTrendData.length; index += 7) {
      const weekPoints = dailyTrendData.slice(index, index + 7)
      if (weekPoints.length < 7) continue
      const weekStart = weekPoints[0].date
      const weekEnd = weekPoints[6].date
      groups.push({
        key: weekPoints[0].dateKey,
        label: `${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        })}`,
        points: weekPoints,
      })
    }
    return groups.reverse()
  }, [dailyTrendData])

  useEffect(() => {
    if (currentWeekIndex > weeklyGroups.length - 1) {
      setCurrentWeekIndex(0)
    }
  }, [weeklyGroups, currentWeekIndex])

  function handlePrevWeek() {
    setCurrentWeekIndex((previous) => Math.min(previous + 1, Math.max(weeklyGroups.length - 1, 0)))
  }

  function handleNextWeek() {
    setCurrentWeekIndex((previous) => Math.max(previous - 1, 0))
  }

  const getWeeklyData = useCallback((): HiringTrendPoint[] => {
    const selectedWeek = weeklyGroups[currentWeekIndex]?.points ?? []
    return selectedWeek.map((point) => ({
      label: point.dayLabel,
      newCandidates: point.newCandidates,
      filledPositions: point.filledPositions,
      openPositions: point.openPositions,
    }))
  }, [weeklyGroups, currentWeekIndex])

  const getMonthlyData = useCallback((): HiringTrendPoint[] => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const buckets = [1, 2, 3, 4].map((week) => ({
      label: `Week ${week}`,
      newCandidates: 0,
      filledPositions: 0,
      openPositions: 0,
    }))

    dailyTrendData.forEach((point) => {
      const pointDate = point.date
      if (pointDate.getFullYear() !== currentYear || pointDate.getMonth() !== currentMonth) return
      const weekOfMonth = Math.min(4, Math.ceil(pointDate.getDate() / 7))
      const bucket = buckets[weekOfMonth - 1]
      bucket.newCandidates += point.newCandidates
      bucket.filledPositions += point.filledPositions
      bucket.openPositions = Math.max(bucket.openPositions, point.openPositions)
    })

    return buckets
  }, [dailyTrendData])

  const getYearlyData = useCallback((): HiringTrendPoint[] => {
    const currentYear = new Date().getFullYear()
    const buckets = MONTH_LABELS.map((month) => ({
      label: month,
      newCandidates: 0,
      filledPositions: 0,
      openPositions: 0,
    }))

    dailyTrendData.forEach((point) => {
      if (point.date.getFullYear() !== currentYear) return
      const bucket = buckets[point.date.getMonth()]
      bucket.newCandidates += point.newCandidates
      bucket.filledPositions += point.filledPositions
      bucket.openPositions = Math.max(bucket.openPositions, point.openPositions)
    })

    return buckets
  }, [dailyTrendData])

  const trendChartData = useMemo(() => {
    if (viewMode === 'monthly') return getMonthlyData()
    if (viewMode === 'yearly') return getYearlyData()
    return getWeeklyData()
  }, [viewMode, getMonthlyData, getWeeklyData, getYearlyData])

  const currentWeekLabel = weeklyGroups[currentWeekIndex]?.label ?? ''
  const isPrevDisabled = currentWeekIndex >= weeklyGroups.length - 1
  const isNextDisabled = currentWeekIndex <= 0

  const normalizedFunnelEntries = useMemo(() => {
    const apiEntries = funnelData.map((item) => ({
      stage: formatStageDisplayLabel(item.stage),
      key: normalizeStageKey(item.stage),
      count: item.count,
    }))

    const candidateStageCounts = new Map<string, number>()
    candidates.forEach((candidate) => {
      const key = normalizeStageKey(candidate.status)
      candidateStageCounts.set(key, (candidateStageCounts.get(key) ?? 0) + 1)
    })
    const candidateEntries = Array.from(candidateStageCounts.entries()).map(([key, count]) => ({
      stage: key,
      key,
      count,
    }))

    const validStageKeys = new Set<string>()
    PIPELINE_STAGE_ORDER.forEach((stage) => {
      validStageKeys.add(normalizeStageKey(stage.label))
      stage.aliases.forEach((alias) => validStageKeys.add(normalizeStageKey(alias)))
    })

    const countMappableTotal = (entries: Array<{ key: string; count: number }>) =>
      entries.reduce((sum, item) => (validStageKeys.has(item.key) ? sum + item.count : sum), 0)

    const apiTotal = countMappableTotal(apiEntries)
    const candidateTotal = countMappableTotal(candidateEntries)

    if (apiTotal > 0 || candidateTotal === 0) return apiEntries
    return candidateEntries
  }, [funnelData, candidates])
 
  const stageAliasToDisplay = useMemo(() => {
    const lookup = new Map<string, (typeof PIPELINE_STAGE_ORDER)[number]['label']>()
    PIPELINE_STAGE_ORDER.forEach((stage) => {
      stage.aliases.forEach((alias) => {
        lookup.set(normalizeStageKey(alias), stage.label)
      })
      lookup.set(normalizeStageKey(stage.label), stage.label)
    })
    return lookup
  }, [])
 
  const funnelChartData = useMemo(() => {
    const stageCounts = new Map<(typeof PIPELINE_STAGE_ORDER)[number]['label'], number>()
 
    normalizedFunnelEntries.forEach((item) => {
      const mappedStage = stageAliasToDisplay.get(item.key)
      if (!mappedStage) return
      stageCounts.set(mappedStage, (stageCounts.get(mappedStage) ?? 0) + item.count)
    })
 
    return PIPELINE_STAGE_ORDER.map((stage) => ({
      stage: stage.label,
      count: stageCounts.get(stage.label) ?? 0,
    }))
  }, [normalizedFunnelEntries, stageAliasToDisplay])
 
  const outcomeChartData = useMemo(() => {
    const getCountByAliases = (aliases: string[]): number => {
      const aliasKeys = new Set(aliases.map((alias) => normalizeStageKey(alias)))
      return normalizedFunnelEntries
        .filter((item) => aliasKeys.has(item.key))
        .reduce((sum, item) => sum + item.count, 0)
    }
 
    const selected = getCountByAliases(['Selected'])
    const rejected = getCountByAliases(['Rejected', 'Rejected Technical Interview 1', 'Rejected Technical Interview 2'])
    const active = getCountByAliases(['Applied', 'Screened', 'Screening', 'Shortlisted', 'Technical Interview 1', 'Technical Interview 2', 'HR Round', 'HR Interview'])
    const total = selected + rejected + active
 
    return [
      { name: 'Selected', count: selected, percentage: total > 0 ? (selected / total) * 100 : 0 },
      { name: 'Rejected', count: rejected, percentage: total > 0 ? (rejected / total) * 100 : 0 },
      { name: 'Active', count: active, percentage: total > 0 ? (active / total) * 100 : 0 },
    ]
  }, [normalizedFunnelEntries])
 
  const jobsById = useMemo(() => {
    const map = new Map<string, JobRecord>()
    jobs.forEach((job) => {
      map.set(job.id, job)
    })
    return map
  }, [jobs])
 
  const upcomingInterviews = useMemo(() => {
    const now = Date.now()
    return candidates
      .flatMap((candidate) =>
        (candidate.interviews ?? []).map((interview, index) => {
          const interviewDate = interview.scheduledAt ? new Date(interview.scheduledAt) : null
          return {
            id: interview._id ?? `${candidate.id}-${index}`,
            candidateName: candidate.name,
            jobTitle: candidate.jobTitle ?? jobsById.get(candidate.jobID)?.title ?? candidate.role ?? 'Unknown role',
            scheduledAt: interview.scheduledAt,
            timestamp: interviewDate && !Number.isNaN(interviewDate.getTime()) ? interviewDate.getTime() : Number.MAX_SAFE_INTEGER,
            mode: interview.meetingLink ? 'Online' : interview.location ? 'Offline' : 'TBD',
          }
        }),
      )
      .filter((item) => item.scheduledAt && item.timestamp >= now && item.timestamp !== Number.MAX_SAFE_INTEGER)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 5)
  }, [candidates, jobsById])
 
  const recentActivities = useMemo(() => {
    const events: Array<{ id: string; description: string; subject: string; timestamp?: string; timeValue: number }> = []
 
    candidates.forEach((candidate) => {
      const candidateLabel = candidate.name || 'Candidate'
      const jobLabel = candidate.jobTitle ?? jobsById.get(candidate.jobID)?.title ?? candidate.role ?? 'Role'
 
      if (candidate.createdAt) {
        events.push({
          id: `candidate-added-${candidate.id}`,
          description: 'Candidate added',
          subject: `${candidateLabel} • ${jobLabel}`,
          timestamp: candidate.createdAt,
          timeValue: new Date(candidate.createdAt).getTime(),
        })
      }
 
      candidate.statusHistory.forEach((item, index) => {
        if (!item.updatedAt) return
        events.push({
          id: `stage-updated-${candidate.id}-${index}-${item.updatedAt}`,
          description: `Candidate stage updated to ${CANDIDATE_STATUS_LABELS[item.status]}`,
          subject: candidateLabel,
          timestamp: item.updatedAt,
          timeValue: new Date(item.updatedAt).getTime(),
        })
      })
 
      candidate.interviews.forEach((item, index) => {
        const eventAt = item.createdAt ?? item.updatedAt ?? item.scheduledAt
        if (!eventAt) return
        events.push({
          id: `interview-${candidate.id}-${index}-${eventAt}`,
          description: 'Interview scheduled',
          subject: `${candidateLabel} • ${item.stage}`,
          timestamp: eventAt,
          timeValue: new Date(eventAt).getTime(),
        })
      })
 
      if (candidate.resume?.uploadedAt) {
        events.push({
          id: `resume-uploaded-${candidate.id}-${candidate.resume.uploadedAt}`,
          description: 'Resume uploaded',
          subject: candidateLabel,
          timestamp: candidate.resume.uploadedAt,
          timeValue: new Date(candidate.resume.uploadedAt).getTime(),
        })
      }
    })
 
    jobs.forEach((job) => {
      if (!job.createdAt) return
      events.push({
        id: `job-created-${job.id}-${job.createdAt}`,
        description: 'Job created',
        subject: job.title,
        timestamp: job.createdAt,
        timeValue: new Date(job.createdAt).getTime(),
      })
    })
 
    return events
      .filter((item) => Number.isFinite(item.timeValue))
      .sort((a, b) => b.timeValue - a.timeValue)
      .slice(0, 8)
  }, [candidates, jobs, jobsById])
 
  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Dashboard / Job Management</p>
          <h1>Dashboard</h1>
          <p className="subtitle">Pipeline overview and hiring alerts across all requisitions.</p>
        </div>
      </section>
 
      {loading && (
        <>
          <section className="stats-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <article key={`stats-skeleton-${index}`}>
                <SkeletonRows rows={3} />
              </article>
            ))}
          </section>
          <section className="overview-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <article key={`overview-skeleton-${index}`} className="overview-card">
                <SkeletonRows rows={6} />
              </article>
            ))}
          </section>
        </>
      )}
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
              <small>Updated just now</small>
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
            <article>
              <p>
                <span className="material-symbols-rounded">handshake</span>
                <span>Offer Acceptance Ratio</span>
              </p>
              <h3>{stats.offerAcceptanceRatio}%</h3>
              <small>
                {stats.offersAccepted} Accepted / {stats.offersMade} Offers
              </small>
            </article>
            <article>
              <p>
                <span className="material-symbols-rounded">event_available</span>
                <span>Positions Closed This Month</span>
              </p>
              <h3>{stats.positionsClosedThisMonth}</h3>
              <small>Roles closed in the current month</small>
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
              {overview.departments.length === 0 && <p className="overview-note">No department data yet.</p>}
              {overview.departments.length > 0 && (
                <div className="dashboard-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.departments} layout="vertical" margin={{ top: 8, right: 32, bottom: 28, left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tickMargin={8} label={{ value: 'Open Roles', position: 'bottom', offset: 8 }} />
                      <YAxis type="category" dataKey="department" width={96} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${asChartNumber(value)}`, 'Open Roles']} />
                      <Bar dataKey="openings" name="Open Roles" radius={[0, 8, 8, 0]} barSize={22}>
                        {overview.departments.map((item, index) => (
                          <Cell key={item.department} fill={DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]} />
                        ))}
                        <LabelList dataKey="openings" position="right" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
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
              {candidatesLoading && <SkeletonRows rows={4} />}
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
                    {/* <div>
                      <span>Active Pipeline</span>
                      <strong>{candidateOverview.activePipeline}</strong>
                    </div> */}
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
 
          <section className="overview-grid dashboard-analytics-layout" style={{ marginTop: '0.8rem' }}>
            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">bar_chart</span>
                <span>Hiring Pipeline (Stage Bar Chart)</span>
              </h3>
              {chartLoading && <SkeletonRows rows={5} />}
              {chartError && (
                <p className="overview-note" style={{ color: 'var(--error)' }}>
                  {chartError} <button onClick={() => void loadDashboardCharts()}>Retry</button>
                </p>
              )}
              {!chartLoading && !chartError && funnelChartData.every((item) => item.count === 0) && <p className="overview-note">No funnel data available.</p>}
              {!chartLoading && !chartError && funnelChartData.length > 0 && (
                <div className="dashboard-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelChartData} layout="horizontal" margin={{ top: 16, right: 24, bottom: 48, left: 52 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        type="category"
                        dataKey="stage"
                        interval={0}
                        tick={{ fontSize: 10 }}
                        height={56}
                        label={{ value: 'Hiring Stages', position: 'insideBottom', offset: -8 }}
                      />
                      <YAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Number of Candidates', angle: -90, position: 'left', offset: 10, style: { textAnchor: 'middle' } }}
                      />
                      <Tooltip
                        formatter={(value) => [`${asChartNumber(value)}`, 'Candidates']}
                        labelFormatter={(label) => `Stage: ${label}`}
                      />
                      <Bar dataKey="count" name="Candidates" radius={[8, 8, 0, 0]} barSize={28}>
                        {funnelChartData.map((item, index) => (
                          <Cell key={item.stage} fill={PIPELINE_STAGE_COLORS[index % PIPELINE_STAGE_COLORS.length]} />
                        ))}
                        <LabelList dataKey="count" position="top" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>
 
            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">pie_chart</span>
                <span>Hiring Outcome</span>
              </h3>
              {chartLoading && <SkeletonRows rows={4} />}
              {chartError && (
                <p className="overview-note" style={{ color: 'var(--error)' }}>
                  {chartError} <button onClick={() => void loadDashboardCharts()}>Retry</button>
                </p>
              )}
              {!chartLoading && !chartError && outcomeChartData.every((item) => item.count === 0) && <p className="overview-note">No outcome data available.</p>}
              {!chartLoading && !chartError && outcomeChartData.length > 0 && (
                <div className="dashboard-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(value, _name, item) => {
                          const percent = asChartNumber((item?.payload as { percentage?: number } | undefined)?.percentage)
                          return [`${asChartNumber(value)} (${percent.toFixed(1)}%)`, 'Candidates']
                        }}
                      />
                      <Legend />
                      <Pie
                        data={outcomeChartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={96}
                        label={(props) => {
                          const payload = (props.payload ?? {}) as { name?: string; count?: number; percentage?: number }
                          const name = payload.name ?? ''
                          const count = asChartNumber(payload.count)
                          const percentage = asChartNumber(payload.percentage)
                          return `${name}: ${count} (${percentage.toFixed(1)}%)`
                        }}
                      >
                        {outcomeChartData.map((item, index) => (
                          <Cell key={item.name} fill={OUTCOME_COLORS[index % OUTCOME_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>
 
            <article className="overview-card dashboard-analytics-card--full">
              <div className="dashboard-trend-header">
                <h3>
                  <span className="material-symbols-rounded">monitoring</span>
                  <span>Hiring Trend</span>
                </h3>
                <div className="dashboard-trend-tabs" role="tablist" aria-label="Hiring trend view">
                  <button
                    type="button"
                    className={viewMode === 'weekly' ? 'is-active' : ''}
                    onClick={() => setViewMode('weekly')}
                    aria-pressed={viewMode === 'weekly'}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'monthly' ? 'is-active' : ''}
                    onClick={() => setViewMode('monthly')}
                    aria-pressed={viewMode === 'monthly'}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'yearly' ? 'is-active' : ''}
                    onClick={() => setViewMode('yearly')}
                    aria-pressed={viewMode === 'yearly'}
                  >
                    Yearly
                  </button>
                </div>
              </div>
              {viewMode === 'weekly' && (
                <div className="dashboard-trend-nav">
                  <button type="button" onClick={handlePrevWeek} disabled={isPrevDisabled}>
                    ← Previous
                  </button>
                  <span>{currentWeekLabel}</span>
                  <button type="button" onClick={handleNextWeek} disabled={isNextDisabled}>
                    Next  →
                  </button>
                </div>
              )}
              {chartLoading && <SkeletonRows rows={5} />}
              {chartError && (
                <p className="overview-note" style={{ color: 'var(--error)' }}>
                  {chartError} <button onClick={() => void loadDashboardCharts()}>Retry</button>
                </p>
              )}
              {!chartLoading && !chartError && trendChartData.length === 0 && <p className="overview-note">No hiring trend data available.</p>}
              {!chartLoading && !chartError && trendChartData.length > 0 && (
                <div className="dashboard-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="newCandidates" name="New Candidates" stroke="#f97316" strokeWidth={2} />
                      <Line type="monotone" dataKey="filledPositions" name="Filled Positions" stroke="#16a34a" strokeWidth={2} />
                      <Line type="monotone" dataKey="openPositions" name="Open Positions" stroke="#0ea5e9" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>
          </section>
 
          <section className="overview-grid dashboard-charts-grid" style={{ marginTop: '0.8rem' }}>
            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">event_upcoming</span>
                <span>Upcoming Interviews</span>
              </h3>
              {candidatesLoading && <SkeletonRows rows={4} />}
              {candidatesError && <p className="overview-note" style={{ color: 'var(--error)' }}>{candidatesError}</p>}
              {!candidatesLoading && !candidatesError && (
                <ul className="overview-list">
                  {upcomingInterviews.length === 0 && <li className="overview-list__empty">No upcoming interviews.</li>}
                  {upcomingInterviews.map((item) => {
                    const schedule = formatDateTime(item.scheduledAt)
                    return (
                      <li key={item.id}>
                        <span className="material-symbols-rounded">event</span>
                        <span>
                          <strong>{item.candidateName}</strong> • {item.jobTitle}
                          <br />
                          {schedule.date} at {schedule.time} • {item.mode}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
 
            <article className="overview-card">
              <h3>
                <span className="material-symbols-rounded">history</span>
                <span>Recent Activities</span>
              </h3>
              {candidatesLoading && <SkeletonRows rows={4} />}
              {candidatesError && <p className="overview-note" style={{ color: 'var(--error)' }}>{candidatesError}</p>}
              {!candidatesLoading && !candidatesError && (
                <ul className="overview-list">
                  {recentActivities.length === 0 && <li className="overview-list__empty">No activity captured yet.</li>}
                  {recentActivities.map((item) => (
                    <li key={item.id}>
                      <span className="material-symbols-rounded">bolt</span>
                      <span>
                        <strong>{item.description}</strong> • {item.subject}
                        <br />
                        {formatEventTime(item.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </>
      )}
    </>
  )
}
 
export default DashboardPage
 
 
