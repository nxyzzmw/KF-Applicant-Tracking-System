import { useState } from 'react'
import AuthLayout from '../components/auth/AuthLayout'
import AuthSuccessPage from '../pages/auth/AuthSuccessPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import './AppRoutes.css'

type AuthPage = 'login' | 'register' | 'forgot' | 'success'

function AppRoutes() {
  const [page, setPage] = useState<AuthPage>('login')

  return (
    <AuthLayout>
      {page === 'login' && (
        <LoginPage onCreateAccount={() => setPage('register')} onForgotPassword={() => setPage('forgot')} />
      )}
      {page === 'register' && (
        <RegisterPage onSignIn={() => setPage('login')} onSuccess={() => setPage('success')} />
      )}
      {page === 'forgot' && (
        <ForgotPasswordPage onBackToSignIn={() => setPage('login')} onSuccess={() => setPage('success')} />
      )}
      {page === 'success' && <AuthSuccessPage onBackToSignIn={() => setPage('login')} />}
    </AuthLayout>
  )
}

export default AppRoutes
