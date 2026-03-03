import { ApiError } from '../../services/axiosInstance'
import axiosInstance from '../../services/axiosInstance'
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RegisterRequest,
} from './authTypes'

const AUTH_API_BASE = '/api/auth'

export async function register(payload: RegisterRequest): Promise<void> {
  await axiosInstance.post(`${AUTH_API_BASE}/register`, payload)
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await axiosInstance.post<LoginResponse>(`${AUTH_API_BASE}/login`, payload)
  return response.data
}

export async function refreshToken(payload: RefreshTokenRequest): Promise<LoginResponse> {
  const response = await axiosInstance.post<LoginResponse>(`${AUTH_API_BASE}/refresh-token`, payload)
  return response.data
}

export function getApiErrorMessage(error: unknown): string {
  const fallback = 'Something went wrong. Please try again.'

  if (error instanceof ApiError) {
    if (error.data && typeof error.data.message === 'string' && error.data.message) {
      return error.data.message
    }

    return error.message || fallback
  }

  if (error instanceof Error && error.message) {
    if (error.message === 'Failed to fetch') {
      return 'Unable to reach backend. Ensure the API server is running, the base URL is correct, and CORS allows this origin.'
    }
    return error.message
  }

  return fallback
}
