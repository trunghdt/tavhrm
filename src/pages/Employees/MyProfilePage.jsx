import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function MyProfilePage() {
  const { profile } = useAuthStore()
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

useEffect(() => {
  if (profile) {
    setEmployee(profile)
    setLoading(false)
  }
}, [profile])

  if (loading) return <p style={{ color: '#6b7280' }}>Đang tải...</p>
  if (!employee) return <p style={{ color: '#6b7280' }}>Không tìm thấy thông tin.</p>

  const fields = [
    ['Mã nhân viên', employee.employee_code],
    ['Họ và tên', employee.full_name],
    ['Bộ phận', employee.departments?.name],
    ['Chức vụ', employee.position || 'Nhân viên'],
    ['Số điện thoại', employee.phone],
    ['Email', employee.personal_email],
    ['Giới tính', employee.gender === 'male' ? 'Nam' : employee.gender === 'female' ? 'Nữ' : '—'],
    ['Ngày sinh', employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString('vi-VN') : '—'],
    ['CCCD', employee.national_id],
    ['Mã số thuế', employee.tax_code],
    ['Số tài khoản', employee.bank_account],
    ['Ngân hàng', employee.bank_name],
    ['Loại hợp đồng',
      employee.employment_type === 'thu_viec' ? 'Hợp đồng thử việc' :
      employee.employment_type === 'thoi_vu' ? 'Hợp đồng thời vụ' :
      employee.employment_type === 'co_thoi_han' ? 'Hợp đồng có thời hạn' :
      employee.employment_type === 'vo_thoi_han' ? 'Hợp đồng vô thời hạn' : '—'
    ],
    ['Trạng thái', employee.status === 'active' ? 'Đang làm việc' : employee.status === 'inactive' ? 'Đã nghỉ' : 'Thử việc'],
    ['Ngày vào làm', employee.start_date ? new Date(employee.start_date).toLocaleDateString('vi-VN') : '—'],
    ['Địa chỉ', employee.address],
  ]

  return (
    <div>
      <div style={styles.headerCard}>
        <div style={styles.avatarBox}>
          {employee.avatar_url
            ? <img src={employee.avatar_url} alt="avatar" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={styles.avatar}>{employee.full_name?.[0]}</div>
          }
        </div>
        <div>
          <h2 style={styles.name}>{employee.full_name}</h2>
          <p style={styles.sub}>{employee.position || 'Nhân viên'} · {employee.departments?.name || '—'}</p>
          <span style={styles.codeBadge}>{employee.employee_code}</span>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>📋 Thông tin cá nhân</h3>
        <div style={styles.grid}>
          {fields.map(([label, value]) => (
            <div key={label} style={styles.field}>
              <span style={styles.label}>{label}</span>
              <span style={styles.value}>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  headerCard: { background: '#fff', borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 20 },
  avatarBox: {},
  avatar: { width: 72, height: 72, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 28 },
  name: { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 },
  sub: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  codeBadge: { fontSize: 12, background: '#f3f4f6', color: '#374151', padding: '3px 10px', borderRadius: 20, fontFamily: 'monospace' },
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' },
  value: { fontSize: 14, color: '#111827', fontWeight: 500 },
}