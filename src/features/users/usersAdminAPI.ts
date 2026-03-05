import { apiRequest } from '../../services/axiosInstance'
import { normalizeRole, type AppRole } from '../auth/roleAccess'

export type ManagedUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: AppRole
  status: 'Active' | 'Inactive'
}

export type CreateUserInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  role: AppRole
}

const USERS_CACHE_KEY = 'ats_users_cache'
const envAuthBase = import.meta.env.VITE_AUTH_API_BASE?.trim()
const AUTH_API_BASE = (envAuthBase || '/auth').replace(/\/+$/, '')
const USERS_LIST_ENDPOINTS = import.meta.env.VITE_USERS_LIST_ENDPOINTS?.trim() ?? ''
const USER_REGISTER_ENDPOINTS = import.meta.env.VITE_USER_REGISTER_ENDPOINTS?.trim() ?? ''
const USER_REGISTER_ENDPOINT = import.meta.env.VITE_USER_REGISTER_ENDPOINT?.trim() ?? ''
const USER_ROLE_UPDATE_ENDPOINTS = import.meta.env.VITE_USER_ROLE_UPDATE_ENDPOINTS?.trim() ?? ''

type UserApiRecord = {
  id?: string
  _id?: string
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  status?: string
}

type CreateUserApiResponse =
  | UserApiRecord
  | {
      user?: UserApiRecord
      data?: UserApiRecord
      result?: UserApiRecord
      createdUser?: UserApiRecord
      message?: string
    }

function toBackendRole(role: AppRole): string {
  if (role === 'Super Admin') return 'superadmin'
  if (role === 'HR Recruiter') return 'hrrecruiter'
  if (role === 'Hiring Manager') return 'hiringmanager'
  if (role === 'Interview Panel') return 'interviewpanel'
  return 'management'
}

function fromApi(record: UserApiRecord): ManagedUser {
  const normalizedStatus = (record.status ?? '').trim().toLowerCase()
  return {
    id: record.id ?? record._id ?? '',
    firstName: record.firstName ?? '',
    lastName: record.lastName ?? '',
    email: record.email ?? '',
    role: normalizeRole(record.role),
    status: normalizedStatus === 'inactive' ? 'Inactive' : 'Active',
  }
}

function readLocalUsers(): ManagedUser[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(USERS_CACHE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as ManagedUser[]
  } catch {
    return []
  }
}

function writeLocalUsers(users: ManagedUser[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users))
}

function uniqueEndpoints(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .map((value) => value.replace(/\/auth\/auth(\/|$)/i, '/auth$1')),
    ),
  )
}

export async function getUsers(): Promise<ManagedUser[]> {
  const configured = USERS_LIST_ENDPOINTS.split(',').map((value: string) => value.trim()).filter((value: string) => value.length > 0)
  // No hardcoded /users probing to avoid HTML 404 responses on backends without list-user endpoint.
  const endpoints = uniqueEndpoints(configured)
  if (endpoints.length === 0) return readLocalUsers()
  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest<UserApiRecord[] | { users?: UserApiRecord[]; data?: UserApiRecord[] }>(endpoint)
      const payload = Array.isArray(response) ? response : response.users ?? response.data ?? []
      const users = payload.map(fromApi).filter((user) => user.id)
      writeLocalUsers(users)
      return users
    } catch {
      // try next endpoint
    }
  }
  return readLocalUsers()
}

export async function createUser(input: CreateUserInput): Promise<ManagedUser> {
  const registerBody = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    password: input.password,
  }
  const bodyWithRole = {
    ...registerBody,
    role: toBackendRole(input.role),
  }

  const configured = USER_REGISTER_ENDPOINTS.split(',').map((value: string) => value.trim()).filter((value: string) => value.length > 0)
  const endpoints = uniqueEndpoints([
    USER_REGISTER_ENDPOINT,
    ...configured,
    `${AUTH_API_BASE}/register`,
    '/auth/register',
    '/register',
    '/users',
  ])
  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      const useRegisterPayload = endpoint.toLowerCase().includes('/register')
      const response = await apiRequest<CreateUserApiResponse>(endpoint, {
        method: 'POST',
        body: useRegisterPayload ? registerBody : bodyWithRole,
      })
      const objectResponse = response as Exclude<CreateUserApiResponse, UserApiRecord>
      const record =
        objectResponse.user ??
        objectResponse.data ??
        objectResponse.result ??
        objectResponse.createdUser ??
        (response as UserApiRecord)
      const mapped = fromApi(record)
      if (mapped.id) {
        const existing = readLocalUsers()
        writeLocalUsers([mapped, ...existing.filter((user) => user.id !== mapped.id)])
        return mapped
      }
      // Some backends return success without full user payload; recover from input.
      if (record.email || (objectResponse?.message && !String(objectResponse.message).toLowerCase().includes('error'))) {
        const fallbackCreated: ManagedUser = {
          id: `created-${Date.now()}`,
          firstName: record.firstName ?? input.firstName.trim(),
          lastName: record.lastName ?? input.lastName.trim(),
          email: record.email ?? input.email.trim(),
          role: record.role ? normalizeRole(record.role) : input.role,
          status: record.status?.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
        }
        const existing = readLocalUsers()
        writeLocalUsers([fallbackCreated, ...existing.filter((user) => user.email !== fallbackCreated.email)])
        return fallbackCreated
      }
    } catch (error) {
      lastError = error
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to create user in backend'))
}

export async function updateUserRole(userId: string, role: AppRole): Promise<ManagedUser> {
  const configured = USER_ROLE_UPDATE_ENDPOINTS.split(',').map((value: string) => value.trim()).filter((value: string) => value.length > 0)
  const endpoints = uniqueEndpoints([
    ...configured,
    `/users/${userId}/role`,
    `/users/${userId}`,
  ])
  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest<UserApiRecord | { user?: UserApiRecord; data?: UserApiRecord }>(endpoint, {
        method: 'PATCH',
        body: {
          role: toBackendRole(role),
        },
      })
      const record = (response as { user?: UserApiRecord }).user ?? (response as { data?: UserApiRecord }).data ?? (response as UserApiRecord)
      const mapped = fromApi({ ...record, role: record.role ?? toBackendRole(role), id: record.id ?? record._id ?? userId })
      const existing = readLocalUsers()
      writeLocalUsers(existing.map((user) => (user.id === userId ? mapped : user)))
      return mapped
    } catch (error) {
      lastError = error
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to update user role'))
}
