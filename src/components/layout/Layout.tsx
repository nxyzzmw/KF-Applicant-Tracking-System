import { useState, type ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import type { HeaderAlertItem } from './Header'

type LayoutProps = {
  children: ReactNode
  onShowJobs: () => void
  onShowDashboard: () => void
  onShowCandidates: () => void
  onShowInterviews?: () => void
  onShowUsers?: () => void
  onShowReports?: () => void
  activeNav: 'dashboard' | 'jobs' | 'candidates' | 'interviews' | 'users' | 'reports'
  logoSrc?: string
  role?: string
  canViewDashboard?: boolean
  canViewJobs?: boolean
  canViewCandidates?: boolean
  canViewInterviews?: boolean
  canManageUsers?: boolean
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
  onShowCandidates,
  onShowInterviews,
  onShowUsers,
  onShowReports,
  activeNav,
  logoSrc,
  role,
  canViewDashboard,
  canViewJobs,
  canViewCandidates,
  canViewInterviews,
  canManageUsers,
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
        onCandidatesClick={onShowCandidates}
        onInterviewsClick={onShowInterviews}
        onUsersClick={onShowUsers}
        onReportsClick={onShowReports}
        activeNav={activeNav}
        logoSrc={logoSrc}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        role={role}
        canViewDashboard={canViewDashboard}
        canViewJobs={canViewJobs}
        canViewCandidates={canViewCandidates}
        canViewInterviews={canViewInterviews}
        canManageUsers={canManageUsers}
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
