import { useEffect, useMemo, useRef, useState } from 'react'
import { SkeletonRows } from '../../components/common/Loader'
import { useToast } from '../../components/common/ToastProvider'
import { getRolePermissions, ROLE_OPTIONS, type AppRole, type RbacPolicy, type RolePermissions } from '../../features/auth/roleAccess'
import { getRbacPolicy, updateRbacPolicy } from '../../features/auth/rbacAPI'
import { createUser, deleteUserById, getUsers, updateUserById, updateUserRole, type ManagedUser } from '../../features/users/usersAdminAPI'
import { getErrorMessage } from '../../utils/errorUtils'
import Pagination from '../../components/common/Pagination'

type UserManagementPageProps = {
  role: string
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onRbacPolicyUpdated?: () => void
}

type UserPageMode = 'list' | 'create' | 'edit' | 'role-policy'

type CreateUserForm = {
  firstName: string
  lastName: string
  email: string
  password: string
  role: AppRole
  permissions: RolePermissions
}

type EditUserForm = {
  userId: string
  role: AppRole
  isActive: boolean
  permissions: RolePermissions
}

type CreateUserField = 'firstName' | 'lastName' | 'email' | 'password'
type CreateUserErrors = Partial<Record<CreateUserField, string>>

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

function roleClassName(roleValue: AppRole): string {
  return roleValue.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function UserManagementPage({ role, searchTerm, onSearchTermChange, onRbacPolicyUpdated }: UserManagementPageProps) {
  const { showToast } = useToast()
  const [pageMode, setPageMode] = useState<UserPageMode>('list')
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [usersViewMode, setUsersViewMode] = useState<'list' | 'board'>('list')
  const [dragUserId, setDragUserId] = useState<string | null>(null)
  const [dropRole, setDropRole] = useState<AppRole | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingRolePolicy, setSavingRolePolicy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState<CreateUserErrors>({})
  const [usersPage, setUsersPage] = useState(1)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [rolePolicy, setRolePolicy] = useState<RbacPolicy | null>(null)
  const [editForm, setEditForm] = useState<EditUserForm | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const boardDragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  })
  const boardPanRafRef = useRef<number | null>(null)
  const boardPanTargetRef = useRef<number | null>(null)
  const [form, setForm] = useState<CreateUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'HR Recruiter',
    permissions: getRolePermissions('HR Recruiter'),
  })

  const isSuperAdmin = role === 'Super Admin'

  function getRoleDefaultPermissions(roleValue: AppRole): RolePermissions {
    return rolePolicy?.[roleValue] ?? getRolePermissions(roleValue)
  }

  function buildPermissionDraft(roleValue: AppRole, overrides?: Partial<RolePermissions>): RolePermissions {
    return {
      ...getRoleDefaultPermissions(roleValue),
      ...(overrides ?? {}),
    }
  }

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

  async function loadRolePolicy() {
    try {
      const policy = await getRbacPolicy()
      setRolePolicy(policy)
    } catch {
      // keep roleAccess fallback
    }
  }

  useEffect(() => {
    void loadUsers()
    void loadRolePolicy()
  }, [])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      permissions: buildPermissionDraft(prev.role, prev.permissions),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolePolicy])

  useEffect(() => {
    setUsersPage(1)
  }, [users.length, usersViewMode, searchTerm, sortDirection])

  useEffect(() => {
    if (pageMode === 'create') return
    setFormErrors({})
    setShowPassword(false)
  }, [pageMode])

  function renderPermissionMatrix(
    value: RolePermissions,
    onChange: (key: keyof RolePermissions, checked: boolean) => void,
    disabled: boolean,
  ) {
    return (
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Permission</th>
              <th style={{ textAlign: 'center' }}>Allow</th>
            </tr>
          </thead>
          <tbody>
            {permissionLabels.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={value[item.key]}
                    disabled={disabled}
                    onChange={(event) => onChange(item.key, event.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function validateCreateForm(values: CreateUserForm): CreateUserErrors {
    const errors: CreateUserErrors = {}
    const nameRegex = /^[A-Za-z][A-Za-z\s'-]{1,49}$/
    const emailValue = values.email.trim()

    if (!values.firstName.trim()) errors.firstName = 'First name is required.'
    else if (!nameRegex.test(values.firstName.trim())) errors.firstName = 'Enter a valid first name.'

    if (!values.lastName.trim()) errors.lastName = 'Last name is required.'
    else if (!nameRegex.test(values.lastName.trim())) errors.lastName = 'Enter a valid last name.'

    if (!emailValue) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) errors.email = 'Enter a valid email address.'

    if (!values.password) errors.password = 'Password is required.'
    else if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    else if (!/[A-Z]/.test(values.password) || !/[a-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      errors.password = 'Use at least one uppercase letter, one lowercase letter, and one number.'
    }

    return errors
  }

  function hasCreateFormErrors(errors: CreateUserErrors): boolean {
    return Boolean(errors.firstName || errors.lastName || errors.email || errors.password)
  }

  function updateCreateField(field: CreateUserField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isSuperAdmin) return
    const validationErrors = validateCreateForm(form)
    setFormErrors(validationErrors)
    if (hasCreateFormErrors(validationErrors)) {
      return
    }

    setCreating(true)
    try {
      const created = await createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        isActive: true,
        permissions: form.permissions,
      })
      setUsers((prev) => [created, ...prev.filter((user) => user.id !== created.id)])
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'HR Recruiter',
        permissions: getRoleDefaultPermissions('HR Recruiter'),
      })
      setFormErrors({})
      setShowPassword(false)
      setPageMode('list')
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
      setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)))
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

  function autoScrollBoardWhileDragging(clientX: number) {
    if (!dragUserId) return
    const board = boardRef.current
    if (!board) return

    const rect = board.getBoundingClientRect()
    const edgeThreshold = Math.max(56, Math.min(120, rect.width * 0.12))
    let delta = 0

    if (clientX < rect.left + edgeThreshold) {
      const ratio = (rect.left + edgeThreshold - clientX) / edgeThreshold
      delta = -Math.ceil(6 + ratio * 18)
    } else if (clientX > rect.right - edgeThreshold) {
      const ratio = (clientX - (rect.right - edgeThreshold)) / edgeThreshold
      delta = Math.ceil(6 + ratio * 18)
    }

    if (delta !== 0) {
      board.scrollLeft += delta
    }
  }

  function handleBoardMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (usersViewMode !== 'board') return
    if (event.button !== 0) return
    if (!(event.target instanceof Element)) return
    if (event.target.closest('button, select, input, a, textarea, [draggable="true"]')) return
    const board = boardRef.current
    if (!board) return
    event.preventDefault()
    boardDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: board.scrollLeft,
    }
    board.classList.add('is-dragging')
  }

  function handleBoardMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!boardDragRef.current.active) return
    const board = boardRef.current
    if (!board) return
    const delta = event.clientX - boardDragRef.current.startX
    const target = boardDragRef.current.startScrollLeft - delta
    boardPanTargetRef.current = target
    if (boardPanRafRef.current !== null) return
    const animate = () => {
      const activeBoard = boardRef.current
      const nextTarget = boardPanTargetRef.current
      if (!activeBoard || nextTarget === null) {
        boardPanRafRef.current = null
        return
      }
      const current = activeBoard.scrollLeft
      const diff = nextTarget - current
      if (Math.abs(diff) < 0.75) {
        activeBoard.scrollLeft = nextTarget
        boardPanRafRef.current = null
        return
      }
      activeBoard.scrollLeft = current + diff * 0.35
      boardPanRafRef.current = window.requestAnimationFrame(animate)
    }
    boardPanRafRef.current = window.requestAnimationFrame(animate)
  }

  function stopBoardDrag() {
    if (!boardDragRef.current.active) return
    boardDragRef.current.active = false
    boardRef.current?.classList.remove('is-dragging')
    if (boardPanRafRef.current !== null) {
      window.cancelAnimationFrame(boardPanRafRef.current)
      boardPanRafRef.current = null
    }
    boardPanTargetRef.current = null
  }

  async function handleToggleActive(user: ManagedUser) {
    if (!isSuperAdmin) return
    setUpdatingUserId(user.id)
    try {
      const updated = await updateUserById(user.id, { isActive: !user.isActive })
      setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)))
      showToast(`User ${updated.isActive ? 'activated' : 'deactivated'}.`, 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to update user status'), 'error')
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function handleDeleteUser(user: ManagedUser) {
    if (!isSuperAdmin) return
    if (!window.confirm(`Delete ${user.firstName} ${user.lastName}?`)) return
    setUpdatingUserId(user.id)
    try {
      await deleteUserById(user.id)
      setUsers((prev) => prev.filter((item) => item.id !== user.id))
      showToast('User deleted successfully.', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to delete user'), 'error')
    } finally {
      setUpdatingUserId(null)
    }
  }

  function openEditAccess(user: ManagedUser) {
    setEditForm({
      userId: user.id,
      role: user.role,
      isActive: user.isActive,
      permissions: buildPermissionDraft(user.role, user.assignedPermissions),
    })
    setPageMode('edit')
  }

  async function saveEditAccess() {
    if (!editForm || !isSuperAdmin) return
    setUpdatingUserId(editForm.userId)
    try {
      const updated = await updateUserById(editForm.userId, {
        role: editForm.role,
        isActive: editForm.isActive,
        permissions: editForm.permissions,
      })
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setEditForm(null)
      setPageMode('list')
      showToast('User access updated successfully.', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to update user access'), 'error')
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function saveRolePolicy() {
    if (!isSuperAdmin || !rolePolicy) return
    setSavingRolePolicy(true)
    try {
      const saved = await updateRbacPolicy(rolePolicy)
      setRolePolicy(saved)
      onRbacPolicyUpdated?.()
      showToast('Role permission matrix updated.', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to update role permission matrix'), 'error')
    } finally {
      setSavingRolePolicy(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) =>
      `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLowerCase().includes(query),
    )
  }, [users, searchTerm])

  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers].sort((first, second) =>
      `${first.firstName} ${first.lastName}`.trim().localeCompare(`${second.firstName} ${second.lastName}`.trim()),
    )
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [filteredUsers, sortDirection])

  const usersByRole = useMemo(
    () =>
      ROLE_OPTIONS.reduce<Record<AppRole, ManagedUser[]>>((acc, roleOption) => {
        acc[roleOption] = sortedUsers.filter((user) => user.role === roleOption)
        return acc
      }, {} as Record<AppRole, ManagedUser[]>),
    [sortedUsers],
  )

  const usersPageCount = Math.max(1, Math.ceil(sortedUsers.length / 10))
  const usersSafePage = Math.min(usersPage, usersPageCount)
  const pagedUsers = useMemo(() => {
    const start = (usersSafePage - 1) * 10
    return sortedUsers.slice(start, start + 10)
  }, [sortedUsers, usersSafePage])
  const usersRangeStart = sortedUsers.length === 0 ? 0 : (usersSafePage - 1) * 10 + 1
  const usersRangeEnd = Math.min(usersSafePage * 10, sortedUsers.length)

  return (
    <>
      <section className="page-head user-page-head">
        <div>
          <p className="breadcrumb">Administration / Users</p>
          <h1>User & Access Management</h1>
          <p className="subtitle">
            Manage users professionally with individual access overrides and overall role permission matrix.
          </p>
        </div>
        <div className="page-head__actions">
          {pageMode === 'list' && (
            <>
              {usersViewMode === 'list' && (
                <button type="button" className="ghost-btn" onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}>
                  <span className="material-symbols-rounded">sort_by_alpha</span>
                  <span>{sortDirection === 'asc' ? 'A-Z' : 'Z-A'}</span>
                </button>
              )}
              <button type="button" className="ghost-btn" onClick={() => setUsersViewMode((prev) => (prev === 'list' ? 'board' : 'list'))}>
                <span className="material-symbols-rounded">{usersViewMode === 'list' ? 'view_kanban' : 'table_rows'}</span>
                <span>{usersViewMode === 'list' ? 'Board View' : 'List View'}</span>
              </button>
              <button type="button" className="ghost-btn" disabled={!isSuperAdmin} onClick={() => setPageMode('role-policy')}>
                <span className="material-symbols-rounded">shield_lock</span>
                <span>Role Permissions</span>
              </button>
              <button type="button" className="primary-btn" disabled={!isSuperAdmin} onClick={() => setPageMode('create')}>
                <span className="material-symbols-rounded">person_add</span>
                <span>Add User</span>
              </button>
            </>
          )}
          {pageMode !== 'list' && (
            <button type="button" className="ghost-btn" onClick={() => setPageMode('list')}>
              <span className="material-symbols-rounded">arrow_back</span>
              <span>Back to Users</span>
            </button>
          )}
        </div>
      </section>

      {pageMode === 'list' && (
        <>
          <section className="filters-panel candidate-filters-panel user-filters-panel">
            <label className="candidate-search-input">
              <span className="material-symbols-rounded" aria-hidden="true">search</span>
              <input
                type="search"
                placeholder="Search by name, email, role..."
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
              />
            </label>
            <button type="button" className="ghost-btn clear-btn" onClick={() => onSearchTermChange('')}>
              Clear All
            </button>
          </section>

          {loadingUsers && (
            <section className="table-panel">
              <div style={{ padding: '0.8rem' }}>
                <SkeletonRows rows={8} />
              </div>
            </section>
          )}
          {usersError && <p className="panel-message panel-message--error">{usersError}</p>}
          {!loadingUsers && !usersError && sortedUsers.length === 0 && <p className="overview-note">No users available.</p>}

          {!loadingUsers && sortedUsers.length > 0 && usersViewMode === 'list' && (
            <section className="table-panel user-table-panel">
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((user) => (
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
                        <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="actions-cell">
                            <button type="button" className="table-action" disabled={!isSuperAdmin || updatingUserId === user.id} onClick={() => openEditAccess(user)}>
                              <span className="material-symbols-rounded">tune</span>
                              <span>Edit</span>
                            </button>
                            <button type="button" className="table-action" disabled={!isSuperAdmin || updatingUserId === user.id} onClick={() => void handleToggleActive(user)}>
                              <span className="material-symbols-rounded">{user.isActive ? 'person_off' : 'person_check'}</span>
                              <span>{user.isActive ? 'Deactivate' : 'Activate'}</span>
                            </button>
                            <button
                              type="button"
                              className="table-action table-action--danger"
                              disabled={!isSuperAdmin || updatingUserId === user.id}
                              onClick={() => void handleDeleteUser(user)}
                            >
                              <span className="material-symbols-rounded">delete</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
              <div className="table-footer">
                <p>
                  Showing <strong>{usersRangeStart}</strong> to <strong>{usersRangeEnd}</strong> of <strong>{sortedUsers.length}</strong> users
                </p>
                <Pagination page={usersSafePage} pageCount={usersPageCount} onPageChange={setUsersPage} />
              </div>
            </section>
          )}

          {!loadingUsers && sortedUsers.length > 0 && usersViewMode === 'board' && (
            <section
              className="candidate-board user-board-surface"
              ref={boardRef}
              onMouseDown={handleBoardMouseDown}
              onMouseMove={handleBoardMouseMove}
              onMouseUp={stopBoardDrag}
              onMouseLeave={stopBoardDrag}
              onDragOver={(event) => autoScrollBoardWhileDragging(event.clientX)}
            >
                {ROLE_OPTIONS.map((roleOption) => {
                  const roleUsers = usersByRole[roleOption]
                  return (
                    <article
                      key={roleOption}
                      className={`candidate-column candidate-column--${roleClassName(roleOption)}`}
                      data-drop-target={dropRole === roleOption ? 'true' : 'false'}
                      onDragOver={(event) => {
                        autoScrollBoardWhileDragging(event.clientX)
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
                      <div className="candidate-column__list job-board__list">
                        {roleUsers.map((user) => (
                          <article
                            key={user.id}
                            className="candidate-card"
                            draggable={isSuperAdmin}
                            onDragStart={() => {
                              stopBoardDrag()
                              setDragUserId(user.id)
                            }}
                            onDragEnd={() => {
                              setDragUserId(null)
                              setDropRole(null)
                            }}
                          >
                            <div className="candidate-card__row">
                              <strong>{`${user.firstName} ${user.lastName}`.trim()}</strong>
                              <span>{user.email}</span>
                            </div>
                            <small>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </small>
                            <div className="candidate-card__quick-actions">
                              {getPreviousRole(user.role) && (
                                <button
                                  type="button"
                                  className="candidate-card__quick-btn"
                                  disabled={!isSuperAdmin || updatingUserId === user.id}
                                  onClick={() => {
                                    const previousRole = getPreviousRole(user.role)
                                    if (previousRole) void handleRoleChange(user.id, previousRole)
                                  }}
                                >
                                  <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="candidate-card__quick-btn"
                                disabled={!isSuperAdmin || updatingUserId === user.id}
                                onClick={() => openEditAccess(user)}
                              >
                                <span className="material-symbols-rounded" aria-hidden="true">tune</span>
                              </button>
                              <button
                                type="button"
                                className="candidate-card__quick-btn"
                                disabled={!isSuperAdmin || updatingUserId === user.id}
                                onClick={() => void handleToggleActive(user)}
                              >
                                <span className="material-symbols-rounded" aria-hidden="true">{user.isActive ? 'person_off' : 'person_check'}</span>
                              </button>
                              <button
                                type="button"
                                className="candidate-card__quick-btn"
                                disabled={!isSuperAdmin || updatingUserId === user.id}
                                onClick={() => void handleDeleteUser(user)}
                              >
                                <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                              </button>
                              {getNextRole(user.role) && (
                                <button
                                  type="button"
                                  className="candidate-card__quick-btn"
                                  disabled={!isSuperAdmin || updatingUserId === user.id}
                                  onClick={() => {
                                    const nextRole = getNextRole(user.role)
                                    if (nextRole) void handleRoleChange(user.id, nextRole)
                                  }}
                                >
                                  <span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
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
            </section>
          )}
        </>
      )}

      {pageMode === 'create' && (
        <section className="table-panel">
          <article className="editor-card">
            <h3>
              <span className="material-symbols-rounded">person_add</span>
              <span>Add User</span>
            </h3>
            <form className="create-form-grid" onSubmit={(event) => void handleCreateUser(event)}>
              <div className="field">
                <label>First Name</label>
                <input
                  className={formErrors.firstName ? 'input-error' : ''}
                  value={form.firstName}
                  disabled={!isSuperAdmin || creating}
                  onChange={(event) => updateCreateField('firstName', event.target.value)}
                />
                {formErrors.firstName && <small className="field-error">{formErrors.firstName}</small>}
              </div>
              <div className="field">
                <label>Last Name</label>
                <input
                  className={formErrors.lastName ? 'input-error' : ''}
                  value={form.lastName}
                  disabled={!isSuperAdmin || creating}
                  onChange={(event) => updateCreateField('lastName', event.target.value)}
                />
                {formErrors.lastName && <small className="field-error">{formErrors.lastName}</small>}
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  className={formErrors.email ? 'input-error' : ''}
                  value={form.email}
                  disabled={!isSuperAdmin || creating}
                  onChange={(event) => updateCreateField('email', event.target.value)}
                />
                {formErrors.email && <small className="field-error">{formErrors.email}</small>}
              </div>
              <div className="field">
                <label>Password</label>
                <div className="input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={formErrors.password ? 'input-error' : ''}
                    value={form.password}
                    disabled={!isSuperAdmin || creating}
                    onChange={(event) => updateCreateField('password', event.target.value)}
                  />
                  <button type="button" className="user-password-toggle" onClick={() => setShowPassword((prev) => !prev)} disabled={!isSuperAdmin || creating}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {formErrors.password && <small className="field-error">{formErrors.password}</small>}
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  value={form.role}
                  disabled={!isSuperAdmin || creating}
                  onChange={(event) => {
                    const nextRole = event.target.value as AppRole
                    setForm((prev) => ({ ...prev, role: nextRole, permissions: getRoleDefaultPermissions(nextRole) }))
                  }}
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <input value="Active" disabled />
              </div>
              <div className="field field--full">
                <label>Permission Matrix (Individual Override)</label>
                {renderPermissionMatrix(
                  form.permissions,
                  (key, checked) => setForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: checked } })),
                  !isSuperAdmin || creating,
                )}
              </div>
              <div className="editor-actions field--full" style={{ justifyContent: 'flex-start' }}>
                <button type="submit" className="primary-btn" disabled={!isSuperAdmin || creating}>
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </article>
        </section>
      )}

      {pageMode === 'edit' && editForm && (
        <section className="table-panel">
          <article className="editor-card">
            <h3>
              <span className="material-symbols-rounded">tune</span>
              <span>Edit User Access</span>
            </h3>
            <div className="create-form-grid">
              <div className="field">
                <label>Role</label>
                <select
                  value={editForm.role}
                  disabled={!isSuperAdmin || updatingUserId === editForm.userId}
                  onChange={(event) => {
                    const nextRole = event.target.value as AppRole
                    setEditForm((prev) => (prev ? { ...prev, role: nextRole, permissions: getRoleDefaultPermissions(nextRole) } : prev))
                  }}
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={editForm.isActive ? 'Active' : 'Inactive'}
                  disabled={!isSuperAdmin || updatingUserId === editForm.userId}
                  onChange={(event) => setEditForm((prev) => (prev ? { ...prev, isActive: event.target.value === 'Active' } : prev))}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="field field--full">
                <label>Permission Matrix (Individual Override)</label>
                {renderPermissionMatrix(
                  editForm.permissions,
                  (key, checked) => setEditForm((prev) => (prev ? { ...prev, permissions: { ...prev.permissions, [key]: checked } } : prev)),
                  !isSuperAdmin || updatingUserId === editForm.userId,
                )}
              </div>
              <div className="editor-actions field--full" style={{ justifyContent: 'flex-start' }}>
                <button type="button" className="primary-btn" disabled={!isSuperAdmin || updatingUserId === editForm.userId} onClick={() => void saveEditAccess()}>
                  Save User Access
                </button>
              </div>
            </div>
          </article>
        </section>
      )}

      {pageMode === 'role-policy' && rolePolicy && (
        <section className="table-panel">
          <article className="editor-card">
            <h3>
              <span className="material-symbols-rounded">shield_lock</span>
              <span>Overall Role Permission Matrix</span>
            </h3>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    {ROLE_OPTIONS.map((item) => (
                      <th key={item} style={{ textAlign: 'center' }}>
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissionLabels.map((permission) => (
                    <tr key={permission.key}>
                      <td>{permission.label}</td>
                      {ROLE_OPTIONS.map((targetRole) => (
                        <td key={`${permission.key}-${targetRole}`} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={rolePolicy[targetRole][permission.key]}
                            disabled={!isSuperAdmin || savingRolePolicy}
                            onChange={(event) =>
                              setRolePolicy((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      [targetRole]: {
                                        ...prev[targetRole],
                                        [permission.key]: event.target.checked,
                                      },
                                    }
                                  : prev,
                              )
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="editor-actions" style={{ justifyContent: 'flex-start', marginTop: '0.8rem' }}>
              <button type="button" className="primary-btn" disabled={!isSuperAdmin || savingRolePolicy} onClick={() => void saveRolePolicy()}>
                {savingRolePolicy ? 'Saving...' : 'Save Role Permission Matrix'}
              </button>
            </div>
          </article>
        </section>
      )}
    </>
  )
}

export default UserManagementPage
