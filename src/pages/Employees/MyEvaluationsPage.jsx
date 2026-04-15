import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const RANKING_COLOR = (r) => {
  if (!r) return '#6b7280'
  if (r.includes('Xuất sắc')) return '#d97706'
  if (r.includes('Tốt')) return '#1a56db'
  if (r.includes('Khá')) return '#7c3aed'
  if (r.includes('Đạt')) return '#16a34a'
  return '#dc2626'
}

export default function MyEvaluationsPage() {
  const { profile } = useAuthStore()
  const [evals, setEvals] = useState([])
  const [loading, setLoading] = useState(true)

useEffect(() => {
  if (!profile?.id) return
  const fetchEvals = async () => {
    const { data } = await supabase
      .from('evaluations')
      .select('*, evaluation_cycles(title, period)')
      .eq('employee_id', profile.id)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(3)
    setEvals(data || [])
    setLoading(false)
  }
  fetchEvals()
}, [profile?.id])

  if (loading) return <p style={{ color: '#6b7280' }}>Đang tải...</p>

  return (
    <div>
      <div style={styles.headerCard}>
        <h2 style={styles.title}>⭐ Lịch sử đánh giá năng lực</h2>
        <p style={styles.sub}>3 kỳ đánh giá gần nhất đã được phê duyệt</p>
      </div>

      {evals.length === 0 ? (
        <div style={styles.empty}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>⭐</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Chưa có kết quả đánh giá</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Kết quả sẽ hiển thị sau khi được Ban lãnh đạo phê duyệt</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {evals.map((ev, idx) => {
            const score = ev.total_score || 0
            const rankColor = RANKING_COLOR(ev.ranking)
            return (
              <div key={ev.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <p style={styles.cycleName}>{ev.evaluation_cycles?.title || '—'}</p>
                    <p style={styles.period}>Kỳ: {ev.evaluation_cycles?.period || '—'}</p>
                    <p style={styles.date}>
                      Phê duyệt: {ev.approved_at ? new Date(ev.approved_at).toLocaleDateString('vi-VN') : '—'}
                    </p>
                    {idx === 0 && <span style={styles.latestBadge}>Gần nhất</span>}
                  </div>
                  <div style={styles.scoreBox}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: rankColor }}>{score}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>/100</div>
                    <div style={{ ...styles.rankBadge, background: rankColor + '15', color: rankColor }}>
                      {ev.ranking || '—'}
                    </div>
                  </div>
                </div>

                {ev.scores && Object.keys(ev.scores).length > 0 && (
                  <div style={styles.scoresGrid}>
                    {Object.entries(ev.scores).map(([name, score]) => (
                      <div key={name} style={styles.scoreItem}>
                        <span style={styles.scoreName}>{name}</span>
                        <span style={styles.scoreVal}>{score}</span>
                      </div>
                    ))}
                  </div>
                )}

                {ev.comment && (
                  <div style={styles.commentBox}>
                    <span style={styles.commentLabel}>Nhận xét: </span>
                    <span style={styles.commentText}>{ev.comment}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  headerCard: { background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  title: { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 },
  sub: { fontSize: 13, color: '#6b7280' },
  empty: { background: '#fff', borderRadius: 10, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cycleName: { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 },
  period: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  date: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  latestBadge: { fontSize: 11, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 10, fontWeight: 600 },
  scoreBox: { textAlign: 'right' },
  rankBadge: { fontSize: 12, padding: '3px 10px', borderRadius: 10, fontWeight: 600, marginTop: 4, display: 'inline-block' },
  scoresGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 },
  scoreItem: { display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#f9fafb', borderRadius: 6, fontSize: 12 },
  scoreName: { color: '#374151' },
  scoreVal: { fontWeight: 600, color: '#1a56db' },
  commentBox: { background: '#f8fafc', borderRadius: 6, padding: '8px 12px', fontSize: 13 },
  commentLabel: { fontWeight: 600, color: '#374151' },
  commentText: { color: '#6b7280' },
}