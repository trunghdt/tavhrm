import { useState } from 'react'
import ChangePasswordPage from '../../pages/Auth/ChangePasswordPage'

export default function Topbar({ title, user }) {
  const [showChange, setShowChange] = useState(false)

  return (
    <>
      <div style={styles.topbar}>
        <h1 style={styles.title}>{title}</h1>
        <div style={styles.userInfo}>
          <button
            style={styles.changePwBtn}
            onClick={() => setShowChange(true)}
            title="Đổi mật khẩu"
          >
            🔑 Đổi mật khẩu
          </button>
          <div style={styles.avatar}>
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <span style={styles.email}>{user?.email}</span>
        </div>
      </div>

      {showChange && (
        <ChangePasswordPage
          forced={false}
          onSuccess={() => {
            setShowChange(false)
            alert('Đổi mật khẩu thành công!')
          }}
        />
      )}
    </>
  )
}

const styles = {
  topbar: {
    height: 60, background: '#fff', borderBottom: '1px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', position: 'fixed', top: 0, left: 220, right: 0, zIndex: 10,
  },
  title: { fontSize: 18, fontWeight: 600, color: '#111827' },
  userInfo: { display: 'flex', alignItems: 'center', gap: 12 },
  changePwBtn: {
    padding: '6px 14px', background: '#f3f4f6', color: '#374151',
    border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13,
    cursor: 'pointer', fontWeight: 500,
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', background: '#1a56db',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 14,
  },
  email: { fontSize: 13, color: '#6b7280' },
}