import { useEffect, useState } from 'react'
import './App.css'
import LoadingScreen from './pages/loading/LoadingScreen'
import './pages/jobs/JobListPage.css'
import AppRoutes from './routes/AppRoutes'

function App() {
  const [bootMinimumElapsed, setBootMinimumElapsed] = useState(false)
  const [bootDataReady, setBootDataReady] = useState(false)
  const [bootProgressDone, setBootProgressDone] = useState(false)
  const [navigationLoading, setNavigationLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setBootMinimumElapsed(true), 700)
    return () => window.clearTimeout(timer)
  }, [])

  const showBootLoader = !bootMinimumElapsed || !bootDataReady || !bootProgressDone
  const showLoader = showBootLoader || navigationLoading

  return (
    <>
      <AppRoutes
        onInitialDataReady={() => setBootDataReady(true)}
        onNavigationLoadingChange={(loading) => setNavigationLoading(loading)}
      />
      {showLoader && <LoadingScreen onProgressDone={() => setBootProgressDone(true)} />}
    </>
  )
}

export default App
