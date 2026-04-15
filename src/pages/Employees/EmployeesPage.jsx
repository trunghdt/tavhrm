import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import AddEmployeeForm from './AddEmployeeForm'
import EditEmployeeForm from './EditEmployeeForm'
import AvatarUpload from './AvatarUpload'
import ImportExcelModal from './ImportExcelModal'
import ExportExcelModal from './ExportExcelModal'
import OrgTree from './OrgTree'
import DeptManager from './DeptManager'
import RoleAssignModal from './RoleAssignModal'
import EmployeeRoleModal from './EmployeeRoleModal'

const STATUS_LABELS = { active: 'Đang làm việc', inactive: 'Đã nghỉ', probation: 'Thử việc' }
const STATUS_COLORS = { active: '#16a34a', inactive: '#dc2626', probation: '#d97706' }

export default function EmployeesPage() {
  const { role } = useAuthStore()
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [salaries, setSalaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState({ id: 'root', name: 'TAV Corp' })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editEmployee, setEditEmployee] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showDeptManager, setShowDeptManager] = useState(false)
  const [departmentRoles, setDepartmentRoles] = useState([])
  const [showRoleAssign, setShowRoleAssign] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [empEvals, setEmpEvals] = useState([])
  const [empSalaryHistory, setEmpSalaryHistory] = useState([])

const fetchEmployeeSalary = async (employeeId) => {
  const { data } = await supabase
    .from('salary_records')
    .select('*')
    .eq('employee_id', employeeId)
    .order('effective_date', { ascending: false })
  setEmpSalaryHistory(data || [])
}

  const fetchEmployeeEvals = async (employeeId) => {
   const { data } = await supabase
    .from('evaluations')
    .select('*, evaluation_cycles(title, period)')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
   setEmpEvals(data || [])
  }
  const [assignEmployee, setAssignEmployee] = useState(null)

  useEffect(() => {
    fetchDepartments()
    fetchEmployees()
  }, [])

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setDepartments(data || [])
  }

  const fetchEmployees = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*, departments(name, parent_id)')
      .order('full_name')

    setEmployees(data || [])

    // Fetch lương mới nhất
    const { data: salaryData } = await supabase
      .from('salary_records')
      .select('employee_id, base_salary, effective_date')
      .order('created_at', { ascending: false })

    const salaryMap = {}
    salaryData?.forEach(s => {
      if (!salaryMap[s.employee_id]) salaryMap[s.employee_id] = s.base_salary
    })

    // Fetch department roles
    const { data: rolesData } = await supabase
    .from('department_roles')
    .select('*')
    .eq('is_active', true)
    setDepartmentRoles(rolesData || [])

    setSalaries(salaryMap)
    setLoading(false)
  }

const getFilteredEmployees = () => {
  if (!selectedNode) return []

  let filtered = []

  if (selectedNode.id === 'root') {
    filtered = employees.filter(emp => !emp.department_id)
  } else {
    // NV thuộc đúng node này
    const deptEmployees = employees.filter(emp => emp.department_id === selectedNode.id)

    // Leaders của node này (có thể là NV của node khác)
    const nodeRoles = departmentRoles.filter(r => r.department_id === selectedNode.id)
    const leaderIds = nodeRoles.map(r => r.employee_id)
    const leaders = employees.filter(emp => leaderIds.includes(emp.id) && emp.department_id !== selectedNode.id)

    // Gộp: leaders từ node khác + NV của node này (không trùng)
    const allIds = new Set([...deptEmployees.map(e => e.id)])
    const extraLeaders = leaders.filter(e => !allIds.has(e.id))
    filtered = [...deptEmployees, ...extraLeaders]
  }

  // Filter theo search
  if (search) {
    filtered = filtered.filter(e =>
      e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
      e.position?.toLowerCase().includes(search.toLowerCase())
    )
  }

  // Sắp xếp: Leader → Sub-leader → NV thường
  if (selectedNode.id !== 'root') {
    const nodeRoles = departmentRoles.filter(r => r.department_id === selectedNode.id)
    filtered.sort((a, b) => {
      const aRole = nodeRoles.find(r => r.employee_id === a.id)
      const bRole = nodeRoles.find(r => r.employee_id === b.id)
      const aOrder = aRole?.role_type === 'leader' ? 0 : aRole?.role_type === 'sub_leader' ? 1 : 2
      const bOrder = bRole?.role_type === 'leader' ? 0 : bRole?.role_type === 'sub_leader' ? 1 : 2
      return aOrder - bOrder
    })
  }

  return filtered
}

  const filteredEmployees = getFilteredEmployees()
  const canEdit = role === 'board_manager' || role === 'hr'

  // Breadcrumb path của node được chọn
  const getBreadcrumb = () => {
    if (!selectedNode || selectedNode.id === 'root') return 'TAV Corp'
    const parts = ['TAV Corp']
    const buildPath = (id) => {
      const dept = departments.find(d => d.id === id)
      if (!dept) return
      if (dept.parent_id) buildPath(dept.parent_id)
      parts.push(dept.name)
    }
    buildPath(selectedNode.id)
    return parts.join(' › ')
  }
  // Đếm tổng NV trong node + tất cả node con
const getTotalEmployeeCount = () => {
  if (!selectedNode) return 0

  if (selectedNode.id === 'root') {
    return employees.length
  }

  // Lấy tất cả ID con cháu
  const getAllIds = (id) => {
    const children = departments.filter(d => d.parent_id === id)
    return [id, ...children.flatMap(c => getAllIds(c.id))]
  }

  const allIds = getAllIds(selectedNode.id)
  return employees.filter(emp => emp.department_id && allIds.includes(emp.department_id)).length
}
const handleDelete = async (emp) => {
  if (!confirm(`Xóa nhân viên "${emp.full_name}"?\nThao tác này không thể hoàn tác.`)) return
  await supabase.from('employees').delete().eq('id', emp.id)
  fetchEmployees()
}
  return (
    <div style={styles.container}>
      {/* Left: Cây tổ chức */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>Sơ đồ tổ chức</span>
          {canEdit && (
            <button style={styles.manageDeptBtn} onClick={() => setShowDeptManager(true)}>
              ⚙️
            </button>
          )}
        </div>
        <OrgTree
          departments={departments}
          selectedId={selectedNode?.id}
          onSelect={setSelectedNode}
        />
      </div>

      {/* Right: Danh sách nhân viên */}
      <div style={styles.main}>
        {/* Breadcrumb + Actions */}
        <div style={styles.mainHeader}>
          <div>
            <p style={styles.breadcrumb}>{getBreadcrumb()}</p>
            <p style={styles.empCount}>
  {getTotalEmployeeCount()} nhân viên
  {getTotalEmployeeCount() !== filteredEmployees.length && (
    <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
      ({filteredEmployees.length} trong node này)
    </span>
  )}
</p>
          </div>
          {canEdit && (
            <div style={styles.actions}>
              <input
                style={styles.search}
                placeholder="🔍 Tìm kiếm..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ Thêm</button>
              <button style={styles.importBtn} onClick={() => setShowImport(true)}>📥 Upload</button>
              <button style={styles.exportBtn} onClick={() => setShowExport(true)}>📤 Download</button>
            </div>
          )}

        </div>

        {/* Bảng nhân viên */}
        <div style={styles.tableCard}>
          {loading ? (
            <p style={styles.empty}>Đang tải...</p>
          ) : filteredEmployees.length === 0 ? (
            <p style={styles.empty}>Không có nhân viên nào trong bộ phận này</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Mã NV</th>
                  <th style={styles.th}>Họ tên</th>
                  <th style={styles.th}>Chức danh</th>
                  <th style={styles.th}>Loại HĐ</th>
                  <th style={styles.th}>Trạng thái</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.code}>{emp.employee_code || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.nameCell}>
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt="avatar" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={styles.avatar}>{emp.full_name?.[0] || '?'}</div>
                        )}
                        <div>
                          <div style={styles.name}>{emp.full_name}</div>
                          <div style={styles.email}>{emp.personal_email || '—'}</div>
                        </div>
                      </div>
                    </td>
                   <td style={styles.td}>
  {(() => {
       // Tìm tất cả roles của NV này trong mọi node
    const empRoles = departmentRoles.filter(r => r.employee_id === emp.id)
    
    // Ưu tiên hiện role của node đang xem
    const nodeRole = selectedNode?.id !== 'root' 
      ? empRoles.find(r => r.department_id === selectedNode?.id)
      : empRoles[0] // Ở root thì lấy role đầu tiên nếu có
    if (nodeRole) return (
      <span style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
        background: nodeRole.role_type === 'leader' ? '#eff6ff' : '#fffbeb',
        color: nodeRole.role_type === 'leader' ? '#1a56db' : '#d97706',
      }}>
        {nodeRole.role_type === 'leader' ? '👑' : '⭐'} {nodeRole.title || (nodeRole.role_type === 'leader' ? 'Leader' : 'Sub-leader')}
      </span>
    )
    // Hiện chức vụ nếu không có chức danh
return <span style={{ fontSize: 13, color: '#374151' }}>{emp.position || '—'}</span>
  })()}
</td>
                    <td style={styles.td}>
                      <span style={styles.contractBadge}>
                        {emp.employment_type === 'thu_viec' ? 'Thử việc' :
                          emp.employment_type === 'thoi_vu' ? 'Thời vụ' :
                            emp.employment_type === 'co_thoi_han' ? 'Có thời hạn' :
                              emp.employment_type === 'vo_thoi_han' ? 'Vô thời hạn' : '—'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: (STATUS_COLORS[emp.status] || '#6b7280') + '15',
                        color: STATUS_COLORS[emp.status] || '#6b7280',
                      }}>
                        {STATUS_LABELS[emp.status] || '—'}
                      </span>
                    </td>
                    <td style={styles.td}>
<button style={styles.viewBtn} onClick={() => setSelected(emp)}>Xem</button>
{canEdit && (
  <>
    <button style={{ ...styles.viewBtn, marginLeft: 6, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d' }}
      onClick={() => setEditEmployee(emp)}>Sửa</button>
  </>
)}
{role === 'board_manager' && (
  <>
    <button style={{ ...styles.viewBtn, marginLeft: 6, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
      onClick={() => setAssignEmployee(emp)}>Gán</button>
    <button style={{ ...styles.viewBtn, marginLeft: 6, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
      onClick={() => handleDelete(emp)}>Xóa</button>
  </>
)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Xem chi tiết */}
      {selected && (
  <div style={styles.overlay} onClick={() => { setSelected(null); setActiveTab('info'); setEmpEvals([]) }}>
    <div style={{ ...styles.modal, width: 680 }} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={styles.modalHeader}>
        {selected.avatar_url ? (
          <img src={selected.avatar_url} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={styles.modalAvatar}>{selected.full_name?.[0]}</div>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={styles.modalName}>{selected.full_name}</h2>
          <p style={styles.modalPos}>{selected.position || 'Nhân viên'} — {selected.departments?.name || '—'}</p>
        </div>
        <button style={styles.closeBtn} onClick={() => { setSelected(null); setActiveTab('info'); setEmpEvals([]) }}>✕</button>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
{[
  { key: 'info', label: '👤 Thông tin' },
  ...(role !== 'manager' ? [
    { key: 'evaluations', label: '⭐ Đánh giá' },
    { key: 'salary', label: '💰 Tăng lương' },
  ] : []),
].map(tab => (
          <button key={tab.key}
            style={{
              ...styles.tabBtn,
              borderBottom: activeTab === tab.key ? '2px solid #1a56db' : '2px solid transparent',
              color: activeTab === tab.key ? '#1a56db' : '#6b7280',
              fontWeight: activeTab === tab.key ? 700 : 400,
            }}
onClick={() => {
  setActiveTab(tab.key)
  if (tab.key === 'evaluations') fetchEmployeeEvals(selected.id)
  if (tab.key === 'salary') fetchEmployeeSalary(selected.id)
}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={styles.modalBody}>
        {/* Tab Thông tin */}
        {activeTab === 'info' && (
          <div style={styles.infoGrid}>
            {[
              ['Mã nhân viên', selected.employee_code],
              ['Họ và tên', selected.full_name],
              ['Chi nhánh', selected.branch],
              ['Bộ phận', selected.departments?.name],
              ['Tổ', selected.team],
              ['Chức vụ', selected.position],
              ['Số điện thoại', selected.phone],
              ['Email', selected.personal_email],
              ['Giới tính', selected.gender === 'male' ? 'Nam' : selected.gender === 'female' ? 'Nữ' : '—'],
              ['Ngày sinh', selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('vi-VN') : '—'],
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
              ['Trạng thái', selected.status === 'active' ? 'Đang làm việc' : selected.status === 'inactive' ? 'Đã nghỉ' : 'Thử việc'],
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
        )}

        {/* Tab Đánh giá */}
        {activeTab === 'evaluations' && (
          <div>
            {empEvals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>⭐</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Chưa có kết quả đánh giá nào</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Kết quả sẽ hiển thị sau khi được Ban lãnh đạo phê duyệt</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {empEvals.map(ev => {
                  const score = ev.total_score || 0
                  const rankColor = score >= 90 ? '#d97706' : score >= 80 ? '#1a56db' : score >= 70 ? '#7c3aed' : score >= 65 ? '#16a34a' : '#dc2626'
                  return (
                    <div key={ev.id} style={{ background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid #f3f4f6' }}>
                      {/* Header card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
                            {ev.evaluation_cycles?.title || '—'}
                          </p>
                          <p style={{ fontSize: 12, color: '#6b7280' }}>Kỳ: {ev.evaluation_cycles?.period || '—'}</p>
                          <p style={{ fontSize: 12, color: '#6b7280' }}>
                            Phê duyệt: {ev.approved_at ? new Date(ev.approved_at).toLocaleDateString('vi-VN') : '—'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 32, fontWeight: 800, color: rankColor }}>{score}</span>
                            <span style={{ fontSize: 13, color: '#6b7280' }}>/100</span>
                          </div>
                          <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, fontWeight: 600, background: rankColor + '15', color: rankColor }}>
                            {ev.ranking || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Điểm từng tiêu chí */}
                      {ev.scores && Object.keys(ev.scores).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>Chi tiết điểm</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {Object.entries(ev.scores).map(([name, score]) => (
                              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
                                <span style={{ color: '#374151' }}>{name}</span>
                                <span style={{ fontWeight: 600, color: '#1a56db' }}>{score}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nhận xét */}
                      {ev.comment && (
                        <div style={{ background: '#fff', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Nhận xét: </span>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{ev.comment}</span>
                        </div>
                      )}

                      {/* HR điều chỉnh */}
                      {ev.hr_scores && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                          <p style={{ fontWeight: 600, color: '#d97706', marginBottom: 4 }}>✏️ HR đã điều chỉnh điểm</p>
                          {ev.hr_comment && <p style={{ color: '#92400e' }}>{ev.hr_comment}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

{activeTab === 'salary' && (
  <div>
    {empSalaryHistory.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
        <p style={{ fontSize: 36, marginBottom: 12 }}>💰</p>
        <p style={{ fontSize: 14, fontWeight: 600 }}>Chưa có lịch sử tăng lương</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>Lịch sử sẽ hiển thị sau khi được phê duyệt</p>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {empSalaryHistory.map((record, idx) => {
          const total = (record.base_salary || 0) + (record.hieu_suat || 0) +
            (record.chuyen_can || 0) + (record.doi_song || 0) + (record.tich_luy || 0)
          const prevRecord = empSalaryHistory[idx + 1]
          const prevTotal = prevRecord ? (prevRecord.base_salary || 0) + (prevRecord.hieu_suat || 0) +
            (prevRecord.chuyen_can || 0) + (prevRecord.doi_song || 0) + (prevRecord.tich_luy || 0) : null
          const diff = prevTotal !== null ? total - prevTotal : null
          return (
            <div key={record.id} style={{ background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>
                    Hiệu lực từ: <strong style={{ color: '#111827' }}>
                      {new Date(record.effective_date).toLocaleDateString('vi-VN')}
                    </strong>
                  </p>
                  {record.change_reason && (
                    <p style={{ fontSize: 12, color: '#6b7280' }}>{record.change_reason}</p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
                    {new Intl.NumberFormat('vi-VN').format(total)} đ
                  </div>
                  {diff !== null && diff !== 0 && (
                    <span style={{ fontSize: 12, color: diff > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {diff > 0 ? '▲' : '▼'} {new Intl.NumberFormat('vi-VN').format(Math.abs(diff))} đ
                    </span>
                  )}
                  {idx === 0 && (
                    <span style={{ fontSize: 11, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 10, display: 'block', marginTop: 4 }}>
                      Hiện tại
                    </span>
                  )}
                </div>
              </div>

              {/* Cơ cấu lương */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Lương cơ bản', value: record.base_salary },
                  { label: 'Hiệu suất', value: record.hieu_suat },
                  { label: 'Chuyên cần', value: record.chuyen_can },
                  { label: 'Đời sống', value: record.doi_song },
                  { label: 'Tích lũy', value: record.tich_luy },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>{f.label}</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                      {new Intl.NumberFormat('vi-VN').format(f.value || 0)} đ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
)}
      </div>
    </div>
  </div>
)}

      {/* Modal Sửa */}
      {editEmployee && (
        <div style={styles.overlay} onClick={() => setEditEmployee(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <AvatarUpload employee={editEmployee} onSuccess={(url) => { setEditEmployee({ ...editEmployee, avatar_url: url }); fetchEmployees() }} />
              <h2 style={styles.modalName}>Chỉnh sửa — {editEmployee.full_name}</h2>
              <button style={styles.closeBtn} onClick={() => setEditEmployee(null)}>✕</button>
            </div>
            <EditEmployeeForm
              employee={editEmployee}
              departments={departments}
              onClose={() => setEditEmployee(null)}
              onSuccess={() => { setEditEmployee(null); fetchEmployees() }}
            />
          </div>
        </div>
      )}

      {/* Modal Thêm NV */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalAvatar}>+</div>
              <h2 style={styles.modalName}>Thêm nhân viên mới</h2>
              <button style={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <AddEmployeeForm departments={departments} onSuccess={() => { setShowForm(false); fetchEmployees() }} />
          </div>
        </div>
      )}

      {showImport && <ImportExcelModal onClose={() => setShowImport(false)} onSuccess={fetchEmployees} />}
      {showExport && <ExportExcelModal onClose={() => setShowExport(false)} />}
      {showDeptManager && <DeptManager departments={departments} onRefresh={fetchDepartments} onClose={() => setShowDeptManager(false)} />}
{assignEmployee && (
  <EmployeeRoleModal
    employee={assignEmployee}
    departments={departments}
    onClose={() => setAssignEmployee(null)}
    onRefresh={fetchEmployees}
  />
)}
</div>
  )
}

const styles = {
  container: { display: 'flex', gap: 20, height: 'calc(100vh - 88px)' },
  sidebar: { width: 240, background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowY: 'auto', flexShrink: 0 },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sidebarTitle: { fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase' },
  manageDeptBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280', padding: 4 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' },
  mainHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 },
  breadcrumb: { fontSize: 13, color: '#6b7280' },
  empCount: { fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 },
  actions: { display: 'flex', gap: 8, alignItems: 'center' },
  search: { padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', width: 180 },
  addBtn: { padding: '8px 16px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  importBtn: { padding: '8px 14px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  exportBtn: { padding: '8px 14px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tableCard: { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto', flex: 1 },
  empty: { padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb', position: 'sticky', top: 0 },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '12px 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  code: { fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 7px', borderRadius: 4, fontSize: 11 },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  name: { fontWeight: 600, color: '#111827', fontSize: 13 },
  email: { fontSize: 11, color: '#6b7280' },
  contractBadge: { fontSize: 11, color: '#6b7280' },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  viewBtn: { padding: '5px 12px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 12, width: 640, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid #f3f4f6', position: 'relative' },
  modalAvatar: { width: 48, height: 48, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, flexShrink: 0 },
  modalName: { fontSize: 18, fontWeight: 700, color: '#111827' },
  modalPos: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  closeBtn: { position: 'absolute', right: 20, top: 20, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  modalBody: { padding: 24 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  infoItem: { display: 'flex', flexDirection: 'column', gap: 3 },
  infoLabel: { fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: 500 },
  roleBtn: { padding: '8px 14px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabBar: { display: 'flex', borderBottom: '1px solid #f3f4f6', padding: '0 24px', background: '#fff', flexShrink: 0 },
 tabBtn: { padding: '12px 16px', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' },
}