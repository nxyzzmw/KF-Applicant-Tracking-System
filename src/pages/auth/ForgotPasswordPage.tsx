import { useMemo, useState } from 'react'
import { COLORS, getPasswordStrength } from '../../components/auth/authTheme'
import { forgotPassword, getApiErrorMessage, resetPassword } from '../../features/auth/authAPI'

type ForgotPasswordPageProps = {
  onBackToSignIn: () => void
  onSuccess: () => void
  initialEmail?: string
  initialToken?: string
}

type Step = 'email' | 'otp' | 'new-password'

function ForgotPasswordPage({ onBackToSignIn, onSuccess, initialEmail = '', initialToken = '' }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<Step>(initialToken ? 'new-password' : initialEmail ? 'otp' : 'email')
  const [loading, setLoading] = useState<'email' | 'otp' | 'new-password' | null>(null)

  const [email, setEmail] = useState(initialEmail)
  const [token, setToken] = useState(initialToken)
  const [otp, setOtp] = useState(initialToken)
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
      setOtp('')
      setToken('')
      setStep('otp')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(null)
    }
  }

  async function handleVerifyOtp(): Promise<void> {
    const normalizedOtp = otp.trim()
    if (normalizedOtp.length < 4) {
      setError('Please enter the OTP sent to your email.')
      return
    }

    try {
      setLoading('otp')
      setError('')
      setInfo('OTP verified. Set your new password.')
      setToken(normalizedOtp)
      setStep('new-password')
    } finally {
      setLoading(null)
    }
  }

  async function handleResetPassword(): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !token.trim()) {
      setError('Email and verified OTP are required.')
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
        onClick={() => {
          if (step === 'email') {
            onBackToSignIn()
            return
          }
          if (step === 'otp') {
            setStep('email')
            return
          }
          setStep('otp')
        }}
      >
        <span aria-hidden="true">←</span>
        {step === 'email' ? 'Back to sign in' : 'Back'}
      </button>

      <div className="progress-row">
        <div className={`progress-line ${step === 'email' || step === 'otp' || step === 'new-password' ? 'progress-line-active' : ''}`} />
        <div className={`progress-line ${step === 'otp' || step === 'new-password' ? 'progress-line-active' : ''}`} />
        <div className={`progress-line ${step === 'new-password' ? 'progress-line-active' : ''}`} />
      </div>

      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert info">{info}</div>}

      {step === 'email' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 1 of 3 - Account recovery</div>
            <h2 className="form-title">Reset your password</h2>
            <p className="form-desc">Enter your work email and we&apos;ll send you an OTP code.</p>
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
            <span className="btn-text">Send OTP</span>
            <span className="btn-spinner">
              <span className="spinner-ring" />
            </span>
          </button>

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

      {step === 'otp' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 2 of 3 - Verify OTP</div>
            <h2 className="form-title">Enter verification code</h2>
            <p className="form-desc">
              Enter the OTP sent to <strong>{email}</strong>.
            </p>
          </div>

          <div className="input-group">
            <label htmlFor="reset-otp">OTP code</label>
            <div className="input-wrap">
              <input
                id="reset-otp"
                type="text"
                className="otp-input"
                placeholder="Enter OTP"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\s+/g, ''))}
                autoComplete="one-time-code"
              />
            </div>
          </div>

          <button
            type="button"
            className={`btn-primary ${loading === 'otp' ? 'loading' : ''}`}
            onClick={handleVerifyOtp}
            disabled={loading === 'otp'}
          >
            <span className="btn-text">Verify OTP</span>
            <span className="btn-spinner">
              <span className="spinner-ring" />
            </span>
          </button>

          <p className="otp-resend-text">
            Didn&apos;t receive code?{' '}
            <button type="button" className="link-btn" onClick={() => void handleSendResetLink()}>
              Resend OTP
            </button>
          </p>
        </>
      )}

      {step === 'new-password' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 3 of 3 - Set new password</div>
            <h2 className="form-title">Create new password</h2>
            <p className="form-desc">Set a new password for your account.</p>
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
