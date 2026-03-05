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
import { getRbacPolicy, resetRbacPolicy, updateRbacPolicy } from '../../features/auth/rbacAPI'
import { createUser, getUsers, updateUserRole, type ManagedUser } from '../../features/users/usersAdminAPI'
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

function getPreviousRole(current: AppRole): AppRole | null {
  const index = ROLE_OPTIONS.indexOf(current)
  if (index <= 0) return null
  return ROLE_OPTIONS[index - 1]
}

function getNextRole(current: AppRole): AppRole | null {
  const index = ROLE_OPTIONS.indexOf(current)
  if (index < 0 || index >= ROLE_OPTIONS.length - 1) return null
  return ROLE_OPTIONS[index + 1]
}

function UserManagementPage({ role, onRbacPolicyUpdated }: UserManagementPageProps) {
  const { showToast } = useToast()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [policyDraft, setPolicyDraft] = useState<RbacPolicy>(getStoredRbacPolicy())
  const [policyLoading, setPolicyLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [usersViewMode, setUsersViewMode] = useState<'list' | 'board'>('list')
  const [showCreateForm, setShowCreateForm] = useState(true)
  const [dragUserId, setDragUserId] = useState<string | null>(null)
  const [dropRole, setDropRole] = useState<AppRole | null>(null)
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

  useEffect(() => {
    let isMounted = true
    async function loadPolicy() {
      setPolicyLoading(true)
      try {
        const remotePolicy = await getRbacPolicy()
        if (!isMounted) return
        setPolicyDraft(remotePolicy)
        saveRbacPolicy(remotePolicy)
        onRbacPolicyUpdated?.()
      } catch {
        // Keep local policy as fallback when backend endpoint is unavailable.
      } finally {
        if (isMounted) setPolicyLoading(false)
      }
    }
    void loadPolicy()
    return () => {
      isMounted = false
    }
    // Intentionally run once to avoid resetting checkboxes while user is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (form.password.trim().length < 8) {
      showToast('Password must be at least 8 characters.', 'error')
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

  async function handleRoleChange(userId: string, nextRole: AppRole) {
    if (!isSuperAdmin) return
    setUpdatingUserId(userId)
    try {
      const updated = await updateUserRole(userId, nextRole)
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: updated.role } : user)))
      showToast('User role updated.', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to update role'), 'error')
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function handleRoleDrop(targetRole: AppRole) {
    if (!dragUserId || !isSuperAdmin) return
    const dragged = users.find((user) => user.id === dragUserId)
    if (!dragged || dragged.role === targetRole) return
    await handleRoleChange(dragUserId, targetRole)
  }

  async function savePolicy() {
    if (!isSuperAdmin) return
    try {
      const saved = await updateRbacPolicy(policyDraft)
      setPolicyDraft(saved)
      saveRbacPolicy(saved)
      onRbacPolicyUpdated?.()
      showToast('RBAC policy updated.', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to save RBAC policy'), 'error')
    }
  }

  async function resetPolicy() {
    if (!isSuperAdmin) return
    try {
      const next = await resetRbacPolicy()
      setPolicyDraft(next)
      saveRbacPolicy(next)
      onRbacPolicyUpdated?.()
      showToast('RBAC reset to default.', 'info')
    } catch (error) {
      const fallback = getDefaultPolicy()
      setPolicyDraft(fallback)
      saveRbacPolicy(fallback)
      onRbacPolicyUpdated?.()
      showToast(getErrorMessage(error, 'Backend reset failed, local RBAC reset applied.'), 'error')
    }
  }

  return (
    <>
      <section className="page-head">
        <div>
          <button type="button" className="ghost-btn" onClick={() => window.history.back()} style={{ marginBottom: '0.45rem' }}>
            <span className="material-symbols-rounded">arrow_back</span>
            <span>Back</span>
          </button>
          <p className="breadcrumb">Administration / Users</p>
          <h1>User & Access Management</h1>
          <p className="subtitle">Super Admin can add users and define what each role can do in the ATS.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="ghost-btn" onClick={() => setUsersViewMode((prev) => (prev === 'list' ? 'board' : 'list'))}>
            <span className="material-symbols-rounded">{usersViewMode === 'list' ? 'view_kanban' : 'table_rows'}</span>
            <span>{usersViewMode === 'list' ? 'Board View' : 'List View'}</span>
          </button>
          <button type="button" className="primary-btn" disabled={!isSuperAdmin} onClick={() => setShowCreateForm((prev) => !prev)}>
            <span className="material-symbols-rounded">person_add</span>
            <span>{showCreateForm ? 'Hide Create Form' : 'Create User'}</span>
          </button>
        </div>
      </section>

      <section className="table-panel">
        <article className="editor-card">
          <h3>
            <span className="material-symbols-rounded">groups</span>
            <span>All Users</span>
          </h3>
          {loadingUsers && <p className="overview-note">Loading users...</p>}
          {usersError && <p className="panel-message panel-message--error">{usersError}</p>}
          {!loadingUsers && !usersError && users.length === 0 && <p className="overview-note">No users available.</p>}
          {!loadingUsers && users.length > 0 && usersViewMode === 'list' && (
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
                      <td>
                        <select
                          value={user.role}
                          disabled={!isSuperAdmin || updatingUserId === user.id}
                          onChange={(event) => void handleRoleChange(user.id, event.target.value as AppRole)}
                        >
                          {ROLE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{user.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loadingUsers && users.length > 0 && usersViewMode === 'board' && (
            <div className="candidate-board" style={{ gridAutoColumns: 'minmax(270px, 270px)' }}>
              {ROLE_OPTIONS.map((roleOption) => {
                const roleUsers = users.filter((user) => user.role === roleOption)
                return (
                  <article
                    key={roleOption}
                    className="candidate-column"
                    data-drop-target={dropRole === roleOption ? 'true' : 'false'}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDropRole(roleOption)
                    }}
                    onDragLeave={() => setDropRole((prev) => (prev === roleOption ? null : prev))}
                    onDrop={(event) => {
                      event.preventDefault()
                      void handleRoleDrop(roleOption)
                      setDragUserId(null)
                      setDropRole(null)
                    }}
                  >
                    <h3>
                      <span>{roleOption}</span>
                      <small>{roleUsers.length}</small>
                    </h3>
                    <div className="candidate-column__list">
                      {roleUsers.map((user) => (
                        <article
                          key={user.id}
                          className="candidate-card"
                          draggable={isSuperAdmin}
                          onDragStart={() => setDragUserId(user.id)}
                          onDragEnd={() => {
                            setDragUserId(null)
                            setDropRole(null)
                          }}
                        >
                          <div className="candidate-card__row">
                            <strong>{`${user.firstName} ${user.lastName}`.trim()}</strong>
                            <span>{user.status}</span>
                          </div>
                          <small>{user.email}</small>
                          <div className="candidate-card__quick-actions">
                            {getPreviousRole(user.role) && (
                              <button
                                type="button"
                                className="candidate-card__quick-btn"
                                disabled={!isSuperAdmin || updatingUserId === user.id}
                                aria-label={`Move ${user.firstName} ${user.lastName} to ${getPreviousRole(user.role)}`}
                                onClick={() => {
                                  const previousRole = getPreviousRole(user.role)
                                  if (previousRole) void handleRoleChange(user.id, previousRole)
                                }}
                              >
                                <span aria-hidden="true">←</span>
                              </button>
                            )}
                            {getNextRole(user.role) && (
                              <button
                                type="button"
                                className="candidate-card__quick-btn"
                                disabled={!isSuperAdmin || updatingUserId === user.id}
                                aria-label={`Move ${user.firstName} ${user.lastName} to ${getNextRole(user.role)}`}
                                onClick={() => {
                                  const nextRole = getNextRole(user.role)
                                  if (nextRole) void handleRoleChange(user.id, nextRole)
                                }}
                              >
                                <span aria-hidden="true">→</span>
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                      {roleUsers.length === 0 && <p className="candidate-column__empty">No users in this role.</p>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </article>
      </section>

      {showCreateForm && <section className="table-panel">
        <article className="editor-card">
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
      </section>}

      <section className="table-panel">
        <article className="editor-card">
          <h3>
            <span className="material-symbols-rounded">shield_lock</span>
            <span>RBAC Permission Matrix</span>
          </h3>
          {policyLoading && <p className="overview-note">Syncing policy from backend...</p>}
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
                          disabled={!isSuperAdmin || policyLoading}
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
            <button type="button" className="primary-btn" disabled={!isSuperAdmin || policyLoading} onClick={savePolicy}>
              Save RBAC Policy
            </button>
            <button type="button" className="ghost-btn" disabled={!isSuperAdmin || policyLoading} onClick={resetPolicy}>
              Reset Defaults
            </button>
          </div>
        </article>
      </section>
    </>
  )
}

export default UserManagementPage
