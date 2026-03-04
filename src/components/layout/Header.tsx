import { useMemo, useState } from 'react'
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
}

type HeaderProps = {
  role?: string
  showRoleInHeader?: boolean
  alerts: HeaderAlertItem[]
  alertsLoading: boolean
  alertsError: string | null
  alertPermission: NotificationPermission | 'unsupported'
  onRetryAlerts: () => void
  onRequestAlertPermission: () => void
  onMarkAlertRead: (alertId: string) => void
  onClearReadAlerts: () => void
  onClearAllAlerts: () => void
}

function Header({
  role,
  showRoleInHeader = false,
  alerts,
  alertsLoading,
  alertsError,
  alertPermission,
  onRetryAlerts,
  onRequestAlertPermission,
  onMarkAlertRead,
  onClearReadAlerts,
  onClearAllAlerts,
}: HeaderProps) {
  const { showToast } = useToast()
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileEdit, setProfileEdit] = useState({ firstName: '', lastName: '', email: '' })
  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts])
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

  return (
    <>
      {!isOnline && <p className="offline-banner">You are offline. Changes may not sync until connection is restored.</p>}
      <header className="job-topbar">
        <div className="topbar-search">
          <span className="material-symbols-rounded">search</span>
          <input type="search" placeholder="Search candidates, jobs..." />
        </div>
        <div className="job-topbar__actions">
        {showRoleInHeader && role && (
          <span className="ghost-btn" style={{ pointerEvents: 'none' }}>
            <span className="material-symbols-rounded">badge</span>
            <span>{role}</span>
          </span>
        )}
        <div className="alerts-menu">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setIsAlertsOpen((prev) => !prev)}
            aria-expanded={isAlertsOpen}
            aria-haspopup="dialog"
          >
            <span className="material-symbols-rounded">notifications</span>
            <span>Alerts</span>
            {unreadCount > 0 && <span className="alerts-count">{unreadCount}</span>}
          </button>
          {isAlertsOpen && (
            <div className="alerts-panel" role="dialog" aria-label="Alerts panel">
              <div className="alerts-panel__head">
                <h4>All Alerts</h4>
                <button type="button" className="ghost-btn" onClick={onRetryAlerts}>
                  Retry
                </button>
              </div>

              <div className="alerts-panel__actions">
                <button type="button" className="ghost-btn" onClick={onRequestAlertPermission}>
                  {alertPermission === 'granted' ? 'Notification Enabled' : 'Enable Notification'}
                </button>
                <button type="button" className="ghost-btn" onClick={onClearReadAlerts}>
                  Clear Read
                </button>
                <button type="button" className="ghost-btn" onClick={onClearAllAlerts}>
                  Clear All
                </button>
              </div>

              {alertsLoading && <p className="alerts-panel__status">Loading alerts...</p>}
              {!alertsLoading && alertsError && (
                <p className="alerts-panel__status alerts-panel__status--error">
                  {alertsError}
                </p>
              )}
              {!alertsLoading && alerts.length === 0 && <p className="alerts-panel__status">No alerts right now.</p>}

              <ul className="alerts-list">
                {alerts.map((alert) => (
                  <li key={alert.id} className={alert.read ? 'is-read' : 'is-unread'}>
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.message}</p>
                      <small>{new Date(alert.createdAt).toLocaleString()}</small>
                    </div>
                    {!alert.read && (
                      <button type="button" className="ghost-btn" onClick={() => onMarkAlertRead(alert.id)}>
                        Mark Read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button type="button" className="ghost-btn">
          <span className="material-symbols-rounded">help</span>
          <span>Help</span>
        </button>
        <div className="alerts-menu">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              const next = !isProfileOpen
              setIsProfileOpen(next)
              if (next) void loadProfile()
            }}
          >
            <span className="material-symbols-rounded">account_circle</span>
            <span>Profile</span>
          </button>
          {isProfileOpen && (
            <div className="alerts-panel" role="dialog" aria-label="Profile panel">
              <div className="alerts-panel__head">
                <h4>Profile</h4>
              </div>
              {profileLoading && <p className="alerts-panel__status">Loading profile...</p>}
              {profileError && <p className="alerts-panel__status alerts-panel__status--error">{profileError}</p>}
              {!profileLoading && (
                <div className="field" style={{ gap: '0.4rem' }}>
                  <label>First Name</label>
                  <input
                    value={profileEdit.firstName}
                    onChange={(event) => setProfileEdit((prev) => ({ ...prev, firstName: event.target.value }))}
                  />
                  <label>Last Name</label>
                  <input
                    value={profileEdit.lastName}
                    onChange={(event) => setProfileEdit((prev) => ({ ...prev, lastName: event.target.value }))}
                  />
                  <label>Email</label>
                  <input
                    type="email"
                    value={profileEdit.email}
                    onChange={(event) => setProfileEdit((prev) => ({ ...prev, email: event.target.value }))}
                  />
                  <label>Role</label>
                  <input value={profile?.role || localProfile?.role || role || 'Role unavailable'} disabled />
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={profileSaving}
                    onClick={async () => {
                      setProfileSaving(true)
                      try {
                        const updated = await updateMyProfile(profileEdit)
                        setProfile(updated)
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
                    }}
                  >
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <span className="profile-badge">MN</span>
        </div>
      </header>
    </>
  )
}

export default Header
