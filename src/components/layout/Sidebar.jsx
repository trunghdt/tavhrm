import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuthStore()


const allMenuItems = [
  { path: '/', icon: '📊', label: 'Dashboard', roles: ['board_manager', 'hr', 'manager'] },
  { path: '/employees', icon: '👥', label: 'Nhân viên', roles: ['board_manager', 'hr', 'manager'] },
  { path: '/evaluations', icon: '⭐', label: 'Đánh giá', roles: ['board_manager', 'hr', 'manager'] },
  { path: '/salary-review', icon: '💰', label: 'Tăng lương', roles: ['board_manager', 'hr', 'manager'] },
  { path: '/permissions', icon: '🔐', label: 'Phân quyền', roles: ['board_manager'] },
  // Menu riêng cho nhân viên
  { path: '/my-profile', icon: '👤', label: 'Thông tin cá nhân', roles: ['employee', 'manager'] },
  { path: '/my-evaluations', icon: '⭐', label: 'Lịch sử đánh giá', roles: ['employee', 'manager'] },
  { path: '/my-salary', icon: '💰', label: 'Thông tin lương', roles: ['employee', 'manager'] },
]

  const menuItems = allMenuItems.filter(item => item.roles.includes(role))

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={{ color: '#fff', fontWeight: 700 }}>Tav</span>
        <span style={{ color: '#93c5fd', fontWeight: 700 }}>HRM</span>
      </div>

      <nav style={styles.nav}>
        {menuItems.map(item => {
          const active = location.pathname === item.path
          return (
            <div
              key={item.path}
              style={{ ...styles.menuItem, ...(active ? styles.menuItemActive : {}) }}
              onClick={() => navigate(item.path)}
            >
              <span style={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        })}
      </nav>

      <div style={styles.logout} onClick={() => supabase.auth.signOut()}>
        <span style={styles.icon}>🚪</span>
        <span>Đăng xuất</span>
      </div>
    </div>
  )
}

const styles = {
  sidebar: {
    width: 220, minHeight: '100vh', background: '#1e3a5f',
    display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0,
  },
  logo: {
    padding: '24px 20px', fontSize: 22, borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  nav: { flex: 1, padding: '12px 0' },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px',
    color: '#cbd5e1', cursor: 'pointer', fontSize: 14, fontWeight: 500,
  },
  menuItemActive: {
    background: '#1a56db', color: '#fff', borderRadius: '0 8px 8px 0',
    marginRight: 12,
  },
  icon: { fontSize: 16 },
  logout: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px',
    color: '#94a3b8', cursor: 'pointer', fontSize: 14,
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
}