import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_LABELS = { draft: 'Nháp', open: 'Đang mở', submitted: 'Chờ duyệt', approved: 'Đã duyệt', closed: 'Đã đóng' }
const STATUS_COLORS = { draft: '#6b7280', open: '#16a34a', submitted: '#d97706', approved: '#1a56db', closed: '#6b7280' }

export default function SalaryReviewPage() {
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCycles()
  }, [])

  const fetchCycles = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('salary_review_cycles')
      .select('*')
      .order('created_at', { ascending: false })
    setCycles(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div style={styles.header}>
        <button style={styles.addBtn}>+ Mở đợt tăng lương</button>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Đang tải...</p>
      ) : cycles.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyIcon}>💰</p>
          <p style={styles.emptyText}>Chưa có đợt tăng lương nào</p>
          <p style={styles.emptySub}>HR mở đợt tăng lương để bắt đầu quy trình</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {cycles.map(cycle => (
            <div key={cycle.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>{cycle.title}</h3>
                <span style={{
                  ...styles.badge,
                  background: (STATUS_COLORS[cycle.status] || '#6b7280') + '15',
                  color: STATUS_COLORS[cycle.status] || '#6b7280',
                }}>
                  {STATUS_LABELS[cycle.status] || cycle.status}
                </span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Deadline</span>
                  <span style={styles.infoValue}>
                    {cycle.deadline ? new Date(cycle.deadline).toLocaleDateString('vi-VN') : '—'}
                  </span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Hiệu lực từ</span>
                  <span style={styles.infoValue}>
                    {cycle.effective_date ? new Date(cycle.effective_date).toLocaleDateString('vi-VN') : '—'}
                  </span>
                </div>
              </div>
              <div style={styles.cardFooter}>
                <button style={styles.viewBtn}>Xem chi tiết →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  header: { display: 'flex', justifyContent: 'flex-end', marginBottom: 20 },
  addBtn: {
    padding: '10px 20px', background: '#1a56db', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  empty: {
    background: '#fff', borderRadius: 10, padding: '60px 24px',
    textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6b7280' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#111827' },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  infoRow: { display: 'flex', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValue: { fontSize: 13, fontWeight: 500, color: '#111827' },
  cardFooter: { borderTop: '1px solid #f3f4f6', paddingTop: 12 },
  viewBtn: { background: 'none', border: 'none', color: '#1a56db', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 },
}