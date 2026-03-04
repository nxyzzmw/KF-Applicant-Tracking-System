type SidebarProps = {
  onJobsClick?: () => void
  onDashboardClick?: () => void
  activeNav: 'dashboard' | 'jobs'
  logoSrc?: string
  collapsed: boolean
  onToggleCollapse: () => void
  role?: string
  onLogout?: () => void
}

function Sidebar({ onJobsClick, onDashboardClick, activeNav, logoSrc, collapsed, onToggleCollapse, role, onLogout }: SidebarProps) {
  const roleLabel = role?.trim() || 'HR Recruiter'

  return (
    <aside className={`jm-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="jm-brand">
        <span className="jm-brand__logo">{logoSrc ? <img src={logoSrc} alt="ATS Logo" className="jm-brand__logo-img" /> : 'KF'}</span>
        <div className="jm-brand__text">
          <h2>ATS</h2>
          <p>Recruitment Suite</p>
        </div>
        <button type="button" className="jm-collapse-btn" onClick={onToggleCollapse} aria-label="Toggle sidebar">
          <span className="material-symbols-rounded">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
        </button>
      </div>

      <nav className="jm-nav" aria-label="Main">
        <button type="button" className={`jm-nav__item ${activeNav === 'dashboard' ? 'is-active' : ''}`} onClick={onDashboardClick}>
          <span className="material-symbols-rounded nav-icon">dashboard</span>
          <span className="nav-label">Dashboard</span>
        </button>
        <button type="button" className={`jm-nav__item ${activeNav === 'jobs' ? 'is-active' : ''}`} onClick={onJobsClick}>
          <span className="material-symbols-rounded nav-icon">work</span>
          <span className="nav-label">Jobs</span>
        </button>
        <button type="button" className="jm-nav__item">
          <span className="material-symbols-rounded nav-icon">group</span>
          <span className="nav-label">Candidates</span>
        </button>
        <button type="button" className="jm-nav__item">
          <span className="material-symbols-rounded nav-icon">description</span>
          <span className="nav-label">Reports</span>
        </button>
        <button type="button" className="jm-nav__item">
          <span className="material-symbols-rounded nav-icon">schema</span>
          <span className="nav-label">Workflow</span>
        </button>
        <button type="button" className="jm-nav__item">
          <span className="material-symbols-rounded nav-icon">settings</span>
          <span className="nav-label">Settings</span>
        </button>
      </nav>

      <div className="jm-sidebar__footer">
        <small>Role: {roleLabel}</small>
        <button type="button" className="jm-logout-btn" onClick={onLogout} title="Logout" aria-label="Logout">
          <span className="material-symbols-rounded">logout</span>
          <span className="nav-label">Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
