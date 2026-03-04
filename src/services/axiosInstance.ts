import { getAccessToken } from './tokenService'

type JsonObject = Record<string, unknown>
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
}

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

const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const API_BASE_URL = (envBaseUrl || 'http://10.0.4.50:5000/api').replace(/\/+$/, '')

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers } = options
  const requestUrl = `${API_BASE_URL}${path}`
  const backendLabel = API_BASE_URL || window.location.origin

  const accessToken = getAccessToken()

  let response: Response
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
    throw new ApiError(
      `Unable to reach backend at ${backendLabel}. Ensure the API server is running and CORS allows ${window.location.origin}.`,
      0,
    )
  }

  const raw = await response.text()
  const parsed = parseJsonSafely(raw)

  if (!response.ok) {
    throw new ApiError(toApiErrorMessage(raw, parsed, response.status, requestUrl), response.status, parsed)
  }

  if (response.status === 204 || raw.length === 0) {
    return undefined as T
  }

  if (!parsed) {
    const message = isLikelyHtml(raw)
      ? `Expected JSON but received HTML from ${requestUrl}. Check API base URL and backend route.`
      : `Invalid JSON response from ${requestUrl}`
    throw new ApiError(message, response.status)
  }

  return parsed as T
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
