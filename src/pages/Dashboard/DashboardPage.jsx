import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function DashboardPage({ user }) {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    openEvaluations: 0,
    openSalaryReviews: 0,
  })
  const [recentEmployees, setRecentEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)

    const [
      { count: total },
      { count: active },
      { count: evaluations },
      { count: salaryReviews },
      { data: recent },
    ] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('evaluation_cycles').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('salary_review_cycles').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('employees').select('*, departments(name)').order('created_at', { ascending: false }).limit(5),
    ])

    setStats({
      totalEmployees: total || 0,
      activeEmployees: active || 0,
      openEvaluations: evaluations || 0,
      openSalaryReviews: salaryReviews || 0,
    })
    setRecentEmployees(recent || [])
    setLoading(false)
  }

  const statCards = [
    { label: 'Tổng nhân viên', value: stats.totalEmployees, icon: '👥', color: '#1a56db', bg: '#eff6ff' },
    { label: 'Đang làm việc', value: stats.activeEmployees, icon: '✅', color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Kỳ đánh giá mở', value: stats.openEvaluations, icon: '⭐', color: '#d97706', bg: '#fffbeb' },
    { label: 'Đợt tăng lương', value: stats.openSalaryReviews, icon: '💰', color: '#7c3aed', bg: '#f5f3ff' },
  ]

  const STATUS_LABELS = { active: 'Đang làm việc', inactive: 'Đã nghỉ', probation: 'Thử việc' }
  const STATUS_COLORS = { active: '#16a34a', inactive: '#dc2626', probation: '#d97706' }

  return (
    <div>
      {/* Chào mừng */}
      <div style={styles.welcome}>
        <h2 style={styles.welcomeText}>Xin chào, {user?.email} 👋</h2>
        <p style={styles.welcomeSub}>Tổng quan hệ thống TavHRM — cập nhật realtime</p>
      </div>

      {/* Stat cards */}
      <div style={styles.statsGrid}>
        {statCards.map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: s.bg }}>
              <span style={{ fontSize: 26 }}>{s.icon}</span>
            </div>
            <div>
              <p style={{ ...styles.statValue, color: s.color }}>
                {loading ? '...' : s.value}
              </p>
              <p style={styles.statLabel}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Nhân viên mới nhất */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>👥 Nhân viên mới nhất</h3>
        {loading ? (
          <p style={styles.loading}>Đang tải...</p>
        ) : recentEmployees.length === 0 ? (
          <p style={styles.loading}>Chưa có nhân viên nào</p>
        ) : (
          <table style={styles.table}>
            <thead>
<tr style={styles.thead}>
  <th style={styles.th}>Mã NV</th>
  <th style={styles.th}>Họ tên</th>
  <th style={styles.th}>Chi nhánh</th>
  <th style={styles.th}>Phòng ban</th>
  <th style={styles.th}>Chức vụ</th>
  <th style={styles.th}>Trạng thái</th>
</tr>
            </thead>
            <tbody>
              {recentEmployees.map(emp => (
               <tr key={emp.id} style={styles.tr}>
  <td style={styles.td}>
    <span style={styles.code}>{emp.employee_code || '—'}</span>
  </td>
  <td style={styles.td}>
    <div style={styles.nameCell}>
      {emp.avatar_url ? (
        <img src={emp.avatar_url} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={styles.avatar}>{emp.full_name?.[0] || '?'}</div>
      )}
      <span style={styles.name}>{emp.full_name}</span>
    </div>
  </td>
  <td style={styles.td}>{emp.branch || '—'}</td>
  <td style={styles.td}>{emp.departments?.name || '—'}</td>
  <td style={styles.td}>{emp.position || '—'}</td>
  <td style={styles.td}>
    <span style={{
      ...styles.badge,
      background: (STATUS_COLORS[emp.status] || '#6b7280') + '15',
      color: STATUS_COLORS[emp.status] || '#6b7280',
    }}>
      {STATUS_LABELS[emp.status] || '—'}
    </span>
  </td>
</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles = {
  welcome: { marginBottom: 24 },
  welcomeText: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 },
  welcomeSub: { color: '#6b7280', fontSize: 14 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  statCard: { background: '#fff', borderRadius: 10, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  statIcon: { width: 56, height: 56, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { fontSize: 32, fontWeight: 700 },
  statLabel: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  card: { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  cardTitle: { fontSize: 16, fontWeight: 600, color: '#111827', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  loading: { padding: '24px', color: '#6b7280', fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  code: { fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  name: { fontWeight: 600, color: '#111827' },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
}