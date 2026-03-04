import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/common/ToastProvider'
import {
  getDefaultPolicy,
  getStoredRbacPolicy,
  ROLE_OPTIONS,
  saveRbacPolicy,
  type AppRole,
  type RbacPolicy,
  type RolePermissions,
} from '../../features/auth/roleAccess'
import { createUser, getUsers, type ManagedUser } from '../../features/users/usersAdminAPI'
import { getErrorMessage } from '../../utils/errorUtils'

type UserManagementPageProps = {
  role: string
  onRbacPolicyUpdated?: () => void
}

type CreateUserForm = {
  firstName: string
  lastName: string
  email: string
  password: string
  role: AppRole
}

const permissionLabels: Array<{ key: keyof RolePermissions; label: string }> = [
  { key: 'canViewDashboard', label: 'View Dashboard' },
  { key: 'canViewJobs', label: 'View Jobs' },
  { key: 'canCreateJob', label: 'Create Jobs' },
  { key: 'canEditJob', label: 'Edit Jobs' },
  { key: 'canDeleteJob', label: 'Delete Jobs' },
  { key: 'canViewCandidates', label: 'View Candidates' },
  { key: 'canCreateCandidate', label: 'Add Candidates' },
  { key: 'canEditCandidate', label: 'Edit Candidates' },
  { key: 'canManageCandidateStage', label: 'Manage Candidate Stages' },
  { key: 'canManageUsers', label: 'Manage Users' },
]

const defaultForm: CreateUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'HR Recruiter',
}

function UserManagementPage({ role, onRbacPolicyUpdated }: UserManagementPageProps) {
  const { showToast } = useToast()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [policyDraft, setPolicyDraft] = useState<RbacPolicy>(getStoredRbacPolicy())
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateUserForm>(defaultForm)
  const isSuperAdmin = role === 'Super Admin'

  async function loadUsers() {
    setLoadingUsers(true)
    setUsersError(null)
    try {
      const result = await getUsers()
      setUsers(result)
    } catch (error) {
      setUsersError(getErrorMessage(error, 'Unable to load users'))
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const nonSuperRoles = useMemo(() => ROLE_OPTIONS.filter((item) => item !== 'Super Admin'), [])

  function togglePermission(targetRole: AppRole, key: keyof RolePermissions, checked: boolean) {
    if (!isSuperAdmin) return
    if (targetRole === 'Super Admin') return
    setPolicyDraft((prev) => ({
      ...prev,
      [targetRole]: {
        ...prev[targetRole],
        [key]: checked,
      },
    }))
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isSuperAdmin) return
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim()) {
      showToast('First name, last name, email, and password are required.', 'error')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showToast('Enter a valid email address.', 'error')
      return
    }

    setCreating(true)
    try {
      const created = await createUser(form)
      setUsers((prev) => [created, ...prev.filter((user) => user.id !== created.id)])
      setForm(defaultForm)
      showToast('User created successfully.', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to create user'), 'error')
    } finally {
      setCreating(false)
    }
  }

  function savePolicy() {
    if (!isSuperAdmin) return
    saveRbacPolicy(policyDraft)
    onRbacPolicyUpdated?.()
    showToast('RBAC policy updated.', 'success')
  }

  function resetPolicy() {
    if (!isSuperAdmin) return
    const next = getDefaultPolicy()
    setPolicyDraft(next)
    saveRbacPolicy(next)
    onRbacPolicyUpdated?.()
    showToast('RBAC reset to default.', 'info')
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="breadcrumb">Administration / Users</p>
          <h1>User & Access Management</h1>
          <p className="subtitle">Super Admin can add users and define what each role can do in the ATS.</p>
        </div>
      </section>

      <section className="overview-grid">
        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">person_add</span>
            <span>Add User</span>
          </h3>
          <form className="create-form-grid" onSubmit={(event) => void handleCreateUser(event)}>
            <div className="field">
              <label>First Name</label>
              <input
                value={form.firstName}
                disabled={!isSuperAdmin || creating}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Last Name</label>
              <input
                value={form.lastName}
                disabled={!isSuperAdmin || creating}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                disabled={!isSuperAdmin || creating}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                disabled={!isSuperAdmin || creating}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div className="field field--full">
              <label>Role</label>
              <select
                value={form.role}
                disabled={!isSuperAdmin || creating}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as AppRole }))}
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="editor-actions field--full" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="primary-btn" disabled={!isSuperAdmin || creating}>
                {creating ? 'Creating...' : 'Add User'}
              </button>
            </div>
          </form>
          {!isSuperAdmin && <p className="overview-note">Only Super Admin can create users and manage permissions.</p>}
        </article>

        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">groups</span>
            <span>Users</span>
          </h3>
          {loadingUsers && <p className="overview-note">Loading users...</p>}
          {usersError && <p className="panel-message panel-message--error">{usersError}</p>}
          {!loadingUsers && !usersError && users.length === 0 && <p className="overview-note">No users available.</p>}
          {!loadingUsers && users.length > 0 && (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{`${user.firstName} ${user.lastName}`.trim()}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <section className="overview-grid">
        <article className="overview-card">
          <h3>
            <span className="material-symbols-rounded">shield_lock</span>
            <span>RBAC Permission Matrix</span>
          </h3>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Permission</th>
                  {nonSuperRoles.map((item) => (
                    <th key={item}>{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionLabels.map((permission) => (
                  <tr key={permission.key}>
                    <td>{permission.label}</td>
                    {nonSuperRoles.map((targetRole) => (
                      <td key={`${permission.key}-${targetRole}`}>
                        <input
                          type="checkbox"
                          checked={policyDraft[targetRole][permission.key]}
                          disabled={!isSuperAdmin}
                          onChange={(event) => togglePermission(targetRole, permission.key, event.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="editor-actions" style={{ justifyContent: 'flex-start', marginTop: '0.8rem' }}>
            <button type="button" className="primary-btn" disabled={!isSuperAdmin} onClick={savePolicy}>
              Save RBAC Policy
            </button>
            <button type="button" className="ghost-btn" disabled={!isSuperAdmin} onClick={resetPolicy}>
              Reset Defaults
            </button>
          </div>
        </article>
      </section>
    </>
  )
}

export default UserManagementPage
