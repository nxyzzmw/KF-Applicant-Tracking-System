export type SidebarNavItem = {
  id: string
  label: string
  icon: string
  isVisible?: boolean
  onClick?: () => void
}

type SidebarProps = {
  navItems: SidebarNavItem[]
  activeNav: string
  logoSrc?: string
  collapsed: boolean
  onToggleCollapse: () => void
  role?: string
  onLogout?: () => void
}

function Sidebar({
  navItems,
  activeNav,
  logoSrc,
  collapsed,
  onToggleCollapse,
  role,
  onLogout,
}: SidebarProps) {
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
        {navItems
          .filter((item) => item.isVisible !== false)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className={`jm-nav__item ${activeNav === item.id ? 'is-active' : ''}`}
              onClick={item.onClick}
              disabled={!item.onClick}
            >
              <span className="material-symbols-rounded nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
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
