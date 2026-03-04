import { useMemo, useState } from 'react'
import AuthLayout from '../components/auth/AuthLayout'
import AuthSuccessPage from '../pages/auth/AuthSuccessPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import './AppRoutes.css'

type AuthPage = 'login' | 'forgot' | 'success' | 'dashboard'

function getInitialPage(): AuthPage {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
  return normalizedPath === '/reset-password' ? 'forgot' : 'login'
}

function AppRoutes() {
  const [page, setPage] = useState<AuthPage>(getInitialPage)

  const resetContext = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      token: params.get('token') || '',
      email: params.get('email') || '',
    }
  }, [])

  function goToLogin(): void {
    setPage('login')
    window.history.replaceState({}, '', '/')
  }

  function goToForgotPassword(): void {
    setPage('forgot')
  }

  if (page === 'dashboard') {
    return <DashboardPage />
  }

  return (
    <AuthLayout>
      {page === 'login' && <LoginPage onForgotPassword={goToForgotPassword} onSignInSuccess={() => setPage('dashboard')} />}
      {page === 'forgot' && (
        <ForgotPasswordPage
          onBackToSignIn={goToLogin}
          onSuccess={() => setPage('success')}
          initialEmail={resetContext.email}
          initialToken={resetContext.token}
        />
      )}
      {page === 'success' && <AuthSuccessPage onBackToSignIn={goToLogin} />}
    </AuthLayout>
  )
}

export default AppRoutes
