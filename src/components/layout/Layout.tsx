import { useState, type ReactNode } from 'react'
import Header from './Header'
import Sidebar, { type SidebarNavItem } from './Sidebar'
import type { HeaderAlertItem, HeaderAlertSummary } from './Header'

type LayoutProps = {
  children: ReactNode
  navItems: SidebarNavItem[]
  activeNav: string
  logoSrc?: string
  role?: string
  onLogout?: () => void
  alerts: HeaderAlertItem[]
  alertsLoading: boolean
  alertsError: string | null
  alertPermission: NotificationPermission | 'unsupported'
  onRequestAlertPermission: () => void
  onMarkAlertRead: (alertId: string) => void
  onMarkAllRead: () => void
  onClearReadAlerts: () => void
  onClearAllAlerts: () => void
  alertSummary?: HeaderAlertSummary | null
  searchValue: string
  onSearchValueChange: (value: string) => void
  onSearchSubmit?: (value: string) => void
  showSearchControls?: boolean
}

function Layout({
  children,
  navItems,
  activeNav,
  logoSrc,
  role,
  onLogout,
  alerts,
  alertsLoading,
  alertsError,
  alertPermission,
  onRequestAlertPermission,
  onMarkAlertRead,
  onMarkAllRead,
  onClearReadAlerts,
  onClearAllAlerts,
  alertSummary,
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  showSearchControls = true,
}: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className={`job-module ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        navItems={navItems}
        activeNav={activeNav}
        logoSrc={logoSrc}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        role={role}
        onLogout={onLogout}
      />
      <div className="job-module__content">
        <Header
          role={role}
          showRoleInHeader={sidebarCollapsed}
          alerts={alerts}
          alertsLoading={alertsLoading}
          alertsError={alertsError}
          alertPermission={alertPermission}
          onRequestAlertPermission={onRequestAlertPermission}
          onMarkAlertRead={onMarkAlertRead}
          onMarkAllRead={onMarkAllRead}
          onClearReadAlerts={onClearReadAlerts}
          onClearAllAlerts={onClearAllAlerts}
          alertSummary={alertSummary}
          searchValue={searchValue}
          onSearchValueChange={onSearchValueChange}
          onSearchSubmit={onSearchSubmit}
          showSearchControls={showSearchControls}
        />
        <main className="job-main">{children}</main>
      </div>
    </div>
  )
}

export default Layout
