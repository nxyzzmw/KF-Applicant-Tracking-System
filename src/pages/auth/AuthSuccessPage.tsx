type AuthSuccessPageProps = {
  onBackToSignIn: () => void
}

function AuthSuccessPage({ onBackToSignIn }: AuthSuccessPageProps) {
  return (
    <section className="screen active">
      <div className="success-wrap">
        <div className="success-icon">✓</div>
        <h2 className="form-title success-title">You&apos;re all set!</h2>
        <p className="form-desc success-desc">
          Your request has been completed successfully. You can now continue by signing in.
        </p>
        <button type="button" className="btn-primary" onClick={onBackToSignIn}>
          Back to sign in
        </button>
      </div>
    </section>
  )
}

export default AuthSuccessPage
