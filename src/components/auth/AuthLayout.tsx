import type { ReactNode } from 'react'
import { authThemeVars } from './authTheme'
import kfLogo from '../../assets/images/kf-logo.png'

type AuthLayoutProps = {
  children: ReactNode
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="ats-auth" style={authThemeVars}>
      <div className="bg-canvas" aria-hidden="true">
        <div className="bg-orb" />
      </div>

      <div className="app-shell">
        <aside className="left-panel">
          <div className="logo">
            <div className="logo-mark">
              <img src={kfLogo} alt="KF Logo" className="logo-mark-image" />
            </div>
          </div>

          <div className="left-hero">
            <h1 className="left-headline">
              Hire smarter,<br />
              <em>faster,</em>
              <br />
              together.
            </h1>
            <p className="left-sub">
              The modern applicant tracking system that helps teams build exceptional pipelines. From sourcing to
              offer letter.
            </p>

            <div className="stats-row">
              <div className="stat">
                <div className="stat-num">3.2×</div>
                <div className="stat-label">Faster hiring</div>
              </div>
              <div className="stat">
                <div className="stat-num">89%</div>
                <div className="stat-label">Candidate satisfaction</div>
              </div>
              <div className="stat">
                <div className="stat-num">90+</div>
                <div className="stat-label">Teams worldwide</div>
              </div>
            </div>
          </div>

          <div className="left-footer">© 2026 KnackForge. All Rights Reserved</div>
        </aside>

        <main className="right-panel">
          <div className="form-container">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default AuthLayout
