import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ROLE_LABELS = { board_manager: 'Board Manager', hr: 'HR Manager', manager: 'Trưởng bộ phận', employee: 'Nhân viên' }
const ROLE_COLORS = { board_manager: '#7c3aed', hr: '#1a56db', manager: '#d97706', employee: '#16a34a' }

export default function PermissionsPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', role: 'hr' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { fetchUsers() }, [])

const fetchUsers = async () => {
  setLoading(true)

  const { data: perms } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('is_active', true)
    .order('granted_at', { ascending: false })

  if (!perms || perms.length === 0) {
    setUsers([])
    setLoading(false)
    return
  }

  // Lấy danh sách user_ids
  const userIds = perms.map(p => p.user_id)

  // Query employees theo user_id
  const { data: employees } = await supabase
    .from('employees')
    .select('user_id, full_name, employee_code, position')
    .in('user_id', userIds)

  // Ghép dữ liệu
  const merged = perms.map(p => ({
    ...p,
    employee: employees?.find(e => e.user_id === p.user_id) || null
  }))

  setUsers(merged)
  setLoading(false)
}
  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')

    // Tạo tài khoản qua Supabase Admin API
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setCreating(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setError('Không lấy được user ID')
      setCreating(false)
      return
    }

    // Gán role
    const { error: permError } = await supabase.from('user_permissions').insert([{
      user_id: userId,
      role: form.role,
      permissions: getDefaultPermissions(form.role),
      is_active: true,
      granted_at: new Date().toISOString(),
    }])

    if (permError) {
      setError(permError.message)
    } else {
      setSuccess(`✅ Tạo tài khoản ${form.email} (${ROLE_LABELS[form.role]}) thành công!`)
      setForm({ email: '', password: '', role: 'hr' })
      setShowForm(false)
      fetchUsers()
    }
    setCreating(false)
  }

  const getDefaultPermissions = (role) => {
    if (role === 'board_manager') return {
      view_all_employees: true, add_remove_employees: true, edit_employee_profile: true,
      open_evaluation: true, fill_evaluation: true, view_evaluation_results: true,
      approve_evaluation: true, open_salary_review: true, propose_salary: true,
      approve_salary: true, view_payroll: true, view_payslip: true,
      view_salary_history: true, manage_permissions: true,
    }
    if (role === 'hr') return {
      view_all_employees: true, add_remove_employees: true, edit_employee_profile: true,
      open_evaluation: true, view_evaluation_results: true, approve_evaluation: true,
      open_salary_review: true, view_payroll: true, view_payslip: true,
      view_salary_history: true,
    }
    if (role === 'manager') return {
      view_department_employees: true, fill_evaluation: true,
      view_evaluation_results: true, propose_salary: true, view_payslip: true,
    }
    return { view_own_profile: true, view_payslip: true }
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.headerCard}>
        <div>
          <h3 style={styles.headerTitle}>Quản lý phân quyền</h3>
          <p style={styles.headerSub}>Board Manager có thể tạo tài khoản và gán quyền cho từng người dùng</p>
        </div>
        <button style={styles.addBtn} onClick={() => { setShowForm(true); setError(''); setSuccess('') }}>
          + Tạo tài khoản
        </button>
      </div>

      {/* Thông báo */}
      {success && (
        <div style={styles.successBox}>{success}</div>
      )}

      {/* Form tạo tài khoản */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Tạo tài khoản mới</h3>
          <form onSubmit={handleCreate}>
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Email *</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="hr@company.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Mật khẩu *</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Role *</label>
                <select
                  style={styles.input}
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  <option value="hr">HR Manager</option>
                  <option value="manager">Trưởng bộ phận</option>
                  <option value="employee">Nhân viên</option>
                  <option value="board_manager">Board Manager</option>
                </select>
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => setShowForm(false)}>Hủy</button>
              <button type="submit" style={styles.submitBtn} disabled={creating}>
                {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách phân quyền */}
      <div style={styles.card}>
        {loading ? (
          <p style={{ padding: 24, color: '#6b7280' }}>Đang tải...</p>
        ) : users.length === 0 ? (
          <p style={{ padding: 24, color: '#6b7280' }}>Chưa có phân quyền nào.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>User ID</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Ngày cấp</th>
                <th style={styles.th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={styles.tr}>
<td style={styles.td}>
  <div style={styles.nameCell}>
<div style={{ ...styles.avatar, background: ROLE_COLORS[u.role] || '#6b7280' }}>
  {u.employee?.full_name?.[0]?.toUpperCase() || 'U'}
</div>
<div>
  <div style={styles.name}>
    {u.employee?.full_name || 'Chưa liên kết hồ sơ'}
  </div>
  <div style={styles.sub}>
    {u.employee?.employee_code ? `${u.employee.employee_code} · ` : ''}{u.employee?.position || u.user_id?.substring(0, 8) + '...'}
  </div>
</div>
  </div>
</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      background: (ROLE_COLORS[u.role] || '#6b7280') + '15',
                      color: ROLE_COLORS[u.role] || '#6b7280',
                    }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {u.granted_at ? new Date(u.granted_at).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: '#dcfce7', color: '#16a34a' }}>
                      Đang hoạt động
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles = {
  headerCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  headerTitle: { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 },
  headerSub: { fontSize: 13, color: '#6b7280' },
  addBtn: { padding: '10px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  successBox: { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#16a34a', fontSize: 14, fontWeight: 500 },
  formCard: { background: '#fff', borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '2px solid #bfdbfe' },
  formTitle: { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 20 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  input: { padding: '9px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  submitBtn: { padding: '9px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  card: { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  userId: { fontFamily: 'monospace', fontSize: 13, color: '#6b7280' },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  name: { fontWeight: 600, color: '#111827', fontSize: 14 },
sub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
}