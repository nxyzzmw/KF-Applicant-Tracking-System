type JsonObject = Record<string, unknown>

type ApiSuccess<T> = {
  data: T
}

export class ApiError extends Error {
  status: number
  data?: JsonObject

  constructor(message: string, status: number, data?: JsonObject) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://10.0.4.111:5000'

function isLikelyHtml(payload: string): boolean {
  const trimmed = payload.trimStart()
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<')
}

function parseJsonSafely(raw: string): JsonObject | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as JsonObject
  } catch {
    return undefined
  }
}

async function post<T>(url: string, payload: unknown): Promise<ApiSuccess<T>> {
  const requestUrl = `${API_BASE_URL}${url}`
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const raw = await response.text()
  const parsed = parseJsonSafely(raw)

  if (!response.ok) {
    const message =
      (parsed && typeof parsed.message === 'string' && parsed.message) ||
      (isLikelyHtml(raw)
        ? `Expected JSON but received HTML from ${requestUrl}. Check API base URL and backend route.`
        : undefined) ||
      `Request failed with status ${response.status}`

    throw new ApiError(message, response.status, parsed)
  }

  if (!parsed) {
    const message = isLikelyHtml(raw)
      ? `Expected JSON but received HTML from ${requestUrl}. Check API base URL and backend route.`
      : `Invalid JSON response from ${requestUrl}`
    throw new ApiError(message, response.status)
  }

  return { data: (parsed as T) ?? ({} as T) }
}

const axiosInstance = {
  post,
}

export default axiosInstance
