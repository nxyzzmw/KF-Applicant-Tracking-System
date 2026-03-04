import { apiRequest } from '../../services/axiosInstance'
import { normalizeRole, type AppRole } from '../auth/roleAccess'

export type ManagedUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: AppRole
  status: 'Active' | 'Invited'
}

export type CreateUserInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  role: AppRole
}

const USERS_CACHE_KEY = 'ats_users_cache'

type UserApiRecord = {
  id?: string
  _id?: string
  firstName?: string
  lastName?: string
  email?: string
  role?: string
}

function toBackendRole(role: AppRole): string {
  if (role === 'Super Admin') return 'superadmin'
  if (role === 'HR Recruiter') return 'hrrecruiter'
  if (role === 'Hiring Manager') return 'hiringmanager'
  if (role === 'Interview Panel') return 'interviewpanel'
  return 'management'
}

function fromApi(record: UserApiRecord): ManagedUser {
  return {
    id: record.id ?? record._id ?? '',
    firstName: record.firstName ?? '',
    lastName: record.lastName ?? '',
    email: record.email ?? '',
    role: normalizeRole(record.role),
    status: 'Active',
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

export async function getUsers(): Promise<ManagedUser[]> {
  const endpoints = ['/users', '/auth/users']
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
  const body = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    password: input.password,
    role: toBackendRole(input.role),
  }

  const endpoints = ['/users', '/auth/register', '/auth/users']
  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest<UserApiRecord | { user?: UserApiRecord; data?: UserApiRecord }>(endpoint, {
        method: 'POST',
        body,
      })
      const record = (response as { user?: UserApiRecord }).user ?? (response as { data?: UserApiRecord }).data ?? (response as UserApiRecord)
      const mapped = fromApi(record)
      if (mapped.id) {
        const existing = readLocalUsers()
        writeLocalUsers([mapped, ...existing.filter((user) => user.id !== mapped.id)])
        return mapped
      }
    } catch {
      // try next endpoint
    }
  }

  const fallback: ManagedUser = {
    id: `local-${Date.now()}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    role: input.role,
    status: 'Invited',
  }
  writeLocalUsers([fallback, ...readLocalUsers()])
  return fallback
}
