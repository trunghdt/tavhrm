import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const MENU_GROUPS = [
  {
    group: 'Thông tin hệ thống',
    roles: ['board_manager', 'hr', 'manager'],
    items: [
      { path: '/', icon: '📊', label: 'Tổng quan', roles: ['board_manager', 'hr', 'manager'] },
      { path: '/employees', icon: '👥', label: 'Danh sách nhân viên', roles: ['board_manager', 'hr', 'manager'] },
      { path: '/evaluations', icon: '⭐', label: 'Đánh giá năng lực', roles: ['board_manager', 'hr', 'manager'] },
      { path: '/salary-review', icon: '💰', label: 'Đánh giá tăng lương', roles: ['board_manager', 'hr', 'manager'] },
      { path: '/permissions', icon: '🔐', label: 'Phân quyền hệ thống', roles: ['board_manager'] },
    ]
  },
  {
    group: 'Hồ sơ nhân viên',
    roles: ['board_manager', 'hr', 'manager', 'employee'],
    items: [
      { path: '/my-profile', icon: '🪪', label: 'Thông tin cá nhân', roles: ['board_manager', 'hr', 'manager', 'employee'] },
      { path: '/my-evaluations', icon: '🏅', label: 'Lịch sử đánh giá', roles: ['board_manager', 'hr', 'manager', 'employee'] },
      { path: '/my-salary', icon: '💵', label: 'Thông tin lương', roles: ['board_manager', 'hr', 'manager', 'employee'] },
    ]
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuthStore()

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={{ color: '#fff', fontWeight: 700 }}>TAV</span>
        <span style={{ color: '#93c5fd', fontWeight: 700 }}>HRM</span>
      </div>

      <nav style={styles.nav}>
        {MENU_GROUPS.map(group => {
          // Lọc items theo role
          const visibleItems = group.items.filter(item => item.roles.includes(role))
          // Ẩn group nếu không có item nào
          if (visibleItems.length === 0) return null

          return (
            <div key={group.group} style={styles.group}>
              <p style={styles.groupLabel}>{group.group}</p>
              {visibleItems.map(item => {
                const active = location.pathname === item.path
                return (
                  <div key={item.path}
                    style={{ ...styles.menuItem, ...(active ? styles.menuItemActive : {}) }}
                    onClick={() => navigate(item.path)}>
                    <span style={styles.icon}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                )
              })}
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
  sidebar: { width: 220, minHeight: '100vh', background: '#1e3a5f', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0 },
  logo: { padding: '24px 20px', fontSize: 22, borderBottom: '1px solid rgba(255,255,255,0.1)' },
  nav: { flex: 1, padding: '8px 0', overflowY: 'auto' },
  group: { marginBottom: 8 },
  groupLabel: { fontSize: 12, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', padding: '12px 20px 6px', letterSpacing: '0.05em' },
  menuItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  menuItemActive: { background: '#1a56db', color: '#fff', borderRadius: '0 8px 8px 0', marginRight: 12 },
  icon: { fontSize: 15 },
  logout: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', color: '#94a3b8', cursor: 'pointer', fontSize: 14, borderTop: '1px solid rgba(255,255,255,0.1)' },
}