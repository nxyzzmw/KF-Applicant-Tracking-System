import { ApiError } from '../services/axiosInstance'

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.type === 'AuthError' || error.status === 401) return 'Authentication required'
    if (error.type === 'NetworkError') return 'Network error. Check your connection and retry.'
    if (error.type === 'ServerError') return error.message || 'Server error. Please retry.'
    return error.message || fallback
  }
  if (error instanceof Error) return error.message || fallback
  return fallback
}
