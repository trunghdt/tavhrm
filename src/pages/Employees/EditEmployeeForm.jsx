import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const EMPLOYMENT_TYPES = [
  { value: 'thu_viec', label: 'Hợp đồng thử việc' },
  { value: 'thoi_vu', label: 'Hợp đồng thời vụ' },
  { value: 'co_thoi_han', label: 'Hợp đồng có thời hạn' },
  { value: 'vo_thoi_han', label: 'Hợp đồng vô thời hạn' },
]

export default function EditEmployeeForm({ employee, onSuccess, onClose }) {
  const [departments, setDepartments] = useState([])
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

  useEffect(() => {
    supabase.from('departments').select('*').eq('is_active', true).then(({ data }) => {
      setDepartments(data || [])
    })
  }, [])

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const payload = { ...form }
    if (!payload.end_date) delete payload.end_date
    if (!payload.department_id) delete payload.department_id
    const { error } = await supabase.from('employees').update(payload).eq('id', employee.id)
    if (error) setError(error.message)
    else onSuccess()
    setLoading(false)
  }

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
          <input style={styles.input} name="branch" value={form.branch} onChange={handleChange} />
        </Field>

        <Field label="Phòng ban">
          <select style={styles.input} name="department_id" value={form.department_id} onChange={handleChange}>
            <option value="">-- Chọn phòng ban --</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>

        <Field label="Tổ">
          <input style={styles.input} name="team" value={form.team} onChange={handleChange} />
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