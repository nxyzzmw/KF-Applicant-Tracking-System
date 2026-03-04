export type AuthUser = {
  id: string
  firstName: string
  lastName: string
  email: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type RefreshTokenRequest = {
  refreshToken: string
}

export type ForgotPasswordRequest = {
  email: string
}

export type ResetPasswordRequest = {
  email: string
  token: string
  newPassword: string
}

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export type ForgotPasswordResponse = {
  message: string
  resetUrl?: string
}

export type ResetPasswordResponse = {
  message: string
}
