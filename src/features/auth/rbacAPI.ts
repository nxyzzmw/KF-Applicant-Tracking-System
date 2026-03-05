import { apiRequest } from '../../services/axiosInstance'
import { type AppRole, type RbacPolicy, type RolePermissions } from './roleAccess'

type BackendRoleKey = 'superadmin' | 'hrrecruiter' | 'hiringmanager' | 'interviewpanel' | 'management'
type BackendPermissionKey =
  | 'viewDashboard'
  | 'viewJobs'
  | 'createJobs'
  | 'editJobs'
  | 'deleteJobs'
  | 'viewCandidates'
  | 'addCandidates'
  | 'editCandidates'
  | 'manageCandidateStages'
  | 'manageUsers'

type BackendPermissionMatrix = Record<BackendPermissionKey, Record<BackendRoleKey, boolean>>

type RbacPolicyApiResponse = {
  id?: string
  name?: string
  permissions?: BackendPermissionMatrix
  updatedAt?: string
}

const RBAC_BASE_ENDPOINT = (import.meta.env.VITE_RBAC_BASE_ENDPOINT?.trim() || '/rbac').replace(/\/+$/, '')

function getPolicyEndpoints() {
  return Array.from(new Set([`${RBAC_BASE_ENDPOINT}/policy`, '/rbac/policy', '/policy']))
}

function getResetEndpoints() {
  return Array.from(new Set([`${RBAC_BASE_ENDPOINT}/policy/reset`, '/rbac/policy/reset', '/policy/reset']))
}

const roleToBackend: Record<AppRole, BackendRoleKey> = {
  'Super Admin': 'superadmin',
  'HR Recruiter': 'hrrecruiter',
  'Hiring Manager': 'hiringmanager',
  'Interview Panel': 'interviewpanel',
  Management: 'management',
}

const backendToRole: Record<BackendRoleKey, AppRole> = {
  superadmin: 'Super Admin',
  hrrecruiter: 'HR Recruiter',
  hiringmanager: 'Hiring Manager',
  interviewpanel: 'Interview Panel',
  management: 'Management',
}

const frontendToBackendPermission: Record<keyof RolePermissions, BackendPermissionKey> = {
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

export function toFrontendPolicy(permissions: BackendPermissionMatrix): RbacPolicy {
  const roles = Object.values(backendToRole)
  const initial = {} as RbacPolicy

  roles.forEach((role) => {
    initial[role] = {
      canViewDashboard: false,
      canViewJobs: false,
      canCreateJob: false,
      canEditJob: false,
      canDeleteJob: false,
      canViewCandidates: false,
      canCreateCandidate: false,
      canEditCandidate: false,
      canManageCandidateStage: false,
      canManageUsers: false,
    }
  })

  ;(Object.keys(frontendToBackendPermission) as Array<keyof RolePermissions>).forEach((permissionKey) => {
    const backendPermissionKey = frontendToBackendPermission[permissionKey]
    ;(Object.keys(backendToRole) as BackendRoleKey[]).forEach((backendRole) => {
      const frontendRole = backendToRole[backendRole]
      initial[frontendRole][permissionKey] = Boolean(permissions?.[backendPermissionKey]?.[backendRole])
    })
  })

  return initial
}

export function toBackendPermissionPatch(policy: RbacPolicy): Partial<BackendPermissionMatrix> {
  const patch: Partial<BackendPermissionMatrix> = {}
  ;(Object.keys(frontendToBackendPermission) as Array<keyof RolePermissions>).forEach((permissionKey) => {
    const backendPermissionKey = frontendToBackendPermission[permissionKey]
    patch[backendPermissionKey] = {} as Record<BackendRoleKey, boolean>
    ;(Object.keys(roleToBackend) as AppRole[]).forEach((frontendRole) => {
      const backendRole = roleToBackend[frontendRole]
      patch[backendPermissionKey]![backendRole] = Boolean(policy[frontendRole][permissionKey])
    })
  })
  return patch
}

export async function getRbacPolicy(): Promise<RbacPolicy> {
  let lastError: unknown = null
  for (const endpoint of getPolicyEndpoints()) {
    try {
      const response = await apiRequest<RbacPolicyApiResponse | { data?: RbacPolicyApiResponse }>(endpoint)
      const payload = (response as { data?: RbacPolicyApiResponse }).data ?? (response as RbacPolicyApiResponse)
      return toFrontendPolicy(payload.permissions as BackendPermissionMatrix)
    } catch (error) {
      lastError = error
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to load RBAC policy'))
}

export async function updateRbacPolicy(policy: RbacPolicy): Promise<RbacPolicy> {
  let lastError: unknown = null
  for (const endpoint of getPolicyEndpoints()) {
    try {
      const response = await apiRequest<RbacPolicyApiResponse | { data?: RbacPolicyApiResponse }>(endpoint, {
        method: 'PUT',
        body: {
          permissions: toBackendPermissionPatch(policy),
        },
      })
      const payload = (response as { data?: RbacPolicyApiResponse }).data ?? (response as RbacPolicyApiResponse)
      return toFrontendPolicy(payload.permissions as BackendPermissionMatrix)
    } catch (error) {
      lastError = error
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to update RBAC policy'))
}

export async function resetRbacPolicy(): Promise<RbacPolicy> {
  let lastError: unknown = null
  for (const endpoint of getResetEndpoints()) {
    try {
      const response = await apiRequest<RbacPolicyApiResponse | { data?: RbacPolicyApiResponse }>(endpoint, {
        method: 'POST',
      })
      const payload = (response as { data?: RbacPolicyApiResponse }).data ?? (response as RbacPolicyApiResponse)
      return toFrontendPolicy(payload.permissions as BackendPermissionMatrix)
    } catch (error) {
      lastError = error
    }
  }
  throw (lastError instanceof Error ? lastError : new Error('Unable to reset RBAC policy'))
}
