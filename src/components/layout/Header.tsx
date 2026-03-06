import { useEffect, useMemo, useRef, useState } from 'react'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { getMyProfile, updateMyProfile, type UserProfile } from '../../features/users/userAPI'
import { getErrorMessage } from '../../utils/errorUtils'
import { useToast } from '../common/ToastProvider'

export type HeaderAlertItem = {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
  section?: 'important' | 'general'
  severity?: 'high' | 'medium' | 'low'
  isRead?: boolean
  meta?: Record<string, unknown>
  category?: 'important' | 'general'
  label?: string
  timeAgo?: string
}

export type HeaderAlertSummary = {
  importantNewCount: number
  generalNewCount: number
  totalNewCount: number
}

type HeaderProps = {
  role?: string
  showRoleInHeader?: boolean
  alerts: HeaderAlertItem[]
  alertsLoading: boolean
  alertsError: string | null
  alertPermission?: NotificationPermission | 'unsupported'
  onRequestAlertPermission?: () => void
  onMarkAlertRead: (alertId: string) => void
  onMarkAllRead: () => void
  onClearReadAlerts?: () => void
  onClearAllAlerts: () => void
  alertSummary?: HeaderAlertSummary | null
  searchValue: string
  onSearchValueChange: (value: string) => void
  onSearchSubmit?: (value: string) => void
  showSearchControls?: boolean
}

type AlertFilter = 'all' | 'important' | 'general' | 'jobs' | 'candidates' | 'system'

function Header({
  role,
  showRoleInHeader = false,
  alerts,
  alertsLoading,
  alertsError,
  alertPermission: _alertPermission,
  onRequestAlertPermission: _onRequestAlertPermission,
  onMarkAlertRead,
  onMarkAllRead,
  onClearReadAlerts: _onClearReadAlerts,
  onClearAllAlerts,
  alertSummary,
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  showSearchControls = true,
}: HeaderProps) {
  const { showToast } = useToast()
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [isProfileEditing, setIsProfileEditing] = useState(false)
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileEdit, setProfileEdit] = useState({ firstName: '', lastName: '', email: '' })
  const alertsMenuRef = useRef<HTMLDivElement | null>(null)
  const helpMenuRef = useRef<HTMLDivElement | null>(null)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts])
  const totalBadgeCount = alertSummary?.totalNewCount ?? unreadCount
  const localProfile = useMemo(() => {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as { name?: string; fullName?: string; firstName?: string; lastName?: string; email?: string; role?: string }
      return {
        name:
          parsed.fullName ||
          parsed.name ||
          [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') ||
          'User',
        email: parsed.email || 'No email',
        role: parsed.role || role || 'Role unavailable',
      }
    } catch {
      return null
    }
  }, [role])
  const isOnline = useNetworkStatus()

  async function loadProfile() {
    setProfileLoading(true)
    setProfileError(null)
    try {
      const response = await getMyProfile()
      setProfile(response)
      setProfileEdit({
        firstName: response.firstName,
        lastName: response.lastName,
        email: response.email,
      })
      const mergedLocal = {
        ...(localProfile ?? {}),
        firstName: response.firstName,
        lastName: response.lastName,
        name: `${response.firstName} ${response.lastName}`.trim(),
        email: response.email,
        role: response.role || role,
        id: response.id,
        _id: response.id,
      }
      localStorage.setItem('user', JSON.stringify(mergedLocal))
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load profile')
      setProfileError(message)
    } finally {
      setProfileLoading(false)
    }
  }

  function openProfilePanel() {
    setIsProfileOpen(true)
    if (!profile && !profileLoading) {
      void loadProfile()
    }
  }

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (alertsMenuRef.current && !alertsMenuRef.current.contains(target)) {
        setIsAlertsOpen(false)
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(target)) {
        setIsHelpOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileOpen(false)
        setIsProfileEditing(false)
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  function formatRelativeTime(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Now'
    const diffMs = Date.now() - date.getTime()
    const minutes = Math.floor(diffMs / (1000 * 60))
    if (minutes < 1) return 'Now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  const isImportantAlert = (alert: HeaderAlertItem): boolean => {
    if (alert.category) return alert.category === 'important'
    return /closing|expir|urgent|priority|conflict/i.test(`${alert.title} ${alert.message}`)
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const label = alert.label?.trim().toLowerCase()
      if (alertFilter === 'all') return true
      if (alertFilter === 'important') return isImportantAlert(alert)
      if (alertFilter === 'general') return !isImportantAlert(alert)
      return label === alertFilter
    })
  }, [alerts, alertFilter])

  const importantAlerts = useMemo(() => filteredAlerts.filter((alert) => isImportantAlert(alert)), [filteredAlerts])
  const generalAlerts = useMemo(() => filteredAlerts.filter((alert) => !isImportantAlert(alert)), [filteredAlerts])

  function formatAlertMeta(alert: HeaderAlertItem): string {
    const when = alert.timeAgo?.trim() || formatRelativeTime(alert.createdAt)
    const label = alert.label?.trim()
    if (!label) return when
    return `${when} • ${label.toUpperCase()}`
  }

  function resetProfileEditDraft() {
    setProfileEdit({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      email: profile?.email || localProfile?.email || '',
    })
  }

  async function handleSaveProfile() {
    setProfileSaving(true)
    try {
      const updated = await updateMyProfile(profileEdit)
      setProfile(updated)
      setIsProfileEditing(false)
      showToast('Profile updated.', 'success')
      localStorage.setItem(
        'user',
        JSON.stringify({
          firstName: updated.firstName,
          lastName: updated.lastName,
          name: `${updated.firstName} ${updated.lastName}`.trim(),
          email: updated.email,
          role: updated.role,
          id: updated.id,
          _id: updated.id,
        }),
      )
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to update profile')
      setProfileError(message)
      showToast(message, 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <>
      {!isOnline && <p className="offline-banner">You are offline. Changes may not sync until connection is restored.</p>}
      <header className="job-topbar">
        {showSearchControls && (
          <div className="topbar-search">
            <span className="material-symbols-rounded">search</span>
            <input
              type="search"
              placeholder="Power search: modules, jobs, candidates, users..."
              value={searchValue}
              onChange={(event) => onSearchValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onSearchSubmit?.(searchValue)
                }
              }}
            />
            <button type="button" className="ghost-btn topbar-search-go" onClick={() => onSearchSubmit?.(searchValue)}>
              <span className="material-symbols-rounded">north_east</span>
            </button>
          </div>
        )}
        <div className="job-topbar__actions">
        {showRoleInHeader && role && (
          <span className="ghost-btn" style={{ pointerEvents: 'none' }}>
            <span className="material-symbols-rounded">badge</span>
            <span>{role}</span>
          </span>
        )}
        <div className="alerts-menu" ref={alertsMenuRef}>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setIsAlertsOpen((prev) => !prev)
              setIsHelpOpen(false)
              setIsProfileOpen(false)
            }}
            aria-expanded={isAlertsOpen}
            aria-haspopup="dialog"
          >
            <span className="material-symbols-rounded">notifications</span>
            <span>Alerts</span>
            {totalBadgeCount > 0 && <span className="alerts-count">{totalBadgeCount}</span>}
          </button>
          {isAlertsOpen && (
            <div className="alerts-panel alerts-panel--feed" role="dialog" aria-label="Alerts panel">
              <div className="alerts-panel__head">
                <h4>All Alerts</h4>
                <label className="alerts-filter">
                  <span>Filter:</span>
                  <select
                    value={alertFilter}
                    onChange={(event) => setAlertFilter(event.target.value as AlertFilter)}
                    aria-label="Filter alerts"
                  >
                    <option value="all">All</option>
                    <option value="important">Important</option>
                    <option value="general">General</option>
                    <option value="jobs">Jobs</option>
                    <option value="candidates">Candidates</option>
                    <option value="system">System</option>
                  </select>
                </label>
                <button type="button" className="ghost-btn alerts-link-btn" onClick={onMarkAllRead}>
                  <span className="material-symbols-rounded">done_all</span>
                  Mark All Read
                </button>
                <button type="button" className="ghost-btn alerts-link-btn" onClick={onClearAllAlerts}>
                  <span className="material-symbols-rounded">clear_all</span>
                  Clear All
                </button>
              </div>

              {alertsLoading && <p className="alerts-panel__status">Loading alerts...</p>}
              {!alertsLoading && alertsError && (
                <p className="alerts-panel__status alerts-panel__status--error">
                  {alertsError}
                </p>
              )}
              {!alertsLoading && filteredAlerts.length === 0 && (
                <p className="alerts-panel__status">No alerts for this filter.</p>
              )}

              {!alertsLoading && filteredAlerts.length > 0 && (
                <>
                  {importantAlerts.length > 0 && (
                    <>
                      <p className="alerts-section-title alerts-section-title--important">
                        IMPORTANT & PRIORITY
                        {typeof alertSummary?.importantNewCount === 'number' && <span> {alertSummary.importantNewCount} NEW</span>}
                      </p>
                      <ul className="alerts-list">
                        {importantAlerts.map((alert) => (
                          <li
                            key={alert.id}
                            className={`alert-item ${alert.read ? 'is-read' : 'is-unread'} alert-item--important`}
                          >
                            <span className="alert-item__icon" aria-hidden="true">
                              <span className="material-symbols-rounded">warning</span>
                            </span>
                            <div className="alert-item__content">
                              <strong>{alert.title}</strong>
                              <p>{alert.message}</p>
                              <small>{formatAlertMeta(alert)}</small>
                            </div>
                            {!alert.read && (
                              <button
                                type="button"
                                className="ghost-btn icon-only-btn"
                                onClick={() => onMarkAlertRead(alert.id)}
                                title="Mark as read"
                              >
                                <span className="material-symbols-rounded">done</span>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {generalAlerts.length > 0 && (
                    <>
                      <p className="alerts-section-title">
                        GENERAL NOTIFICATIONS
                        {typeof alertSummary?.generalNewCount === 'number' && <span> {alertSummary.generalNewCount} NEW</span>}
                      </p>
                      <ul className="alerts-list">
                        {generalAlerts.map((alert) => (
                          <li
                            key={alert.id}
                            className={`alert-item ${alert.read ? 'is-read' : 'is-unread'}`}
                          >
                            <span className="alert-item__icon" aria-hidden="true">
                              <span className="material-symbols-rounded">notifications</span>
                            </span>
                            <div className="alert-item__content">
                              <strong>{alert.title}</strong>
                              <p>{alert.message}</p>
                              <small>{formatAlertMeta(alert)}</small>
                            </div>
                            {!alert.read && (
                              <button
                                type="button"
                                className="ghost-btn icon-only-btn"
                                onClick={() => onMarkAlertRead(alert.id)}
                                title="Mark as read"
                              >
                                <span className="material-symbols-rounded">done</span>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="alerts-menu" ref={helpMenuRef}>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setIsHelpOpen((prev) => !prev)
              setIsAlertsOpen(false)
              setIsProfileOpen(false)
            }}
          >
            <span className="material-symbols-rounded">help</span>
            <span>Help</span>
          </button>
          {isHelpOpen && (
            <div className="alerts-panel" role="dialog" aria-label="Help panel">
              <div className="alerts-panel__head">
                <h4>Help</h4>
              </div>
              <p className="alerts-panel__status">Use sidebar to switch modules based on your permissions.</p>
              <p className="alerts-panel__status">Use filters and A-Z/Z-A sort in list views to find records quickly.</p>
              <p className="alerts-panel__status">Open Profile to update your name and email.</p>
            </div>
          )}
        </div>
        <div className="alerts-menu" ref={profileMenuRef}>
          <button
            type="button"
            className="ghost-btn icon-only-btn"
            onClick={() => {
              const next = !isProfileOpen
              setIsProfileOpen(next)
              setIsAlertsOpen(false)
              setIsHelpOpen(false)
              if (!next) setIsProfileEditing(false)
              if (next) openProfilePanel()
            }}
            aria-label="Profile"
          >
            <span className="material-symbols-rounded">account_circle</span>
          </button>
          {isProfileOpen && (
            <div className="alerts-panel profile-panel" role="dialog" aria-label="Profile panel">
              <div className="alerts-panel__head profile-panel__head">
                <h4>User Profile</h4>
                {!profileLoading && !isProfileEditing && (
                  <button
                    type="button"
                    className="ghost-btn icon-only-btn"
                    aria-label="Edit profile"
                    title="Edit profile"
                    onClick={() => {
                      resetProfileEditDraft()
                      setIsProfileEditing(true)
                    }}
                  >
                    <span className="material-symbols-rounded">edit</span>
                  </button>
                )}
              </div>
              {profileLoading && <p className="alerts-panel__status">Loading profile...</p>}
              {profileError && <p className="alerts-panel__status alerts-panel__status--error">{profileError}</p>}
              {!profileLoading && (
                <div className="profile-panel__content">
                  <div className="profile-row">
                    <label>First Name</label>
                    {isProfileEditing ? (
                      <input
                        value={profileEdit.firstName}
                        onChange={(event) => setProfileEdit((prev) => ({ ...prev, firstName: event.target.value }))}
                      />
                    ) : (
                      <p>{profile?.firstName || localProfile?.name?.split(' ')[0] || 'N/A'}</p>
                    )}
                  </div>
                  <div className="profile-row">
                    <label>Last Name</label>
                    {isProfileEditing ? (
                      <input
                        value={profileEdit.lastName}
                        onChange={(event) => setProfileEdit((prev) => ({ ...prev, lastName: event.target.value }))}
                      />
                    ) : (
                      <p>{profile?.lastName || localProfile?.name?.split(' ').slice(1).join(' ') || 'N/A'}</p>
                    )}
                  </div>
                  <div className="profile-row">
                    <label>Email</label>
                    {isProfileEditing ? (
                      <input
                        type="email"
                        value={profileEdit.email}
                        onChange={(event) => setProfileEdit((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    ) : (
                      <p>{profile?.email || localProfile?.email || 'N/A'}</p>
                    )}
                  </div>
                  <div className="profile-row">
                    <label>Role</label>
                    <p>{profile?.role || localProfile?.role || role || 'Role unavailable'}</p>
                  </div>
                  {isProfileEditing && (
                    <div className="profile-panel__actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={profileSaving}
                        onClick={() => {
                          resetProfileEditDraft()
                          setIsProfileEditing(false)
                        }}
                      >
                        Cancel
                      </button>
                      <button type="button" className="primary-btn" disabled={profileSaving} onClick={() => void handleSaveProfile()}>
                        {profileSaving ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </header>
    </>
  )
}

export default Header
