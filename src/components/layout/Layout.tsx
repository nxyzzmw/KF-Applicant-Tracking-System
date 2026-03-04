import { useState, type ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import type { HeaderAlertItem } from './Header'

type LayoutProps = {
  children: ReactNode
  onShowJobs: () => void
  onShowDashboard: () => void
  activeNav: 'dashboard' | 'jobs'
  logoSrc?: string
  role?: string
  onLogout?: () => void
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

function Layout({
  children,
  onShowJobs,
  onShowDashboard,
  activeNav,
  logoSrc,
  role,
  onLogout,
  alerts,
  alertsLoading,
  alertsError,
  alertPermission,
  onRetryAlerts,
  onRequestAlertPermission,
  onMarkAlertRead,
  onClearReadAlerts,
  onClearAllAlerts,
}: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className={`job-module ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        onJobsClick={onShowJobs}
        onDashboardClick={onShowDashboard}
        activeNav={activeNav}
        logoSrc={logoSrc}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        role={role}
        onLogout={onLogout}
      />
      <div className="job-module__content">
        <Header
          alerts={alerts}
          alertsLoading={alertsLoading}
          alertsError={alertsError}
          alertPermission={alertPermission}
          onRetryAlerts={onRetryAlerts}
          onRequestAlertPermission={onRequestAlertPermission}
          onMarkAlertRead={onMarkAlertRead}
          onClearReadAlerts={onClearReadAlerts}
          onClearAllAlerts={onClearAllAlerts}
        />
        <main className="job-main">{children}</main>
      </div>
    </div>
  )
}

export default Layout
