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
  const currentParent = currentDept?.parent_id ? departments.find(d => d.id === currentDept.parent_id) : null
  const currentGrandParent = currentParent?.parent_id ? departments.find(d => d.id === currentParent.parent_id) : null
  const initBranchId = currentGrandParent?.id || currentParent?.id || ''
  const initDeptId = currentGrandParent ? currentParent?.id || '' : currentDept?.parent_id ? currentDept.id : ''
  const initTeamId = currentGrandParent ? currentDept?.id || '' : ''

  const [selectedBranchId, setSelectedBranchId] = useState(initBranchId)
  const [selectedDeptId, setSelectedDeptId] = useState(initDeptId)
  const [selectedTeamId, setSelectedTeamId] = useState(initTeamId)

  // Cơ cấu lương
  const [baseSalary, setBaseSalary] = useState('')
  const [hieuSuat, setHieuSuat] = useState('')
  const [chuyenCan, setChuyenCan] = useState('')
  const [doiSong, setDoiSong] = useState('')
  const [tichLuy, setTichLuy] = useState('')
  const [salaryChanged, setSalaryChanged] = useState(false)

  // Fetch lương hiện tại khi mở form
  useEffect(() => {
    const fetchSalary = async () => {
      const { data } = await supabase
        .from('salary_records')
        .select('base_salary, hieu_suat, chuyen_can, doi_song, tich_luy')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (data) {
        setBaseSalary(data.base_salary || '')
        setHieuSuat(data.hieu_suat || '')
        setChuyenCan(data.chuyen_can || '')
        setDoiSong(data.doi_song || '')
        setTichLuy(data.tich_luy || '')
      }
    }
    fetchSalary()
  }, [employee.id])

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const payload = { ...form }
    if (!payload.end_date) delete payload.end_date

// Chỉ update department_id khi user chọn dropdown
// Nếu không chọn gì → giữ nguyên department_id hiện tại của nhân viên
if (selectedTeamId) {
  payload.department_id = selectedTeamId
} else if (selectedDeptId) {
  payload.department_id = selectedDeptId
} else if (selectedBranchId) {
  payload.department_id = selectedBranchId
} else {
  // Không thay đổi gì → giữ nguyên
  payload.department_id = employee.department_id
}
delete payload.team

    // Update thông tin nhân viên
    const { error: updateError } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employee.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Lưu cơ cấu lương mới nếu có thay đổi


if (salaryChanged) {
  const salaryResult = await supabase.from('salary_records').insert([{
    employee_id: employee.id,
    base_salary: Number(baseSalary) || 0,
    hieu_suat: Number(hieuSuat) || 0,
    chuyen_can: Number(chuyenCan) || 0,
    doi_song: Number(doiSong) || 0,
    tich_luy: Number(tichLuy) || 0,
    salary_type: 'time_based',
    effective_date: new Date().toISOString().split('T')[0],
    change_reason: 'Cập nhật thủ công',
  }])
  if (salaryResult.error) setError(salaryResult.error.message)
}

    setLoading(false)
    onSuccess()
  }

  const branches = departments.filter(d => !d.parent_id)
  const depts = departments.filter(d => d.parent_id === selectedBranchId)
  const teams = departments.filter(d => d.parent_id === selectedDeptId)

  const totalSalary = (Number(baseSalary) || 0) + (Number(hieuSuat) || 0) +
    (Number(chuyenCan) || 0) + (Number(doiSong) || 0) + (Number(tichLuy) || 0)

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
            onChange={e => { setSelectedBranchId(e.target.value); setSelectedDeptId(''); setForm({ ...form, department_id: '', team: '' }) }}>
            <option value="">-- Chọn chi nhánh --</option>
            {branches.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Bộ phận">
          <select style={styles.input} value={selectedDeptId}
            onChange={e => { setSelectedDeptId(e.target.value); setForm({ ...form, department_id: e.target.value, team: '' }) }}
            disabled={!selectedBranchId}>
            <option value="">-- Chọn bộ phận --</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Tổ">
<select style={styles.input} value={selectedTeamId}
  onChange={e => {
    setSelectedTeamId(e.target.value)
    setForm({ ...form, team: e.target.value })
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

        {/* Cơ cấu lương */}
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #f3f4f6', paddingTop: 16, marginTop: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>💵 Cơ cấu lương (VNĐ)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Lương cơ bản', value: baseSalary, set: setBaseSalary },
              { label: 'Hiệu suất', value: hieuSuat, set: setHieuSuat },
              { label: 'Chuyên cần', value: chuyenCan, set: setChuyenCan },
              { label: 'Đời sống', value: doiSong, set: setDoiSong },
              { label: 'Tích lũy', value: tichLuy, set: setTichLuy },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{f.label}</label>
                <input style={styles.input} type="number" placeholder="0"
                  value={f.value} onChange={e => { f.set(e.target.value); setSalaryChanged(true) }} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1a56db' }}>Tổng lương</label>
              <div style={{ padding: '9px 12px', borderRadius: 7, background: '#eff6ff', fontSize: 14, fontWeight: 700, color: '#1a56db' }}>
                {new Intl.NumberFormat('vi-VN').format(totalSalary)} đ
              </div>
            </div>
          </div>
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