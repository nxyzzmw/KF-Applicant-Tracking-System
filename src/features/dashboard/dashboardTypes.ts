export type DashboardSummary = {
  totalActiveJobs: number
  totalOpenings: number
  totalFilled: number
  fillRate: number
}

export type FunnelStageStats = {
  stage: string
  count: number
}

export type WeeklyHiringStats = {
  weekStart: string
  openPositions: number
  filledPositions: number
  newCandidates: number
}
