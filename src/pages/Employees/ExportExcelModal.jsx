import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ALL_FIELDS = [
  { key: 'employee_code', label: 'Mã nhân viên', default: true },
  { key: 'full_name', label: 'Họ tên', default: true },
  { key: 'branch', label: 'Chi nhánh', default: true },
  { key: 'department', label: 'Bộ phận', default: true },
  { key: 'team', label: 'Tổ', default: false },
  { key: 'position', label: 'Chức vụ', default: true },
  { key: 'phone', label: 'Số điện thoại', default: false },
  { key: 'personal_email', label: 'Email', default: false },
  { key: 'gender', label: 'Giới tính', default: false },
  { key: 'date_of_birth', label: 'Ngày sinh', default: false },
  { key: 'national_id', label: 'CCCD', default: false },
  { key: 'tax_code', label: 'Mã số thuế', default: false },
  { key: 'bank_account', label: 'Số tài khoản', default: false },
  { key: 'bank_name', label: 'Ngân hàng', default: false },
  { key: 'employment_type', label: 'Loại hợp đồng', default: true },
  { key: 'status', label: 'Trạng thái', default: true },
  { key: 'start_date', label: 'Ngày vào làm', default: false },
  { key: 'end_date', label: 'Ngày nghỉ việc', default: false },
  { key: 'address', label: 'Địa chỉ', default: false },
  { key: 'base_salary', label: 'Mức lương hiện tại', default: false },
  { key: 'latest_eval_score', label: 'Điểm đánh giá gần nhất', default: false },
  { key: 'latest_eval_ranking', label: 'Xếp loại gần nhất', default: false },
]

const CONTRACT_LABELS = {
  thu_viec: 'Thử việc', thoi_vu: 'Thời vụ',
  co_thoi_han: 'Có thời hạn', vo_thoi_han: 'Vô thời hạn'
}
const STATUS_LABELS = { active: 'Đang làm việc', inactive: 'Đã nghỉ', probation: 'Thử việc' }

export default function ExportExcelModal({ onClose }) {
  const [departments, setDepartments] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedFields, setSelectedFields] = useState(
    ALL_FIELDS.filter(f => f.default).map(f => f.key)
  )
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.from('departments').select('*').eq('is_active', true)
      .then(({ data }) => setDepartments(data || []))
  }, [])

  const branches = departments.filter(d => !d.parent_id)
  const depts = departments.filter(d => d.parent_id === selectedBranchId)
  const teams = departments.filter(d => d.parent_id === selectedDeptId)

  const toggleField = (key) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectAll = () => setSelectedFields(ALL_FIELDS.map(f => f.key))
  const selectNone = () => setSelectedFields(['employee_code', 'full_name'])

  const handleExport = async () => {
    setExporting(true)

    // Xác định dept_id cần filter
    const filterDeptId = selectedTeamId || selectedDeptId || selectedBranchId

    // Lấy tất cả dept con nếu chọn node cha
    const getAllChildIds = (parentId) => {
      const children = departments.filter(d => d.parent_id === parentId)
      return [...children.map(c => c.id), ...children.flatMap(c => getAllChildIds(c.id))]
    }

    // Fetch nhân viên
    let query = supabase
      .from('employees')
      .select('*, departments(name)')
      .eq('status', 'active')
      .order('full_name')

    if (filterDeptId) {
      const allDeptIds = [filterDeptId, ...getAllChildIds(filterDeptId)]
      query = query.in('department_id', allDeptIds)
    }

    const { data: emps } = await query

    // Fetch lương nếu cần
    let salaryMap = {}
    if (selectedFields.includes('base_salary')) {
      const { data: salaries } = await supabase
        .from('salary_records')
        .select('employee_id, base_salary, effective_date')
        .order('effective_date', { ascending: false })
      salaries?.forEach(s => {
        if (!salaryMap[s.employee_id]) salaryMap[s.employee_id] = s.base_salary
      })
    }

    // Fetch đánh giá gần nhất nếu cần
    let evalMap = {}
    if (selectedFields.includes('latest_eval_score') || selectedFields.includes('latest_eval_ranking')) {
      const { data: evals } = await supabase
        .from('evaluations')
        .select('employee_id, total_score, ranking, approved_at')
        .eq('status', 'approved')
        .order('approved_at', { ascending: false })
      evals?.forEach(e => {
        if (!evalMap[e.employee_id]) evalMap[e.employee_id] = e
      })
    }

    // Build rows
    const rows = (emps || []).map(emp => {
      const row = {}
      const fieldDept = departments.find(d => d.id === emp.department_id)
      const fieldBranch = (() => {
        let current = fieldDept
        while (current?.parent_id) current = departments.find(d => d.id === current.parent_id)
        return current
      })()

      ALL_FIELDS.forEach(f => {
        if (!selectedFields.includes(f.key)) return
        switch (f.key) {
          case 'employee_code': row[f.label] = emp.employee_code || ''; break
          case 'full_name': row[f.label] = emp.full_name || ''; break
          case 'branch': row[f.label] = fieldBranch?.name || emp.branch || ''; break
          case 'department': row[f.label] = fieldDept?.name || emp.departments?.name || ''; break
          case 'team': row[f.label] = emp.team || ''; break
          case 'position': row[f.label] = emp.position || 'Nhân viên'; break
          case 'phone': row[f.label] = emp.phone || ''; break
          case 'personal_email': row[f.label] = emp.personal_email || ''; break
          case 'gender': row[f.label] = emp.gender === 'male' ? 'Nam' : emp.gender === 'female' ? 'Nữ' : ''; break
          case 'date_of_birth': row[f.label] = emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString('vi-VN') : ''; break
          case 'national_id': row[f.label] = emp.national_id || ''; break
          case 'tax_code': row[f.label] = emp.tax_code || ''; break
          case 'bank_account': row[f.label] = emp.bank_account || ''; break
          case 'bank_name': row[f.label] = emp.bank_name || ''; break
          case 'employment_type': row[f.label] = CONTRACT_LABELS[emp.employment_type] || emp.employment_type || ''; break
          case 'status': row[f.label] = STATUS_LABELS[emp.status] || emp.status || ''; break
          case 'start_date': row[f.label] = emp.start_date ? new Date(emp.start_date).toLocaleDateString('vi-VN') : ''; break
          case 'end_date': row[f.label] = emp.end_date ? new Date(emp.end_date).toLocaleDateString('vi-VN') : ''; break
          case 'address': row[f.label] = emp.address || ''; break
          case 'base_salary': row[f.label] = salaryMap[emp.id] || ''; break
          case 'latest_eval_score': row[f.label] = evalMap[emp.id]?.total_score || ''; break
          case 'latest_eval_ranking': row[f.label] = evalMap[emp.id]?.ranking || ''; break
        }
      })
      return row
    })

    // Export Excel
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách NV')

    // Tên file
    const deptName = selectedTeamId
      ? departments.find(d => d.id === selectedTeamId)?.name
      : selectedDeptId
        ? departments.find(d => d.id === selectedDeptId)?.name
        : selectedBranchId
          ? departments.find(d => d.id === selectedBranchId)?.name
          : 'ToanCongTy'

    const date = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `DSNV_${deptName}_${date}.xlsx`)
    setExporting(false)
    onClose()
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>📤 Download danh sách nhân viên</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Lọc bộ phận */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>📁 Phạm vi download</p>
            <div style={styles.filterGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Chi nhánh</label>
                <select style={styles.input} value={selectedBranchId}
                  onChange={e => { setSelectedBranchId(e.target.value); setSelectedDeptId(''); setSelectedTeamId('') }}>
                  <option value="">-- Toàn công ty --</option>
                  {branches.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Bộ phận</label>
                <select style={styles.input} value={selectedDeptId}
                  onChange={e => { setSelectedDeptId(e.target.value); setSelectedTeamId('') }}
                  disabled={!selectedBranchId || depts.length === 0}>
                  <option value="">-- Tất cả bộ phận --</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Tổ</label>
                <select style={styles.input} value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  disabled={!selectedDeptId || teams.length === 0}>
                  <option value="">-- Tất cả tổ --</option>
                  {teams.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Chọn trường thông tin */}
          <div style={styles.section}>
            <div style={styles.fieldHeader}>
              <p style={styles.sectionTitle}>📋 Chọn thông tin cần export</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={styles.smallBtn} onClick={selectAll}>Chọn tất cả</button>
                <button style={styles.smallBtn} onClick={selectNone}>Bỏ chọn</button>
              </div>
            </div>
            <div style={styles.fieldGrid}>
              {ALL_FIELDS.map(f => (
                <label key={f.key} style={styles.fieldItem}>
                  <input type="checkbox"
                    checked={selectedFields.includes(f.key)}
                    onChange={() => toggleField(f.key)}
                    disabled={f.key === 'employee_code' || f.key === 'full_name'}
                  />
                  <span style={{ fontSize: 13, color: '#374151', marginLeft: 6 }}>{f.label}</span>
                  {(f.key === 'base_salary' || f.key === 'latest_eval_score' || f.key === 'latest_eval_ranking') && (
                    <span style={styles.specialTag}>★</span>
                  )}
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>★ Dữ liệu được lấy từ module Lương và Đánh giá</p>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Hủy</button>
          <button style={styles.exportBtn} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Đang xuất...' : `📥 Download (${selectedFields.length} cột)`}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, width: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  title: { fontSize: 16, fontWeight: 700, color: '#111827' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' },
  body: { overflowY: 'auto', padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 },
  section: {},
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 12 },
  filterGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 500, color: '#374151' },
  input: { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' },
  fieldHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  fieldItem: { display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: '#f9fafb', cursor: 'pointer' },
  specialTag: { fontSize: 10, color: '#d97706', marginLeft: 4 },
  smallBtn: { padding: '4px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer' },
  footer: { padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 },
  cancelBtn: { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  exportBtn: { padding: '9px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}