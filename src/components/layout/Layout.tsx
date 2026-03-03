import { useState, type ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

type LayoutProps = {
  children: ReactNode
  onShowJobs: () => void
  logoSrc?: string
  role?: string
  onLogout?: () => void
}

function Layout({ children, onShowJobs, logoSrc, role, onLogout }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className={`job-module ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        onJobsClick={onShowJobs}
        logoSrc={logoSrc}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        role={role}
        onLogout={onLogout}
      />
      <div className="job-module__content">
        <Header />
        <main className="job-main">{children}</main>
      </div>
    </div>
  )
}

export default Layout
