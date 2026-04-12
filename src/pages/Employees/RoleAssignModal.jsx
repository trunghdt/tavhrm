import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ROLE_TYPE_LABELS = { leader: 'Leader', sub_leader: 'Sub-leader' }
const DEFAULT_TITLES = {
  leader: { 0: 'Giám đốc chi nhánh', 1: 'Trưởng bộ phận', 2: 'Tổ trưởng' },
  sub_leader: { 0: 'Phó giám đốc', 1: 'Phó phòng', 2: 'Tổ phó' },
}

export default function RoleAssignModal({ department, departments, employees, onClose, onRefresh }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ employee_id: '', role_type: 'leader', title: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Tính level của dept trong cây
  const getLevel = (deptId) => {
    let level = 0
    let current = departments.find(d => d.id === deptId)
    while (current?.parent_id) {
      level++
      current = departments.find(d => d.id === current.parent_id)
    }
    return level
  }

  const level = getLevel(department.id)

  useEffect(() => {
    fetchRoles()
    // Set default title
    setForm(f => ({ ...f, title: DEFAULT_TITLES[f.role_type]?.[level] || '' }))
  }, [department.id])

  const fetchRoles = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('department_roles')
      .select('*, employees(full_name, employee_code, position)')
      .eq('department_id', department.id)
      .eq('is_active', true)
      .order('role_type')
    setRoles(data || [])
    setLoading(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.employee_id) return
    setSaving(true)
    setError('')

    // Kiểm tra đã có role chưa
    const existing = roles.find(r => r.employee_id === form.employee_id)
    if (existing) {
      setError('Nhân viên này đã có chức danh trong bộ phận này!')
      setSaving(false)
      return
    }

    // Chỉ có 1 leader
    if (form.role_type === 'leader' && roles.some(r => r.role_type === 'leader')) {
      setError('Bộ phận này đã có Leader! Hãy xóa Leader cũ trước.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('department_roles').insert([{
      department_id: department.id,
      employee_id: form.employee_id,
      role_type: form.role_type,
      title: form.title,
      is_active: true,
      assigned_by: (await supabase.auth.getUser()).data.user?.id,
    }])

    if (error) setError(error.message)
    else {
      setForm({ employee_id: '', role_type: 'leader', title: DEFAULT_TITLES['leader']?.[level] || '' })
      fetchRoles()
      onRefresh()
    }
    setSaving(false)
  }

  const handleRemove = async (roleId) => {
    if (!confirm('Xóa chức danh này?')) return
    await supabase.from('department_roles').delete().eq('id', roleId)
    fetchRoles()
    onRefresh()
  }

  // NV chưa có role trong dept này
  const availableEmployees = employees.filter(
    emp => !roles.find(r => r.employee_id === emp.id)
  )

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>👔 Gán chức danh</h2>
            <p style={styles.subtitle}>{department.name}</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Danh sách chức danh hiện tại */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Chức danh hiện tại</p>
            {loading ? (
              <p style={styles.empty}>Đang tải...</p>
            ) : roles.length === 0 ? (
              <p style={styles.empty}>Chưa có chức danh nào được gán</p>
            ) : (
              <div style={styles.roleList}>
                {/* Leader trước */}
                {roles.filter(r => r.role_type === 'leader').map(r => (
                  <div key={r.id} style={{ ...styles.roleItem, borderLeft: '3px solid #1a56db' }}>
                    <div style={styles.roleLeft}>
                      <div style={{ ...styles.roleAvatar, background: '#1a56db' }}>
                        {r.employees?.full_name?.[0]}
                      </div>
                      <div>
                        <div style={styles.roleName}>{r.employees?.full_name}</div>
                        <div style={styles.roleMeta}>
                          <span style={{ ...styles.roleBadge, background: '#eff6ff', color: '#1a56db' }}>
                            👑 {r.title || 'Leader'}
                          </span>
                          <span style={styles.roleCode}>{r.employees?.employee_code}</span>
                        </div>
                      </div>
                    </div>
                    <button style={styles.removeBtn} onClick={() => handleRemove(r.id)}>✕</button>
                  </div>
                ))}
                {/* Sub-leader */}
                {roles.filter(r => r.role_type === 'sub_leader').map(r => (
                  <div key={r.id} style={{ ...styles.roleItem, borderLeft: '3px solid #d97706' }}>
                    <div style={styles.roleLeft}>
                      <div style={{ ...styles.roleAvatar, background: '#d97706' }}>
                        {r.employees?.full_name?.[0]}
                      </div>
                      <div>
                        <div style={styles.roleName}>{r.employees?.full_name}</div>
                        <div style={styles.roleMeta}>
                          <span style={{ ...styles.roleBadge, background: '#fffbeb', color: '#d97706' }}>
                            ⭐ {r.title || 'Sub-leader'}
                          </span>
                          <span style={styles.roleCode}>{r.employees?.employee_code}</span>
                        </div>
                      </div>
                    </div>
                    <button style={styles.removeBtn} onClick={() => handleRemove(r.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form thêm chức danh */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Gán chức danh mới</p>
            <form onSubmit={handleAdd}>
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Nhân viên *</label>
                  <select style={styles.input} value={form.employee_id}
                    onChange={e => setForm({ ...form, employee_id: e.target.value })} required>
                    <option value="">-- Chọn nhân viên --</option>
                    {availableEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Loại *</label>
                  <select style={styles.input} value={form.role_type}
                    onChange={e => {
                      const type = e.target.value
                      setForm({ ...form, role_type: type, title: DEFAULT_TITLES[type]?.[level] || '' })
                    }}>
                    <option value="leader">👑 Leader</option>
                    <option value="sub_leader">⭐ Sub-leader</option>
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Tên chức danh</label>
                  <input style={styles.input} value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder={DEFAULT_TITLES[form.role_type]?.[level] || 'VD: Tổ trưởng'} />
                </div>
              </div>

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.formActions}>
                <button type="submit" style={styles.submitBtn} disabled={saving}>
                  {saving ? 'Đang lưu...' : '+ Gán chức danh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modal: { background: '#fff', borderRadius: 12, width: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  title: { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#6b7280' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' },
  body: { overflowY: 'auto', padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 },
  section: { },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 12 },
  empty: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  roleList: { display: 'flex', flexDirection: 'column', gap: 8 },
  roleItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6' },
  roleLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  roleAvatar: { width: 36, height: 36, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  roleName: { fontSize: 14, fontWeight: 600, color: '#111827' },
  roleMeta: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 },
  roleBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500 },
  roleCode: { fontSize: 11, color: '#9ca3af' },
  removeBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: '2px 6px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 500, color: '#374151' },
  input: { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  formActions: { display: 'flex', justifyContent: 'flex-end' },
  submitBtn: { padding: '8px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}