import { useMemo, useState } from 'react'
import { COLORS, getPasswordStrength } from '../../components/auth/authTheme'
import { forgotPassword, getApiErrorMessage, resetPassword } from '../../features/auth/authAPI'

type ForgotPasswordPageProps = {
  onBackToSignIn: () => void
  onSuccess: () => void
  initialEmail?: string
  initialToken?: string
}

type Step = 'email' | 'new-password'

function ForgotPasswordPage({ onBackToSignIn, onSuccess, initialEmail = '', initialToken = '' }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<Step>(initialEmail || initialToken ? 'new-password' : 'email')
  const [loading, setLoading] = useState<'email' | 'new-password' | null>(null)

  const [email, setEmail] = useState(initialEmail)
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [devResetUrl, setDevResetUrl] = useState('')

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const matchHint =
    confirmPassword.length === 0
      ? 'Must match your new password above'
      : confirmPassword === password
        ? 'Passwords match'
        : 'Passwords do not match'

  async function handleSendResetLink(): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Please enter your email address.')
      return
    }

    try {
      setLoading('email')
      setError('')
      setInfo('')

      const response = await forgotPassword({ email: normalizedEmail })
      setInfo(response.message)
      setDevResetUrl(response.resetUrl || '')
      setEmail(normalizedEmail)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(null)
    }
  }

  async function handleResetPassword(): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !token.trim()) {
      setError('Email and reset token are required.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading('new-password')
      setError('')
      setInfo('')

      await resetPassword({
        email: normalizedEmail,
        token: token.trim(),
        newPassword: password,
      })

      window.history.replaceState({}, '', '/')
      onSuccess()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="screen active">
      <button
        type="button"
        className="back-btn"
        onClick={step === 'email' ? onBackToSignIn : () => setStep('email')}
      >
        <span aria-hidden="true">←</span>
        {step === 'email' ? 'Back to sign in' : 'Back'}
      </button>

      <div className="progress-row">
        <div className={`progress-line ${step === 'email' || step === 'new-password' ? 'progress-line-active' : ''}`} />
        <div className={`progress-line ${step === 'new-password' ? 'progress-line-active' : ''}`} />
      </div>

      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert info">{info}</div>}

      {step === 'email' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 1 of 2 - Account recovery</div>
            <h2 className="form-title">Reset your password</h2>
            <p className="form-desc">Enter your work email and we&apos;ll send you a secure reset link.</p>
          </div>

          <div className="input-group">
            <label htmlFor="forgot-email">Work email address</label>
            <div className="input-wrap">
              <input
                id="forgot-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="button"
            className={`btn-primary ${loading === 'email' ? 'loading' : ''}`}
            onClick={handleSendResetLink}
            disabled={loading === 'email'}
          >
            <span className="btn-text">Send reset link</span>
            <span className="btn-spinner">
              <span className="spinner-ring" />
            </span>
          </button>

          <p className="otp-resend-text">
            Already have a reset token?{' '}
            <button type="button" className="link-btn" onClick={() => setStep('new-password')}>
              Reset password now
            </button>
          </p>

          {devResetUrl && (
            <p className="otp-resend-text">
              Dev reset link:{' '}
              <a href={devResetUrl} className="link-btn">
                Open reset URL
              </a>
            </p>
          )}
        </>
      )}

      {step === 'new-password' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 2 of 2 - Set new password</div>
            <h2 className="form-title">Create new password</h2>
            <p className="form-desc">Paste the reset token from email and set your new password.</p>
          </div>

          <div className="input-group">
            <label htmlFor="reset-email">Email</label>
            <div className="input-wrap">
              <input
                id="reset-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="reset-token">Reset token</label>
            <div className="input-wrap">
              <input
                id="reset-token"
                type="text"
                placeholder="Paste reset token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="new-password">New password</label>
            <div className="input-wrap">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="strength-bar">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={`strength-segment ${index < strength.score ? strength.level : ''}`} />
              ))}
            </div>
            <div className="strength-label" style={{ color: strength.color }}>
              {strength.label}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="confirm-new-password">Confirm new password</label>
            <div className="input-wrap">
              <input
                id="confirm-new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="input-hint" style={{ color: matchHint.includes('do not') ? COLORS.error : COLORS.accentBrightBlue }}>
              {matchHint}
            </div>
          </div>

          <button
            type="button"
            className={`btn-primary ${loading === 'new-password' ? 'loading' : ''}`}
            onClick={handleResetPassword}
            disabled={loading === 'new-password'}
          >
            <span className="btn-text">Reset password</span>
            <span className="btn-spinner">
              <span className="spinner-ring" />
            </span>
          </button>
        </>
      )}
    </section>
  )
}

export default ForgotPasswordPage
