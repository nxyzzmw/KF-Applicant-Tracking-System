import { apiRequest } from '../../services/axiosInstance'

export type UserProfile = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

type UserApiRecord = {
  id?: string
  _id?: string
  firstName?: string
  lastName?: string
  email?: string
  role?: string
}

type UserApiPayload =
  | UserApiRecord
  | {
      user?: UserApiRecord
      data?: UserApiRecord
    }

function normalizeProfile(payload: UserApiPayload): UserProfile {
  const record = (payload as { user?: UserApiRecord }).user ?? (payload as { data?: UserApiRecord }).data ?? (payload as UserApiRecord)
  return {
    id: record.id ?? record._id ?? '',
    firstName: record.firstName ?? '',
    lastName: record.lastName ?? '',
    email: record.email ?? '',
    role: record.role ?? '',
  }
}

export async function getMyProfile(): Promise<UserProfile> {
  const endpoints = ['/me', '/auth/me']
  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest<UserApiPayload>(endpoint)
      return normalizeProfile(response)
    } catch {
      // fallback to next endpoint
    }
  }
  throw new Error('Unable to fetch profile from /me or /auth/me')
}

export async function updateMyProfile(input: { firstName: string; lastName: string; email: string }): Promise<UserProfile> {
  const endpoints = ['/update', '/auth/update']
  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest<UserApiPayload>(endpoint, {
        method: 'PUT',
        body: input,
      })
      return normalizeProfile(response)
    } catch {
      // fallback to next endpoint
    }
  }
  throw new Error('Unable to update profile on /update or /auth/update')
}
