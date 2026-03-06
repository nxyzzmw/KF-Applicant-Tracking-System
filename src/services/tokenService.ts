const ACCESS_TOKEN_KEY = 'ats_access_token'
const REFRESH_TOKEN_KEY = 'ats_refresh_token'
const LEGACY_ACCESS_TOKEN_KEYS = ['accessToken', 'token']
const LEGACY_REFRESH_TOKEN_KEYS = ['refreshToken']

function getFirstAvailable(keys: string[]): string | null {
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value) return value
  }
  return null
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem('accessToken', accessToken)
  localStorage.setItem('token', accessToken)
  localStorage.setItem('refreshToken', refreshToken)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || getFirstAvailable(LEGACY_ACCESS_TOKEN_KEYS)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || getFirstAvailable(LEGACY_REFRESH_TOKEN_KEYS)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  LEGACY_ACCESS_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key))
  LEGACY_REFRESH_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key))
}
