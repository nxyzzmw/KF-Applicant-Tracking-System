import { useEffect, useState } from 'react'
import './App.css'
import './pages/jobs/JobListPage.css'
import AppRoutes from './routes/AppRoutes'
import './components/common/common.css'
import { ToastProvider } from './components/common/ToastProvider'
import { ConfirmProvider } from './components/common/ConfirmProvider'
import { Loader } from './components/common/Loader'

function App() {
  const [bootMinimumElapsed, setBootMinimumElapsed] = useState(false)
  const [bootDataReady, setBootDataReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setBootMinimumElapsed(true), 700)
    return () => window.clearTimeout(timer)
  }, [])

  const showBootLoader = !bootMinimumElapsed || !bootDataReady

  return (
    <ToastProvider>
      <ConfirmProvider>
        {showBootLoader && (
          <div style={{ padding: '0.75rem 1rem' }}>
            <Loader label="Loading workspace..." />
          </div>
        )}
        <AppRoutes onInitialDataReady={() => setBootDataReady(true)} />
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App
