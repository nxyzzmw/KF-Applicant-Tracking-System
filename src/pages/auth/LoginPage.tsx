import { useState } from 'react'
import { getApiErrorMessage, login } from '../../features/auth/authAPI'
import { setTokens } from '../../services/tokenService'

type LoginPageProps = {
  onForgotPassword: () => void
  onSignInSuccess: () => void
}

function LoginPage({ onForgotPassword, onSignInSuccess }: LoginPageProps) {
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
      onSignInSuccess()
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
    </section>
  )
}

export default LoginPage
