import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const EMPLOYMENT_TYPES = [
  { value: 'thu_viec', label: 'Hợp đồng thử việc' },
  { value: 'thoi_vu', label: 'Hợp đồng thời vụ' },
  { value: 'co_thoi_han', label: 'Hợp đồng có thời hạn' },
  { value: 'vo_thoi_han', label: 'Hợp đồng vô thời hạn' },
]

export default function AddEmployeeForm({ onSuccess, departments = [] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    employee_code: '', full_name: '', branch: '', department_id: '',
    team: '', position: '', phone: '', personal_email: '',
    gender: 'male', national_id: '', tax_code: '', bank_account: '',
    bank_name: '', employment_type: 'co_thoi_han', status: 'active',
    start_date: '', end_date: '', address: '',
  })
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [currentSalary, setCurrentSalary] = useState('')

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

const handleSubmit = async e => {
  e.preventDefault()
  setLoading(true)
  setError('')

  const payload = { ...form }
  if (!payload.end_date) delete payload.end_date
// Lưu department_id theo cấp nhỏ nhất đã chọn
if (selectedDeptId && form.team) {
  payload.department_id = form.team
} else if (selectedDeptId) {
  payload.department_id = selectedDeptId
} else if (selectedBranchId) {
  payload.department_id = selectedBranchId
} else {
  payload.department_id = null
}

  // Thêm nhân viên vào database
  const { data: newEmployee, error } = await supabase
    .from('employees')
    .insert([payload])
    .select()
    .single()

  if (error) {
    setError(error.message)
    setLoading(false)
    return
  }
    // Lưu mức lương hiện tại
  if (currentSalary && Number(currentSalary) > 0) {
    await supabase.from('salary_records').insert([{
      employee_id: newEmployee.id,
      base_salary: Number(currentSalary),
      salary_type: 'time_based',
      effective_date: newEmployee.start_date || new Date().toISOString().split('T')[0],
      change_reason: 'Lương khởi điểm',
    }])
  }

  // Tự động tạo tài khoản
  try {
    await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${form.employee_code.toLowerCase()}@tavhrm.internal`,
        password: 'tav@12345',
        role: 'employee',
        employeeId: newEmployee.id,
      }),
    })
  } catch (err) {
    console.log('Tạo tài khoản lỗi:', err)
  }

  onSuccess()
  setLoading(false)
}
// Chi nhánh = dept không có parent
const branches = departments.filter(d => !d.parent_id)

// Bộ phận = dept có parent là chi nhánh được chọn
const depts = departments.filter(d => d.parent_id === selectedBranchId)

// Tổ = dept có parent là bộ phận được chọn
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
  <select style={styles.input} name="department_id" value={selectedDeptId}
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
  <select style={styles.input} value={form.team}
    onChange={e => setForm({ ...form, team: e.target.value, department_id: e.target.value || selectedDeptId })}
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
<div style={{ gridColumn: '1 / -1' }}>
  <Field label="Mức lương hiện tại (VNĐ)">
    <input
      style={styles.input}
      type="number"
      placeholder="VD: 10000000"
      value={currentSalary}
      onChange={e => setCurrentSalary(e.target.value)}
    />
  </Field>
</div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <button type="submit" style={styles.submitBtn} disabled={loading}>
          {loading ? 'Đang lưu...' : 'Thêm nhân viên'}
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
  actions: { display: 'flex', justifyContent: 'flex-end' },
  submitBtn: { padding: '10px 24px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}