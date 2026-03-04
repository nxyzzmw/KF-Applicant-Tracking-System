export type AppRole = 'Super Admin' | 'HR Recruiter' | 'Hiring Manager' | 'Interview Panel' | 'Management'

export type RolePermissions = {
  canViewDashboard: boolean
  canViewJobs: boolean
  canCreateJob: boolean
  canEditJob: boolean
  canDeleteJob: boolean
  canViewCandidates: boolean
  canCreateCandidate: boolean
  canEditCandidate: boolean
  canManageCandidateStage: boolean
  canManageUsers: boolean
}

export type RbacPolicy = Record<AppRole, RolePermissions>

export const RBAC_POLICY_STORAGE_KEY = 'ats_rbac_policy'

const ROLE_ALIASES: Record<string, AppRole> = {
  superadmin: 'Super Admin',
  'super admin': 'Super Admin',
  hr: 'HR Recruiter',
  hrrecruiter: 'HR Recruiter',
  recruiter: 'HR Recruiter',
  'hr recruiter': 'HR Recruiter',
  hiringmanager: 'Hiring Manager',
  'hiring manager': 'Hiring Manager',
  interviewpanel: 'Interview Panel',
  interviewer: 'Interview Panel',
  'interview panel': 'Interview Panel',
  management: 'Management',
}

export const ROLE_OPTIONS: AppRole[] = ['Super Admin', 'HR Recruiter', 'Hiring Manager', 'Interview Panel', 'Management']

const DEFAULT_POLICY: RbacPolicy = {
  'Super Admin': {
    canViewDashboard: true,
    canViewJobs: true,
    canCreateJob: true,
    canEditJob: true,
    canDeleteJob: true,
    canViewCandidates: true,
    canCreateCandidate: true,
    canEditCandidate: true,
    canManageCandidateStage: true,
    canManageUsers: true,
  },
  'HR Recruiter': {
    canViewDashboard: true,
    canViewJobs: true,
    canCreateJob: true,
    canEditJob: true,
    canDeleteJob: false,
    canViewCandidates: true,
    canCreateCandidate: true,
    canEditCandidate: true,
    canManageCandidateStage: true,
    canManageUsers: false,
  },
  'Hiring Manager': {
    canViewDashboard: true,
    canViewJobs: true,
    canCreateJob: false,
    canEditJob: false,
    canDeleteJob: false,
    canViewCandidates: true,
    canCreateCandidate: false,
    canEditCandidate: false,
    canManageCandidateStage: false,
    canManageUsers: false,
  },
  'Interview Panel': {
    canViewDashboard: true,
    canViewJobs: false,
    canCreateJob: false,
    canEditJob: false,
    canDeleteJob: false,
    canViewCandidates: true,
    canCreateCandidate: false,
    canEditCandidate: false,
    canManageCandidateStage: false,
    canManageUsers: false,
  },
  Management: {
    canViewDashboard: true,
    canViewJobs: false,
    canCreateJob: false,
    canEditJob: false,
    canDeleteJob: false,
    canViewCandidates: false,
    canCreateCandidate: false,
    canEditCandidate: false,
    canManageCandidateStage: false,
    canManageUsers: false,
  },
}

function mergePolicy(candidate: Partial<RbacPolicy>): RbacPolicy {
  return {
    'Super Admin': { ...DEFAULT_POLICY['Super Admin'], ...(candidate['Super Admin'] ?? {}) },
    'HR Recruiter': { ...DEFAULT_POLICY['HR Recruiter'], ...(candidate['HR Recruiter'] ?? {}) },
    'Hiring Manager': { ...DEFAULT_POLICY['Hiring Manager'], ...(candidate['Hiring Manager'] ?? {}) },
    'Interview Panel': { ...DEFAULT_POLICY['Interview Panel'], ...(candidate['Interview Panel'] ?? {}) },
    Management: { ...DEFAULT_POLICY.Management, ...(candidate.Management ?? {}) },
  }
}

export function normalizeRole(role?: string): AppRole {
  const value = (role ?? '').trim().toLowerCase()
  return ROLE_ALIASES[value] ?? 'HR Recruiter'
}

export function getDefaultPolicy(): RbacPolicy {
  return structuredClone(DEFAULT_POLICY)
}

export function getStoredRbacPolicy(): RbacPolicy {
  if (typeof window === 'undefined') return getDefaultPolicy()
  const raw = localStorage.getItem(RBAC_POLICY_STORAGE_KEY)
  if (!raw) return getDefaultPolicy()
  try {
    return mergePolicy(JSON.parse(raw) as Partial<RbacPolicy>)
  } catch {
    return getDefaultPolicy()
  }
}

export function saveRbacPolicy(policy: RbacPolicy): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RBAC_POLICY_STORAGE_KEY, JSON.stringify(policy))
}

export function getRolePermissions(role?: string): RolePermissions {
  const normalized = normalizeRole(role)
  const policy = getStoredRbacPolicy()
  if (normalized === 'Super Admin') {
    return { ...DEFAULT_POLICY['Super Admin'] }
  }
  return policy[normalized]
}
