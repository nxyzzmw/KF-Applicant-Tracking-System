import { useEffect, useMemo, useState } from 'react'
import appLogo from '../../assets/kf-logo.png'
import './LoadingScreen.css'

const MESSAGES = [
  'Syncing hiring pipeline...',
  'Parsing candidate profiles...',
  'Preparing recruiter dashboard...',
  'Building weekly report insights...',
]

const STEP_MS = 260
const LOADER_DONE_MS = 900

type LoadingScreenProps = {
  onProgressDone?: () => void
}

function LoadingScreen({ onProgressDone }: LoadingScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length)
    }, STEP_MS)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!onProgressDone) return
    const doneTimer = window.setTimeout(() => onProgressDone(), LOADER_DONE_MS)
    return () => window.clearTimeout(doneTimer)
  }, [onProgressDone])

  const loaderBars = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="clickup-loader__bar" style={{ animationDelay: `${i * 120}ms` }} />
      )),
    [],
  )

  return (
    <main className="clickup-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="clickup-loader__orbs" aria-hidden="true" />
      <section className="clickup-loader__card">
        <div className="clickup-loader__logo-wrap">
          <span className="clickup-loader__brand-logo-bg">
            <img src={appLogo} alt="Knackforge ATS logo" className="clickup-loader__brand-logo" />
          </span>
          <div className="clickup-loader__logo" aria-hidden="true">
            {loaderBars}
          </div>
        </div>
        <p className="clickup-loader__message">{MESSAGES[messageIndex]}</p>
      </section>
    </main>
  )
}

export default LoadingScreen
