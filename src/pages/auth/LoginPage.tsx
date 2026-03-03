import { useState } from 'react'
import { getApiErrorMessage, login } from '../../features/auth/authAPI'
import { setTokens } from '../../services/tokenService'

type LoginPageProps = {
  onCreateAccount: () => void
  onForgotPassword: () => void
}

function GoogleIcon() {
  return (
    <svg className="sso-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09a6.65 6.65 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg className="sso-icon sso-icon-ms" viewBox="0 0 16 16" aria-hidden="true" role="img">
      <rect x="0" y="0" width="7" height="7" style={{ fill: '#f25022' }} />
      <rect x="9" y="0" width="7" height="7" style={{ fill: '#7fba00' }} />
      <rect x="0" y="9" width="7" height="7" style={{ fill: '#00a4ef' }} />
      <rect x="9" y="9" width="7" height="7" style={{ fill: '#ffb900' }} />
    </svg>
  )
}

function LoginPage({ onCreateAccount, onForgotPassword }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSignIn(): Promise<void> {
    try {
      setLoading(true)
      setError('')

      const response = await login({
        email: email.trim(),
        password,
      })

      setTokens(response.accessToken, response.refreshToken)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="screen active">
      <div className="form-header">
        <div className="form-eyebrow">Welcome back</div>
        <h2 className="form-title">Sign in to your account</h2>
        <p className="form-desc">Access your hiring pipeline, candidates, and team.</p>
      </div>

      <div className="sso-row">
        <button type="button" className="sso-btn" disabled={loading}>
          <GoogleIcon />
          <span>Google</span>
        </button>
        <button type="button" className="sso-btn" disabled={loading}>
          <MicrosoftIcon />
          <span>Microsoft</span>
        </button>
      </div>

      <div className="divider">
        <div className="divider-line" />
        <span className="divider-text">or continue with email</span>
        <div className="divider-line" />
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="input-group">
        <label htmlFor="login-email">Work email</label>
        <div className="input-wrap">
          <input
            id="login-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="login-pass">Password</label>
        <div className="input-wrap">
          <input
            id="login-pass"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="form-extras">
        <div className="remember-row">
          <input type="checkbox" id="remember" />
          <label htmlFor="remember">Remember me</label>
        </div>
        <button type="button" className="link-btn" onClick={onForgotPassword}>
          Forgot password?
        </button>
      </div>

      <button
        type="button"
        className={`btn-primary ${loading ? 'loading' : ''}`}
        onClick={handleSignIn}
        disabled={loading}
      >
        <span className="btn-text">Sign in</span>
        <span className="btn-spinner">
          <span className="spinner-ring" />
        </span>
      </button>

      <p className="switch-text">
        Don&apos;t have an account?{' '}
        <button type="button" className="link-btn" onClick={onCreateAccount}>
          Create one free
        </button>
      </p>
    </section>
  )
}

export default LoginPage
