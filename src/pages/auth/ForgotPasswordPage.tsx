import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, formatCountdown, getPasswordStrength } from '../../components/auth/authTheme'

type ForgotPasswordPageProps = {
  onBackToSignIn: () => void
  onSuccess: () => void
}

type Step = 'email' | 'otp' | 'new-password'

const OTP_LENGTH = 6
const OTP_DURATION = 600

function ForgotPasswordPage({ onBackToSignIn, onSuccess }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<Step>('email')
  const [loading, setLoading] = useState<'email' | 'otp' | 'new-password' | null>(null)
  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const [secondsLeft, setSecondsLeft] = useState(OTP_DURATION)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const matchHint =
    confirmPassword.length === 0
      ? 'Must match your new password above'
      : confirmPassword === password
        ? '✓ Passwords match'
        : '✗ Passwords do not match'

  useEffect(() => {
    if (step !== 'otp') return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [step])

  function handleSendCode(): void {
    setLoading('email')
    window.setTimeout(() => {
      setLoading(null)
      setStep('otp')
      setSecondsLeft(OTP_DURATION)
      setOtpValues(Array(OTP_LENGTH).fill(''))
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0)
    }, 1200)
  }

  function handleVerifyOtp(): void {
    setLoading('otp')
    window.setTimeout(() => {
      setLoading(null)
      setStep('new-password')
    }, 1200)
  }

  function handleResetPassword(): void {
    setLoading('new-password')
    window.setTimeout(() => {
      setLoading(null)
      onSuccess()
    }, 1200)
  }

  function handleOtpChange(index: number, rawValue: string): void {
    const value = rawValue.replace(/\D/g, '').slice(-1)
    const next = [...otpValues]
    next[index] = value
    setOtpValues(next)
    if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, key: string): void {
    if (key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleResendCode(): void {
    setOtpValues(Array(OTP_LENGTH).fill(''))
    setSecondsLeft(OTP_DURATION)
    otpRefs.current[0]?.focus()
  }

  return (
    <section className="screen active">
      <button
        type="button"
        className="back-btn"
        onClick={
          step === 'email'
            ? onBackToSignIn
            : () => setStep((current) => (current === 'new-password' ? 'otp' : 'email'))
        }
      >
        <span aria-hidden="true">←</span>
        {step === 'email' ? 'Back to sign in' : 'Back'}
      </button>

      <div className="progress-row">
        <div className={`progress-line ${step === 'email' || step === 'otp' || step === 'new-password' ? 'progress-line-active' : ''}`} />
        <div className={`progress-line ${step === 'otp' || step === 'new-password' ? 'progress-line-active' : ''}`} />
        <div className={`progress-line ${step === 'new-password' ? 'progress-line-active' : ''}`} />
      </div>

      {step === 'email' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 1 of 3 - Account recovery</div>
            <h2 className="form-title">Reset your password</h2>
            <p className="form-desc">Enter your work email and we&apos;ll send a one-time 6-digit code to reset your password.</p>
          </div>

          <div className="alert info">
            <span>ⓘ</span>
            <span>Check your spam folder if you don&apos;t receive the email within 2 minutes.</span>
          </div>

          <div className="input-group">
            <label htmlFor="forgot-email">Work email address</label>
            <div className="input-wrap">
              <input id="forgot-email" type="email" placeholder="you@company.com" />
            </div>
          </div>

          <button type="button" className={`btn-primary ${loading === 'email' ? 'loading' : ''}`} onClick={handleSendCode}>
            <span className="btn-text">Send reset code</span>
            <span className="btn-spinner">
              <span className="spinner-ring" />
            </span>
          </button>
        </>
      )}

      {step === 'otp' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 2 of 3 - Verify identity</div>
            <h2 className="form-title">Enter your code</h2>
            <p className="form-desc">
              We sent a 6-digit code to your email address. It expires in{' '}
              <span className="otp-timer" style={{ color: secondsLeft <= 60 ? COLORS.error : COLORS.accentBrightBlue }}>
                {formatCountdown(secondsLeft)}
              </span>
            </p>
          </div>

          <div className="otp-row">
            {otpValues.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  otpRefs.current[index] = element
                }}
                type="text"
                className="otp-input"
                maxLength={1}
                inputMode="numeric"
                value={digit}
                onChange={(event) => handleOtpChange(index, event.target.value)}
                onKeyDown={(event) => handleOtpKeyDown(index, event.key)}
              />
            ))}
          </div>

          <p className="otp-resend-text">
            Didn&apos;t receive it?{' '}
            <button type="button" className="link-btn" onClick={handleResendCode}>
              Resend code
            </button>
          </p>

          <button type="button" className={`btn-primary ${loading === 'otp' ? 'loading' : ''}`} onClick={handleVerifyOtp}>
            <span className="btn-text">Verify &amp; Continue</span>
            <span className="btn-spinner">
              <span className="spinner-ring" />
            </span>
          </button>
        </>
      )}

      {step === 'new-password' && (
        <>
          <div className="form-header">
            <div className="form-eyebrow">Step 3 of 3 - Set new password</div>
            <h2 className="form-title">Create new password</h2>
            <p className="form-desc">Your new password must be at least 8 characters and different from your previous ones.</p>
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
            <div className="input-hint" style={{ color: matchHint.includes('✗') ? COLORS.error : COLORS.accentBrightBlue }}>
              {matchHint}
            </div>
          </div>

          <button
            type="button"
            className={`btn-primary ${loading === 'new-password' ? 'loading' : ''}`}
            onClick={handleResetPassword}
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
