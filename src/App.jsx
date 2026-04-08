import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import LoginPage from './pages/Auth/LoginPage'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/Dashboard/DashboardPage'
import EmployeesPage from './pages/Employees/EmployeesPage'
import EvaluationsPage from './pages/Evaluations/EvaluationsPage'
import SalaryReviewPage from './pages/SalaryReview/SalaryReviewPage'
import PermissionsPage from './pages/Permissions/PermissionsPage'

function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280' }}>Đang tải...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        <Route element={user ? <AppLayout user={user} /> : <Navigate to="/login" />}>
          <Route path="/" element={<DashboardPage user={user} />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/evaluations" element={<EvaluationsPage />} />
          <Route path="/salary-review" element={<SalaryReviewPage />} />
          <Route path="/permissions" element={<PermissionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App