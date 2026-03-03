import { useMemo, useState } from 'react'
import { COLORS, getPasswordStrength } from '../../components/auth/authTheme'
import { getApiErrorMessage, register } from '../../features/auth/authAPI'

type RegisterPageProps = {
  onSignIn: () => void
  onSuccess: () => void
}

function RegisterPage({ onSignIn, onSuccess }: RegisterPageProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const matchHint =
    confirmPassword.length === 0
      ? ''
      : password === confirmPassword
        ? '✓ Passwords match'
        : '✗ Passwords do not match'

  async function handleRegister(): Promise<void> {
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      setError('')

      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      })

      onSuccess()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="screen active">
      <div className="form-header">
        <div className="form-eyebrow">Get started free</div>
        <h2 className="form-title">Create your account</h2>
        <p className="form-desc">Join thousands of teams hiring smarter with TalentFlow.</p>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="input-row">
        <div className="input-group">
          <label htmlFor="first-name">First name</label>
          <div className="input-wrap">
            <input
              id="first-name"
              type="text"
              placeholder="Jane"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
            />
          </div>
        </div>
        <div className="input-group">
          <label htmlFor="last-name">Last name</label>
          <div className="input-wrap">
            <input
              id="last-name"
              type="text"
              placeholder="Smith"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="register-email">Work email</label>
        <div className="input-wrap">
          <input
            id="register-email"
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="register-password">Password</label>
        <div className="input-wrap">
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a strong password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="strength-bar">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`strength-segment ${index < strength.score ? strength.level : ''}`}
            />
          ))}
        </div>
        <div className="strength-label" style={{ color: strength.color }}>
          {strength.label}
        </div>
      </div>

      <div className="input-group">
        <label htmlFor="register-confirm-password">Confirm password</label>
        <div className="input-wrap">
          <input
            id="register-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
          >
            {showConfirmPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <div
          className="input-hint"
          style={{ color: matchHint.includes('✗') ? COLORS.error : COLORS.accentBrightBlue }}
        >
          {matchHint}
        </div>
      </div>

      <button
        type="button"
        className={`btn-primary ${loading ? 'loading' : ''}`}
        onClick={handleRegister}
        disabled={loading}
      >
        <span className="btn-text">Create account</span>
        <span className="btn-spinner">
          <span className="spinner-ring" />
        </span>
      </button>

      <p className="switch-text">
        Already have an account?{' '}
        <button type="button" className="link-btn" onClick={onSignIn}>
          Sign in
        </button>
      </p>
    </section>
  )
}

export default RegisterPage
