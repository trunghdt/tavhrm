import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AddEmployeeForm from './AddEmployeeForm'
import ImportExcelModal from './ImportExcelModal'
import EditEmployeeForm from './EditEmployeeForm'
import ExportExcelModal from './ExportExcelModal'
import AvatarUpload from './AvatarUpload'


const STATUS_LABELS = { active: 'Đang làm việc', inactive: 'Đã nghỉ', probation: 'Thử việc' }
const STATUS_COLORS = { active: '#16a34a', inactive: '#dc2626', probation: '#d97706' }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .order('full_name')
    setEmployees(data || [])
    setLoading(false)
  }

  const filtered = employees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
    e.position?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <input
          style={styles.search}
          placeholder="🔍 Tìm theo tên, mã NV, chức vụ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ Thêm nhân viên</button>
        <button style={styles.importBtn} onClick={() => setShowImport(true)}>📥 Upload DSNV </button>
        <button style={styles.exportBtn} onClick={() => setShowExport(true)}>📤 Download DSNV </button>
      </div>

      {/* Table */}
      <div style={styles.card}>
        {loading ? (
          <p style={{ padding: 24, color: '#6b7280' }}>Đang tải...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 24, color: '#6b7280' }}>Chưa có nhân viên nào.</p>
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
  <th style={styles.th}></th>
</tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
<tr key={emp.id} style={styles.tr}>
  <td style={styles.td}>
    <span style={styles.code}>{emp.employee_code || '—'}</span>
  </td>
  <td style={styles.td}>
    <div style={styles.nameCell}>
      {emp.avatar_url ? (
        <img src={emp.avatar_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={styles.avatar}>{emp.full_name?.[0] || '?'}</div>
      )}
      <div>
        <div style={styles.name}>{emp.full_name}</div>
        <div style={styles.email}>{emp.personal_email || '—'}</div>
      </div>
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
      {STATUS_LABELS[emp.status] || emp.status || '—'}
    </span>
  </td>
  <td style={styles.td}>
    <button style={styles.viewBtn} onClick={() => setSelected(emp)}>Xem</button>
    <button style={{ ...styles.viewBtn, marginLeft: 8, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d' }} onClick={() => setEditEmployee(emp)}>Sửa</button>
  </td>
</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={styles.overlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              {selected.avatar_url ? (
  <img src={selected.avatar_url} alt="avatar" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
) : (
  <div style={styles.modalAvatar}>{selected.full_name?.[0]}</div>
)}
              <div>
                <h2 style={styles.modalName}>{selected.full_name}</h2>
                <p style={styles.modalPos}>{selected.position} — {selected.departments?.name}</p>
              </div>
              <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.infoGrid}>
                {[
                 ['Mã nhân viên', selected.employee_code],
                 ['Họ và tên', selected.full_name],
                 ['Chi nhánh', selected.branch],
                 ['Phòng ban', selected.departments?.name],
                 ['Tổ', selected.team],
                 ['Chức vụ', selected.position],
                 ['Số điện thoại', selected.phone],
                 ['Email', selected.personal_email],
                 ['Giới tính', selected.gender === 'male' ? 'Nam' : selected.gender === 'female' ? 'Nữ' : '—'],
                 ['CCCD', selected.national_id],
                 ['Mã số thuế', selected.tax_code],
                 ['Số tài khoản', selected.bank_account],
                 ['Ngân hàng', selected.bank_name],
                 ['Loại hợp đồng', 
                   selected.employment_type === 'thu_viec' ? 'Hợp đồng thử việc' :
                   selected.employment_type === 'thoi_vu' ? 'Hợp đồng thời vụ' :
                   selected.employment_type === 'co_thoi_han' ? 'Hợp đồng có thời hạn' :
                   selected.employment_type === 'vo_thoi_han' ? 'Hợp đồng vô thời hạn' : '—'
                  ],
                 ['Trạng thái', selected.status === 'active' ? 'Đang làm việc' : selected.status === 'probation' ? 'Thử việc' : 'Đã nghỉ'],
                 ['Ngày vào làm', selected.start_date ? new Date(selected.start_date).toLocaleDateString('vi-VN') : '—'],
                 ['Ngày nghỉ việc', selected.end_date ? new Date(selected.end_date).toLocaleDateString('vi-VN') : '—'],
                 ['Địa chỉ', selected.address],
               ].map(([label, value]) => (
                <div key={label} style={styles.infoItem}>
                <span style={styles.infoLabel}>{label}</span>
               <span style={styles.infoValue}>{value || '—'}</span>
               </div>
              ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {showForm && (
      <div style={styles.overlay} onClick={() => setShowForm(false)}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}>
        <h2 style={styles.modalName}>Thêm nhân viên mới</h2>
        <button style={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
      </div>
      <AddEmployeeForm onSuccess={() => { setShowForm(false); fetchEmployees() }} />
     </div>
     </div>
     )}
      {showImport && (
      <ImportExcelModal
      onClose={() => setShowImport(false)}
      onSuccess={fetchEmployees}
      />
     )}
  {editEmployee && (
  <div style={styles.overlay} onClick={() => setEditEmployee(null)}>
    <div style={styles.modal} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}>
        <AvatarUpload
  employee={editEmployee}
  onSuccess={(url) => {
    setEditEmployee({ ...editEmployee, avatar_url: url })
    fetchEmployees()
  }}
/>
        <h2 style={styles.modalName}>Chỉnh sửa — {editEmployee.full_name}</h2>
        <button style={styles.closeBtn} onClick={() => setEditEmployee(null)}>✕</button>
      </div>
      <EditEmployeeForm
        employee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onSuccess={() => { setEditEmployee(null); fetchEmployees() }}
      />
    </div>
  </div>
    )}
    {showExport && (
  <ExportExcelModal
    onClose={() => setShowExport(false)}
  />
)}
</div>
  )
}

const styles = {
  header: { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' },
  search: {
    flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 14, outline: 'none',
  },
  addBtn: {
    padding: '10px 20px', background: '#1a56db', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  importBtn: { 
    padding: '10px 20px', background: '#f0fdf4', color: '#16a34a', 
    border: '1px solid #86efac', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' 
  },
  card: { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  code: { fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%', background: '#1a56db',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 14, flexShrink: 0,
  },
  name: { fontWeight: 600, color: '#111827' },
  email: { fontSize: 12, color: '#6b7280' },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  viewBtn: {
    padding: '6px 14px', background: '#eff6ff', color: '#1a56db',
    border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: 600, maxHeight: '80vh',
    overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '24px 24px 20px',
    borderBottom: '1px solid #f3f4f6', position: 'relative',
  },
  modalAvatar: {
    width: 56, height: 56, borderRadius: '50%', background: '#1a56db',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 22, flexShrink: 0,
  },
  modalName: { fontSize: 20, fontWeight: 700, color: '#111827' },
  modalPos: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  closeBtn: {
    position: 'absolute', right: 20, top: 20, background: 'none',
    border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280',
  },
  modalBody: { padding: 24 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  infoItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  infoLabel: { fontSize: 12, color: '#6b7280', fontWeight: 500 },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: 500 },
  exportBtn: { padding: '10px 20px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}