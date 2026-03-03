export function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime())
}

export function formatDayCountLabel(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return '1 Day Open'
  return `${days} Days Open`
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function parseDateInput(value?: string): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split('/').map(Number)
    const date = new Date(yyyy, mm - 1, dd)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toApiDateValue(value?: string): string | undefined {
  const date = parseDateInput(value)
  if (!date) return undefined
  const yyyy = date.getFullYear()
  const mm = pad2(date.getMonth() + 1)
  const dd = pad2(date.getDate())
  return `${yyyy}-${mm}-${dd}`
}

export function toDateInputValue(value?: string): string {
  const date = parseDateInput(value)
  if (!date) return ''
  const yyyy = date.getFullYear()
  const mm = pad2(date.getMonth() + 1)
  const dd = pad2(date.getDate())
  return `${yyyy}-${mm}-${dd}`
}

export function formatDisplayDateIN(value?: string, fallback = 'Not set'): string {
  const date = parseDateInput(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
