import { useMemo, useState } from 'react'

export type HeaderAlertItem = {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
}

type HeaderProps = {
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
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts])

  return (
    <header className="job-topbar">
      <div className="topbar-search">
        <span className="material-symbols-rounded">search</span>
        <input type="search" placeholder="Search candidates, jobs..." />
      </div>
      <div className="job-topbar__actions">
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
        <span className="profile-badge">MN</span>
      </div>
    </header>
  )
}

export default Header
