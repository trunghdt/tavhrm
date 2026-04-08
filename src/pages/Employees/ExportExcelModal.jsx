import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ExportExcelModal({ onClose }) {
  const [departments, setDepartments] = useState([])
  const [selectedDept, setSelectedDept] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('departments').select('*').eq('is_active', true).then(({ data }) => {
      setDepartments(data || [])
    })
  }, [])

  const handleExport = async () => {
    setLoading(true)
    let query = supabase
      .from('employees')
      .select('*, departments(name)')
      .order('employee_code')

    if (selectedDept) {
      query = query.eq('department_id', selectedDept)
    }

    const { data, error } = await query

    if (error || !data) {
      alert('Lỗi khi tải dữ liệu!')
      setLoading(false)
      return
    }

    const XLSX = await import('xlsx')

    const rows = data.map(e => ({
      'Mã nhân viên': e.employee_code || '',
      'Họ tên': e.full_name || '',
      'Phòng ban': e.departments?.name || '',
      'Chức vụ': e.position || '',
      'Số điện thoại': e.phone || '',
      'Email': e.personal_email || '',
      'Giới tính': e.gender === 'female' ? 'Nữ' : e.gender === 'male' ? 'Nam' : '',
      'Loại HĐ': e.employment_type === 'parttime' ? 'Bán thời gian' : e.employment_type === 'probation' ? 'Thử việc' : 'Toàn thời gian',
      'Trạng thái': e.status === 'inactive' ? 'Đã nghỉ' : e.status === 'probation' ? 'Thử việc' : 'Đang làm việc',
      'Ngày vào': e.start_date || '',
      'Ngày nghỉ': e.end_date || '',
      'Địa chỉ': e.address || '',
      'CCCD': e.national_id || '',
      'Mã số thuế': e.tax_code || '',
      'Số TK': e.bank_account || '',
      'Ngân hàng': e.bank_name || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nhân viên')

    const deptName = selectedDept
      ? departments.find(d => d.id === selectedDept)?.name || 'phongban'
      : 'toancongty'

    const date = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')
    XLSX.writeFile(wb, `danhsach_nhanvien_${deptName}_${date}.xlsx`)

    setLoading(false)
    onClose()
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>📤 Export danh sách nhân viên</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <div style={styles.field}>
            <label style={styles.label}>Chọn phòng ban</label>
            <select
              style={styles.select}
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
            >
              <option value="">🏢 Toàn công ty</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.infoBox}>
            <p style={styles.infoText}>
              📋 File Excel sẽ bao gồm các cột: Mã NV, Họ tên, Phòng ban, Chức vụ, SĐT, Email, Giới tính, Loại HĐ, Trạng thái, Ngày vào, Ngày nghỉ, Địa chỉ, CCCD, MST, Số TK, Ngân hàng
            </p>
          </div>

          <div style={styles.actions}>
            <button style={styles.cancelBtn} onClick={onClose}>Hủy</button>
            <button style={styles.exportBtn} onClick={handleExport} disabled={loading}>
              {loading ? 'Đang xuất...' : '📤 Xuất Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  title: { fontSize: 18, fontWeight: 700, color: '#111827' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  body: { padding: 24 },
  field: { marginBottom: 20 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 },
  select: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' },
  infoBox: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px', marginBottom: 24 },
  infoText: { fontSize: 13, color: '#0369a1', lineHeight: 1.6 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  exportBtn: { padding: '10px 24px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}