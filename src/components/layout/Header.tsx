function Header() {
  return (
    <header className="job-topbar">
      <div className="topbar-search">
        <span className="material-symbols-rounded">search</span>
        <input type="search" placeholder="Search candidates, jobs..." />
      </div>
      <div className="job-topbar__actions">
        <button type="button" className="ghost-btn">
          <span className="material-symbols-rounded">notifications</span>
          <span>Alerts</span>
        </button>
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
