import { API_BASE_URL, ApiError } from '../../services/axiosInstance'
import axiosInstance from '../../services/axiosInstance'
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from './authTypes'

const envAuthBase = import.meta.env.VITE_AUTH_API_BASE?.trim()
const AUTH_API_BASE = (envAuthBase || '/auth').replace(/\/+$/, '')

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await axiosInstance.post<LoginResponse>(`${AUTH_API_BASE}/login`, payload)
  return response.data
}

export async function refreshToken(payload: RefreshTokenRequest): Promise<LoginResponse> {
  const response = await axiosInstance.post<LoginResponse>(`${AUTH_API_BASE}/refresh-token`, payload)
  return response.data
}

export async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const response = await axiosInstance.post<ForgotPasswordResponse>(`${AUTH_API_BASE}/forgot-password`, payload)
  return response.data
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const response = await axiosInstance.post<ResetPasswordResponse>(`${AUTH_API_BASE}/reset-password`, payload)
  return response.data
}

export function getApiErrorMessage(error: unknown): string {
  const fallback = 'Something went wrong. Please try again.'
  const backendLabel = API_BASE_URL || window.location.origin

  if (error instanceof ApiError) {
    if (error.data && typeof error.data.message === 'string' && error.data.message) {
      return error.data.message
    }

    return error.message || fallback
  }

  if (error instanceof Error && error.message) {
    if (error.message === 'Failed to fetch') {
      return `Unable to reach backend at ${backendLabel}. Ensure the API server is running and CORS allows this origin.`
    }
    return error.message
  }

  return fallback
}
