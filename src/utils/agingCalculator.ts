export function calculateAgingDays(createdAt?: string): number {
  if (!createdAt) return 0

  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return 0

  const now = Date.now()
  const diff = Math.max(0, now - created)
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
