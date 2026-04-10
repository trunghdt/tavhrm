import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ChangePasswordPage({ onSuccess, forced = false }) {
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!')
      return
    }
    if (form.newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự!')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password: form.newPassword })
    if (error) setError(error.message)
    else onSuccess()
    setLoading(false)
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.icon}>🔐</div>
          <h2 style={styles.title}>
            {forced ? 'Đổi mật khẩu lần đầu' : 'Đổi mật khẩu'}
          </h2>
          <p style={styles.sub}>
            {forced
              ? 'Bạn đang dùng mật khẩu mặc định. Vui lòng đổi mật khẩu mới trước khi tiếp tục.'
              : 'Nhập mật khẩu mới của bạn.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Mật khẩu mới</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Tối thiểu 6 ký tự"
              value={form.newPassword}
              onChange={e => setForm({ ...form, newPassword: e.target.value })}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Xác nhận mật khẩu</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              required
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: 12, width: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
  },
  header: {
    background: '#1e3a5f', padding: '28px 24px', textAlign: 'center',
  },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 },
  sub: { fontSize: 13, color: '#93c5fd', lineHeight: 1.6 },
  form: { padding: 24 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  btn: {
    width: '100%', padding: '11px', background: '#1a56db', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
    cursor: 'pointer', marginTop: 4,
  },
}