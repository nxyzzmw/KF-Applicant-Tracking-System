import { apiRequest } from '../../services/axiosInstance'
import type { DashboardSummary, FunnelStageStats, WeeklyHiringStats } from './dashboardTypes'

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== 'object') return []

  const root = payload as {
    data?: unknown
    items?: unknown
    results?: unknown
    funnel?: unknown
    weeklyStats?: unknown
    weekly?: unknown
  }
  if (Array.isArray(root.data)) return root.data as T[]
  if (Array.isArray(root.items)) return root.items as T[]
  if (Array.isArray(root.results)) return root.results as T[]
  if (Array.isArray(root.funnel)) return root.funnel as T[]
  if (Array.isArray(root.weeklyStats)) return root.weeklyStats as T[]
  if (Array.isArray(root.weekly)) return root.weekly as T[]

  if (root.data && typeof root.data === 'object') {
    const nested = root.data as {
      data?: unknown
      items?: unknown
      results?: unknown
      funnel?: unknown
      weeklyStats?: unknown
      weekly?: unknown
    }
    if (Array.isArray(nested.data)) return nested.data as T[]
    if (Array.isArray(nested.items)) return nested.items as T[]
    if (Array.isArray(nested.results)) return nested.results as T[]
    if (Array.isArray(nested.funnel)) return nested.funnel as T[]
    if (Array.isArray(nested.weeklyStats)) return nested.weeklyStats as T[]
    if (Array.isArray(nested.weekly)) return nested.weekly as T[]
  }

  return []
}

function resolveStage(row: Record<string, unknown>): string {
  const value = row.stage ?? row.status ?? row.label ?? row.name ?? row.currentStage
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'Unknown'
}

function resolveFunnelCount(row: Record<string, unknown>): number {
  return toNumber(
    row.count ??
      row.candidateCount ??
      row.candidatesCount ??
      row.totalCandidates ??
      row.total ??
      row.value ??
      row.applicants ??
      row.applications,
  )
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const response = await apiRequest<unknown>('/dashboard/summary')
  if (!response || typeof response !== 'object') return null
  const payload = response as Record<string, unknown>
  return {
    totalActiveJobs: toNumber(payload.totalActiveJobs ?? payload.activeJobs),
    totalOpenings: toNumber(payload.totalOpenings ?? payload.openPositions),
    totalFilled: toNumber(payload.totalFilled ?? payload.filledPositions),
    fillRate: toNumber(payload.fillRate),
  }
}

export async function getDashboardFunnel(): Promise<FunnelStageStats[]> {
  const response = await apiRequest<unknown>('/dashboard/funnel')
  // Some backends return an object map, e.g. { Applied: 12, Screening: 7 }.
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    const asRecord = response as Record<string, unknown>
    const objectMap = Object.entries(asRecord).filter(([, value]) => typeof value === 'number' || typeof value === 'string')
    if (objectMap.length > 0 && !('data' in asRecord) && !('items' in asRecord) && !('results' in asRecord) && !('funnel' in asRecord)) {
      return objectMap.map(([stage, count]) => ({ stage, count: toNumber(count) }))
    }
  }

  const rows = toArray<Record<string, unknown>>(response)
  return rows
    .map((row) => ({
      stage: resolveStage(row),
      count: resolveFunnelCount(row),
    }))
    .filter((row) => row.stage.trim().length > 0)
}

export async function getDashboardWeeklyStats(): Promise<WeeklyHiringStats[]> {
  const response = await apiRequest<unknown>('/dashboard/weekly-stats')
  const rows = toArray<Record<string, unknown>>(response)
  return rows.map((row) => ({
    weekStart: typeof row.weekStart === 'string' ? row.weekStart : '',
    openPositions: toNumber(row.openPositions),
    filledPositions: toNumber(row.filledPositions),
    newCandidates: toNumber(row.newCandidates),
  }))
}
