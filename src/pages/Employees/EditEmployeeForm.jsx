import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const EMPLOYMENT_TYPES = [
  { value: 'thu_viec', label: 'Hợp đồng thử việc' },
  { value: 'thoi_vu', label: 'Hợp đồng thời vụ' },
  { value: 'co_thoi_han', label: 'Hợp đồng có thời hạn' },
  { value: 'vo_thoi_han', label: 'Hợp đồng vô thời hạn' },
]

export default function EditEmployeeForm({ employee, onSuccess, onClose, departments = [] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    employee_code: employee.employee_code || '',
    full_name: employee.full_name || '',
    branch: employee.branch || '',
    department_id: employee.department_id || '',
    team: employee.team || '',
    position: employee.position || '',
    phone: employee.phone || '',
    personal_email: employee.personal_email || '',
    gender: employee.gender || 'male',
    national_id: employee.national_id || '',
    tax_code: employee.tax_code || '',
    bank_account: employee.bank_account || '',
    bank_name: employee.bank_name || '',
    employment_type: employee.employment_type || 'co_thoi_han',
    status: employee.status || 'active',
    start_date: employee.start_date || '',
    end_date: employee.end_date || '',
    address: employee.address || '',
  })
// Xác định branch, dept, team từ data nhân viên hiện tại
const currentDept = departments.find(d => d.id === employee.department_id)
const currentParent = currentDept?.parent_id 
  ? departments.find(d => d.id === currentDept.parent_id) 
  : null
const currentGrandParent = currentParent?.parent_id
  ? departments.find(d => d.id === currentParent.parent_id)
  : null

// Nếu có 3 cấp: grandParent=chi nhánh, parent=bộ phận, current=tổ
// Nếu có 2 cấp: parent=chi nhánh, current=bộ phận
// Nếu có 1 cấp: current=chi nhánh
const initBranchId = currentGrandParent?.id || currentParent?.id || ''
const initDeptId = currentGrandParent ? currentParent?.id || '' : currentDept?.parent_id ? currentDept.id : ''
const initTeamId = currentGrandParent ? currentDept?.id || '' : ''

const [selectedBranchId, setSelectedBranchId] = useState(initBranchId)
const [selectedDeptId, setSelectedDeptId] = useState(initDeptId)


  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

const handleSubmit = async e => {
  e.preventDefault()
  setLoading(true)
  setError('')
  const payload = { ...form }
  if (!payload.end_date) delete payload.end_date
  
  // Lưu department_id theo cấp nhỏ nhất đã chọn
  if (selectedDeptId && form.team) {
    payload.department_id = form.team // Có tổ → lưu ID tổ
  } else if (selectedDeptId) {
    payload.department_id = selectedDeptId // Có bộ phận → lưu ID bộ phận
  } else if (selectedBranchId) {
    payload.department_id = selectedBranchId // Chỉ có chi nhánh → lưu ID chi nhánh
  } else {
    payload.department_id = null // Không chọn → null
  }

  const { error } = await supabase
    .from('employees')
    .update(payload)
    .eq('id', employee.id)
  if (error) setError(error.message)
  else onSuccess()
  setLoading(false)
}
const branches = departments.filter(d => !d.parent_id)
const depts = departments.filter(d => d.parent_id === selectedBranchId)
const teams = departments.filter(d => d.parent_id === selectedDeptId)
  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.grid}>

        <Field label="Mã nhân viên *">
          <input style={styles.input} name="employee_code" value={form.employee_code} onChange={handleChange} required />
        </Field>

        <Field label="Họ và tên *">
          <input style={styles.input} name="full_name" value={form.full_name} onChange={handleChange} required />
        </Field>

<Field label="Chi nhánh">
  <select style={styles.input} value={selectedBranchId}
    onChange={e => {
      setSelectedBranchId(e.target.value)
      setSelectedDeptId('')
      setForm({ ...form, department_id: '', team: '' })
    }}>
    <option value="">-- Chọn chi nhánh --</option>
    {branches.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
  </select>
</Field>

<Field label="Bộ phận">
  <select style={styles.input} value={selectedDeptId}
    onChange={e => {
      setSelectedDeptId(e.target.value)
      setForm({ ...form, department_id: e.target.value, team: '' })
    }}
    disabled={!selectedBranchId}>
    <option value="">-- Chọn bộ phận --</option>
    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
  </select>
</Field>

<Field label="Tổ">
  <select style={styles.input} value={initTeamId || ''}
    onChange={e => {
      const teamId = e.target.value
      setForm({ ...form, department_id: teamId || selectedDeptId, team: teamId })
    }}
    disabled={!selectedDeptId || teams.length === 0}>
    <option value="">-- Chọn tổ (nếu có) --</option>
    {teams.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
  </select>
</Field>

        <Field label="Chức vụ">
          <input style={styles.input} name="position" value={form.position} onChange={handleChange} />
        </Field>

        <Field label="Số điện thoại">
          <input style={styles.input} name="phone" value={form.phone} onChange={handleChange} />
        </Field>

        <Field label="Email">
          <input style={styles.input} type="email" name="personal_email" value={form.personal_email} onChange={handleChange} />
        </Field>

        <Field label="Giới tính">
          <select style={styles.input} name="gender" value={form.gender} onChange={handleChange}>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </Field>

        <Field label="CCCD">
          <input style={styles.input} name="national_id" value={form.national_id} onChange={handleChange} />
        </Field>

        <Field label="Mã số thuế">
          <input style={styles.input} name="tax_code" value={form.tax_code} onChange={handleChange} />
        </Field>

        <Field label="Số tài khoản">
          <input style={styles.input} name="bank_account" value={form.bank_account} onChange={handleChange} />
        </Field>

        <Field label="Ngân hàng">
          <input style={styles.input} name="bank_name" value={form.bank_name} onChange={handleChange} />
        </Field>

        <Field label="Loại hợp đồng">
          <select style={styles.input} name="employment_type" value={form.employment_type} onChange={handleChange}>
            {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <Field label="Trạng thái">
          <select style={styles.input} name="status" value={form.status} onChange={handleChange}>
            <option value="active">Đang làm việc</option>
            <option value="probation">Thử việc</option>
            <option value="inactive">Đã nghỉ</option>
          </select>
        </Field>

        <Field label="Ngày vào làm">
          <input style={styles.input} type="date" name="start_date" value={form.start_date} onChange={handleChange} />
        </Field>

        {form.status === 'inactive' && (
          <Field label="Ngày nghỉ việc">
            <input style={styles.input} type="date" name="end_date" value={form.end_date} onChange={handleChange} />
          </Field>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Địa chỉ">
            <input style={styles.input} name="address" value={form.address} onChange={handleChange} />
          </Field>
        </div>

      </div>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <button type="button" style={styles.cancelBtn} onClick={onClose}>Hủy</button>
        <button type="submit" style={styles.submitBtn} disabled={loading}>
          {loading ? 'Đang lưu...' : '💾 Lưu thay đổi'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

const styles = {
  form: { padding: 24 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  input: { padding: '9px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  submitBtn: { padding: '10px 24px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}