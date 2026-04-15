import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const fmt = (val) => val ? new Intl.NumberFormat('vi-VN').format(Number(val)) + ' đ' : '0 đ'

const SALARY_FIELDS = [
  { key: 'base_salary', label: 'Lương cơ bản', icon: '💵' },
  { key: 'hieu_suat', label: 'Hiệu suất', icon: '⭐' },
  { key: 'chuyen_can', label: 'Chuyên cần', icon: '✅' },
  { key: 'doi_song', label: 'Đời sống', icon: '🏠' },
  { key: 'tich_luy', label: 'Tích lũy', icon: '💎' },
]

export default function MySalaryPage() {
  const { profile } = useAuthStore()
  const [salaryHistory, setSalaryHistory] = useState([])
  const [loading, setLoading] = useState(true)

useEffect(() => {
  if (!profile?.id) return
  const fetchSalary = async () => {
    const { data } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(3)
    setSalaryHistory(data || [])
    setLoading(false)
  }
  fetchSalary()
}, [profile?.id])

  if (loading) return <p style={{ color: '#6b7280' }}>Đang tải...</p>

  const current = salaryHistory[0]
  const currentTotal = current
    ? SALARY_FIELDS.reduce((s, f) => s + (Number(current[f.key]) || 0), 0)
    : 0

  return (
    <div>
      <div style={styles.headerCard}>
        <h2 style={styles.title}>💰 Thông tin lương</h2>
        <p style={styles.sub}>Cơ cấu lương hiện tại và lịch sử 3 kỳ gần nhất</p>
      </div>

      {!current ? (
        <div style={styles.empty}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>💰</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Chưa có thông tin lương</p>
        </div>
      ) : (
        <>
          {/* Cơ cấu lương hiện tại */}
          <div style={styles.card}>
            <div style={styles.currentHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Cơ cấu lương hiện tại</h3>
                <p style={styles.effectiveDate}>
                  Hiệu lực từ: {new Date(current.effective_date).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <div style={styles.totalBox}>
                <p style={styles.totalLabel}>Tổng lương</p>
                <p style={styles.totalVal}>{fmt(currentTotal)}</p>
              </div>
            </div>

            <div style={styles.fieldsGrid}>
              {SALARY_FIELDS.map(f => (
                <div key={f.key} style={styles.fieldCard}>
                  <div style={styles.fieldIcon}>{f.icon}</div>
                  <div>
                    <p style={styles.fieldLabel}>{f.label}</p>
                    <p style={styles.fieldVal}>{fmt(current[f.key])}</p>
                  </div>
                  <div style={styles.fieldBar}>
                    <div style={{
                      ...styles.fieldBarFill,
                      width: currentTotal > 0 ? `${(Number(current[f.key]) || 0) / currentTotal * 100}%` : '0%'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

{/* Lịch sử phiếu lương - chờ thiết kế */}
<div style={{ ...styles.card, marginTop: 16 }}>
  <h3 style={styles.sectionTitle}>📋 Lịch sử phiếu lương (3 tháng gần nhất)</h3>
  <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
    <p style={{ fontSize: 24, marginBottom: 8 }}>🧾</p>
    <p style={{ fontSize: 13, fontWeight: 600 }}>Tính năng đang phát triển</p>
    <p style={{ fontSize: 12, marginTop: 4 }}>Lịch sử phiếu lương hàng tháng sẽ hiển thị ở đây</p>
  </div>
</div>
        </>
      )}
    </div>
  )
}

const styles = {
  headerCard: { background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  title: { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 },
  sub: { fontSize: 13, color: '#6b7280' },
  empty: { background: '#fff', borderRadius: 10, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  currentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 },
  effectiveDate: { fontSize: 12, color: '#6b7280' },
  totalBox: { textAlign: 'right', background: '#f0fdf4', borderRadius: 8, padding: '12px 20px', border: '1px solid #86efac' },
  totalLabel: { fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 },
  totalVal: { fontSize: 22, fontWeight: 800, color: '#111827' },
  fieldsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  fieldCard: { background: '#f9fafb', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  fieldIcon: { fontSize: 20, flexShrink: 0 },
  fieldLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  fieldVal: { fontSize: 14, fontWeight: 700, color: '#111827' },
  fieldBar: { height: 4, background: '#e5e7eb', borderRadius: 2, flex: 1, marginLeft: 'auto', marginTop: 4, minWidth: 60 },
  fieldBarFill: { height: '100%', background: '#1a56db', borderRadius: 2, transition: 'width 0.3s' },
  historyItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f9fafb', borderRadius: 8 },
  historyLeft: {},
  historyDate: { fontSize: 13, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 },
  currentTag: { fontSize: 10, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 10, fontWeight: 500 },
  historyReason: { fontSize: 11, color: '#9ca3af' },
  historyRight: { textAlign: 'right' },
  historyTotal: { fontSize: 15, fontWeight: 700, color: '#111827' },
}