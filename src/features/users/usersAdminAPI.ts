import { ApiError, apiRequest } from '../../services/axiosInstance'
import { normalizeRole, type AppRole, type RolePermissions } from '../auth/roleAccess'

export type ManagedUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: AppRole
  isActive: boolean
  status: 'Active' | 'Inactive'
  assignedPermissions: Partial<RolePermissions>
}

export type CreateUserInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  role: AppRole
  isActive?: boolean
  permissions?: Partial<RolePermissions>
}

export type UpdateUserInput = {
  role?: AppRole
  isActive?: boolean
  permissions?: Partial<RolePermissions>
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
  isActive?: boolean
  assignedPermissions?: Record<string, unknown>
  permissions?: Record<string, unknown>
}

type CreateUserApiResponse =
  | UserApiRecord
  | {
      success?: boolean
      message?: string
      user?: UserApiRecord
      data?: UserApiRecord
      result?: UserApiRecord
      createdUser?: UserApiRecord
    }

type UserApiResponse =
  | UserApiRecord
  | {
      success?: boolean
      message?: string
      user?: UserApiRecord
      data?: UserApiRecord
      result?: UserApiRecord
    }

type UserListApiResponse =
  | UserApiRecord[]
  | {
      success?: boolean
      users?: UserApiRecord[]
      data?: UserApiRecord[] | { users?: UserApiRecord[]; data?: UserApiRecord[]; items?: UserApiRecord[] }
      items?: UserApiRecord[]
    }

const permissionKeyMap: Record<keyof RolePermissions, string> = {
  canViewDashboard: 'viewDashboard',
  canViewJobs: 'viewJobs',
  canCreateJob: 'createJobs',
  canEditJob: 'editJobs',
  canDeleteJob: 'deleteJobs',
  canViewCandidates: 'viewCandidates',
  canCreateCandidate: 'addCandidates',
  canEditCandidate: 'editCandidates',
  canManageCandidateStage: 'manageCandidateStages',
  canManageUsers: 'manageUsers',
}

const backendToFrontendPermissionMap = Object.entries(permissionKeyMap).reduce<Record<string, keyof RolePermissions>>((acc, [frontend, backend]) => {
  acc[backend] = frontend as keyof RolePermissions
  return acc
}, {})

function toBackendRole(role: AppRole): string {
  if (role === 'Super Admin') return 'superadmin'
  if (role === 'HR Recruiter') return 'hrrecruiter'
  if (role === 'Hiring Manager') return 'hiringmanager'
  if (role === 'Interview Panel') return 'interviewpanel'
  return 'management'
}

function toBackendPermissionOverrides(permissions?: Partial<RolePermissions>): Record<string, boolean> | undefined {
  if (!permissions) return undefined
  const payload: Record<string, boolean> = {}
  ;(Object.keys(permissionKeyMap) as Array<keyof RolePermissions>).forEach((frontendKey) => {
    const value = permissions[frontendKey]
    if (typeof value === 'boolean') {
      payload[permissionKeyMap[frontendKey]] = value
    }
  })
  return Object.keys(payload).length > 0 ? payload : undefined
}

function fromBackendPermissionOverrides(permissions: unknown): Partial<RolePermissions> {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return {}
  const raw = permissions as Record<string, unknown>
  const mapped: Partial<RolePermissions> = {}
  Object.keys(raw).forEach((backendKey) => {
    const frontendKey = backendToFrontendPermissionMap[backendKey]
    if (!frontendKey) return
    const value = raw[backendKey]
    if (typeof value === 'boolean') {
      mapped[frontendKey] = value
    }
  })
  return mapped
}

function extractUserRecord(payload: UserApiResponse): UserApiRecord {
  if (!payload || typeof payload !== 'object') return {}
  const wrapper = payload as { user?: UserApiRecord; data?: UserApiRecord; result?: UserApiRecord }
  return wrapper.user ?? wrapper.data ?? wrapper.result ?? (payload as UserApiRecord)
}

function fromApi(record: UserApiRecord): ManagedUser {
  const normalizedStatus = (record.status ?? '').trim().toLowerCase()
  const isActive = typeof record.isActive === 'boolean' ? record.isActive : normalizedStatus !== 'inactive'
  return {
    id: record.id ?? record._id ?? '',
    firstName: record.firstName ?? '',
    lastName: record.lastName ?? '',
    email: record.email ?? '',
    role: normalizeRole(record.role),
    isActive,
    status: isActive ? 'Active' : 'Inactive',
    assignedPermissions: fromBackendPermissionOverrides(record.assignedPermissions ?? record.permissions),
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
  const endpoints = uniqueEndpoints([...configured, '/users'])
  if (endpoints.length === 0) return readLocalUsers()
  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest<UserListApiResponse>(endpoint)
      const payload = Array.isArray(response)
        ? response
        : Array.isArray(response.data)
          ? response.data
          : response.data && typeof response.data === 'object'
            ? (response.data as { users?: UserApiRecord[]; data?: UserApiRecord[]; items?: UserApiRecord[] }).users ??
              (response.data as { users?: UserApiRecord[]; data?: UserApiRecord[]; items?: UserApiRecord[] }).data ??
              (response.data as { users?: UserApiRecord[]; data?: UserApiRecord[]; items?: UserApiRecord[] }).items ??
              []
            : response.users ?? response.items ?? []
      const users = payload.map(fromApi).filter((user) => user.id)
      writeLocalUsers(users)
      return users
    } catch (error) {
      lastError = error
      if (error instanceof ApiError && error.status !== 404) {
        throw error
      }
      // try next endpoint when route is not found
    }
  }
  if (lastError) throw (lastError instanceof Error ? lastError : new Error('Unable to load users'))
  return readLocalUsers()
}

export async function createUser(input: CreateUserInput): Promise<ManagedUser> {
  const registerPayload = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    password: input.password,
    role: toBackendRole(input.role),
  }
  const createPayload = {
    ...registerPayload,
    ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
    ...(toBackendPermissionOverrides(input.permissions) ? { permissions: toBackendPermissionOverrides(input.permissions) } : {}),
  }

  const configured = USER_REGISTER_ENDPOINTS.split(',').map((value: string) => value.trim()).filter((value: string) => value.length > 0)
  // Backend supports protected admin creation on /users and auth registration on /auth/register.
  const endpoints = uniqueEndpoints([
    ...configured,
    '/users',
    USER_REGISTER_ENDPOINT,
    `${AUTH_API_BASE}/register`,
    '/auth/register',
  ])
  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      const useAdminUsersRoute = /^\/users(\/|$)/i.test(endpoint)
      const response = await apiRequest<CreateUserApiResponse>(endpoint, {
        method: 'POST',
        body: useAdminUsersRoute ? createPayload : registerPayload,
      })
      const objectResponse = response as Exclude<CreateUserApiResponse, UserApiRecord>
      const record = objectResponse.createdUser ?? extractUserRecord(response as UserApiResponse)
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
          isActive: typeof record.isActive === 'boolean' ? record.isActive : true,
          status: record.status?.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
          assignedPermissions: fromBackendPermissionOverrides(record.assignedPermissions ?? record.permissions ?? createPayload.permissions),
        }
        const existing = readLocalUsers()
        writeLocalUsers([fallbackCreated, ...existing.filter((user) => user.email !== fallbackCreated.email)])
        return fallbackCreated
      }
    } catch (error) {
      lastError = error
      if (error instanceof ApiError && error.status !== 404) {
        throw error
      }
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to create user in backend'))
}

export async function updateUserRole(userId: string, role: AppRole): Promise<ManagedUser> {
  return updateUserById(userId, { role })
}

export async function updateUserById(userId: string, input: UpdateUserInput): Promise<ManagedUser> {
  const configured = USER_ROLE_UPDATE_ENDPOINTS.split(',').map((value: string) => value.trim()).filter((value: string) => value.length > 0)
  const endpoints = uniqueEndpoints([
    ...configured,
    `/users/${userId}`,
  ])
  let lastError: unknown = null
  const updatePayload: Record<string, unknown> = {}
  if (input.role) updatePayload.role = toBackendRole(input.role)
  if (typeof input.isActive === 'boolean') updatePayload.isActive = input.isActive
  if (input.permissions) updatePayload.permissions = toBackendPermissionOverrides(input.permissions)

  for (const endpoint of endpoints) {
    try {
      const response = await apiRequest<UserApiResponse>(endpoint, {
        method: 'PUT',
        body: updatePayload,
      })
      const record = extractUserRecord(response)
      const mapped = fromApi({
        ...record,
        role: record.role ?? (input.role ? toBackendRole(input.role) : undefined),
        isActive: typeof record.isActive === 'boolean' ? record.isActive : input.isActive,
        id: record.id ?? record._id ?? userId,
      })
      const existing = readLocalUsers()
      writeLocalUsers(existing.map((user) => (user.id === userId ? mapped : user)))
      return mapped
    } catch (error) {
      lastError = error
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to update user role'))
}

export async function deleteUserById(userId: string): Promise<void> {
  const endpoints = uniqueEndpoints([`/users/${userId}`])
  let lastError: unknown = null
  for (const endpoint of endpoints) {
    try {
      await apiRequest(endpoint, { method: 'DELETE' })
      const existing = readLocalUsers()
      writeLocalUsers(existing.filter((user) => user.id !== userId))
      return
    } catch (error) {
      lastError = error
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to delete user'))
}
