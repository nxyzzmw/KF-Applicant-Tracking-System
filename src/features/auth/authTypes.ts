export type AuthUser = {
  id: string
  firstName: string
  lastName: string
  email: string
}

export type RegisterRequest = {
  firstName: string
  lastName: string
  email: string
  password: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type RefreshTokenRequest = {
  refreshToken: string
}

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}
