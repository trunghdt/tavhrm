import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

const handleLogin = async (e) => {
  e.preventDefault()
  setLoading(true)
  setError('')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) setError(error.message)
  setLoading(false)
}

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoText}>Tav</span>
          <span style={styles.logoBlue}>HRM</span>
        </div>
        <p style={styles.subtitle}>Hệ thống quản lý nhân sự</p>

        <form onSubmit={handleLogin}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Mật khẩu</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f5f7fa',
  },
  card: {
    background: '#fff', borderRadius: 10, padding: '40px 36px',
    width: 380, boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
  },
  logo: { textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 6 },
  logoText: { color: '#111' },
  logoBlue: { color: '#1a56db' },
  subtitle: { textAlign: 'center', color: '#6b7280', marginBottom: 28, fontSize: 14 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#374151' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
    outline: 'none',
  },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  button: {
    width: '100%', padding: '11px', background: '#1a56db', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
    cursor: 'pointer', marginTop: 4,
  },
}