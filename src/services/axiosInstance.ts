import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenService'

type JsonObject = Record<string, unknown>
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ApiErrorType = 'AuthError' | 'NetworkError' | 'ServerError' | 'ValidationError'

type RequestOptions = {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  _retry?: boolean
}

type ApiSuccess<T> = {
  data: T
}

export class ApiError extends Error {
  status: number
  data?: JsonObject
  type: ApiErrorType

  constructor(message: string, status: number, data?: JsonObject, type: ApiErrorType = 'ServerError') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.type = type
  }
}

const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const envBaseUrls = import.meta.env.VITE_API_BASE_URLS?.trim()

function parseBaseUrls(): string[] {
  const explicitList = envBaseUrls
    ? envBaseUrls
        .split(',')
        .map((url: string) => url.trim())
        .filter((url: string) => url.length > 0)
    : []

  const single = envBaseUrl ? [envBaseUrl] : []
  // If a single base URL is configured, use only that to avoid noisy multi-host retries.
  if (single.length > 0) {
    return Array.from(new Set(single.map((url) => url.replace(/\/+$/, ''))))
  }

  const defaults = explicitList.length === 0 ? ['/api'] : []
  const combined = [...explicitList, ...defaults]

  // Use explicit API bases only. Avoid auto-fallback to non-/api bases because
  // backend often serves HTML there, which breaks JSON parsing for API calls.
  return Array.from(new Set(combined.map((url) => url.replace(/\/+$/, ''))))
}

const API_BASE_URLS = parseBaseUrls()
export const API_BASE_URL = API_BASE_URLS[0]
let refreshInFlight: Promise<string | null> | null = null

function buildRequestUrl(baseUrl: string, path: string): string {
  const trimmedPath = path.trim()
  if (/^https?:\/\//i.test(trimmedPath)) return trimmedPath
  if (trimmedPath.startsWith('?')) return `${baseUrl}${trimmedPath}`

  const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
  const baseEndsWithApi = /\/api$/i.test(baseUrl)
  const pathStartsWithApi = /^\/api(\/|$)/i.test(normalizedPath)

  if (baseEndsWithApi && pathStartsWithApi) {
    return `${baseUrl}${normalizedPath.replace(/^\/api/i, '')}`
  }

  return `${baseUrl}${normalizedPath}`
}

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

function toApiErrorMessage(raw: string, parsed: JsonObject | undefined, status: number, requestUrl: string): string {
  return (
    (parsed && typeof parsed.message === 'string' && parsed.message) ||
    (isLikelyHtml(raw)
      ? `Expected JSON but received HTML from ${requestUrl}. Check API base URL and backend route.`
      : undefined) ||
    `Request failed with status ${status}`
  )
}

function classifyErrorType(status: number): ApiErrorType {
  if (status === 401) return 'AuthError'
  if (status === 0) return 'NetworkError'
  if (status >= 500) return 'ServerError'
  return 'ValidationError'
}

function dispatchToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('ats:toast', {
      detail: { message, type },
    }),
  )
}

function handleRefreshFailure() {
  clearTokens()
  localStorage.removeItem('token')
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  dispatchToast('Session expired. Please login again.', 'error')
  if (typeof window !== 'undefined') {
    window.location.assign('/login')
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken() || localStorage.getItem('refreshToken')
  if (!refreshToken) return null

  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refreshPaths = ['/auth/refresh', '/auth/refresh-token']
    for (const baseUrl of API_BASE_URLS) {
      for (const path of refreshPaths) {
        const requestUrl = buildRequestUrl(baseUrl, path)
        try {
          const response = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })
          const raw = await response.text()
          const parsed = parseJsonSafely(raw)
          if (!response.ok || !parsed) continue
          const nextAccess = (parsed.accessToken as string | undefined) ?? (parsed.token as string | undefined)
          const nextRefresh = (parsed.refreshToken as string | undefined) ?? refreshToken
          if (!nextAccess) continue
          setTokens(nextAccess, nextRefresh)
          localStorage.setItem('accessToken', nextAccess)
          localStorage.setItem('refreshToken', nextRefresh)
          return nextAccess
        } catch {
          // try next endpoint
        }
      }
    }
    return null
  })()

  const token = await refreshInFlight
  refreshInFlight = null
  return token
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, _retry = false } = options
  const accessToken = getAccessToken()
  const backendLabel = API_BASE_URLS.join(', ')
  let lastError: ApiError | null = null

  for (let index = 0; index < API_BASE_URLS.length; index += 1) {
    const baseUrl = API_BASE_URLS[index]
    const requestUrl = buildRequestUrl(baseUrl, path)
    let response: Response | null = null

    try {
      response = await fetch(requestUrl, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch {
      if (index === API_BASE_URLS.length - 1) {
        throw new ApiError(
          `Unable to reach backend at ${backendLabel}. Ensure the API server is running and CORS allows ${window.location.origin}.`,
          0,
          undefined,
          'NetworkError',
        )
      }
      continue
    }

    if (!response) continue

    const raw = await response.text()
    const parsed = parseJsonSafely(raw)
    const isHtmlPayload = isLikelyHtml(raw)
    const hasMoreBases = index < API_BASE_URLS.length - 1

    // If this base returns HTML (common wrong-origin case), try next base automatically.
    if (isHtmlPayload && hasMoreBases) {
      continue
    }

    if (!response.ok) {
      const message = toApiErrorMessage(raw, parsed, response.status, requestUrl)

      if (response.status === 401 && message === 'User authentication required' && !_retry) {
        const refreshedToken = await refreshAccessToken()
        if (refreshedToken) {
          return apiRequest<T>(path, { ...options, _retry: true })
        }
        handleRefreshFailure()
        throw new ApiError('Authentication required', 401, parsed, 'AuthError')
      }

      const apiError = new ApiError(message, response.status, parsed, classifyErrorType(response.status))
      lastError = apiError
      // 404 means route does not exist on this backend; avoid noisy host probing.
      if (response.status === 404) {
        throw apiError
      }
      if (hasMoreBases && isHtmlPayload) continue
      throw apiError
    }

    if (response.status === 204 || raw.length === 0) {
      return undefined as T
    }

    if (!parsed) {
      const message = isHtmlPayload
        ? `Expected JSON but received HTML from ${requestUrl}. Check API base URL and backend route.`
        : `Invalid JSON response from ${requestUrl}`
      const apiError = new ApiError(message, response.status, undefined, classifyErrorType(response.status))
      lastError = apiError
      if (hasMoreBases) continue
      throw apiError
    }

    return parsed as T
  }

  throw (
    lastError ??
    new ApiError(
      `Unable to reach backend at ${backendLabel}. Ensure the API server is running and CORS allows ${window.location.origin}.`,
      0,
      undefined,
      'NetworkError',
    )
  )
}

async function post<T>(url: string, payload: unknown): Promise<ApiSuccess<T>> {
  const data = await apiRequest<T>(url, {
    method: 'POST',
    body: payload,
  })
  return { data }
}

const axiosInstance = {
  post,
}

export default axiosInstance
