import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const DEFAULT_TITLES = {
  leader: { 0: 'Giám đốc chi nhánh', 1: 'Trưởng bộ phận', 2: 'Tổ trưởng' },
  sub_leader: { 0: 'Phó giám đốc', 1: 'Phó phòng', 2: 'Tổ phó' },
}

export default function EmployeeRoleModal({ employee, departments, onClose, onRefresh }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ department_id: '', role_type: 'leader', title: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchRoles() }, [employee.id])

  const fetchRoles = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('department_roles')
      .select('*, departments(name, parent_id)')
      .eq('employee_id', employee.id)
      .eq('is_active', true)
    setRoles(data || [])
    setLoading(false)
  }

  const getLevel = (deptId) => {
    let level = 0
    let current = departments.find(d => d.id === deptId)
    while (current?.parent_id) {
      level++
      current = departments.find(d => d.id === current.parent_id)
    }
    return level
  }

  const buildDeptOptions = (depts, parentId = null, level = 0) => {
    return depts
      .filter(d => d.parent_id === parentId)
      .flatMap(d => [
        <option key={d.id} value={d.id}>
          {'　'.repeat(level)}{level > 0 ? '└ ' : ''}{d.name}
        </option>,
        ...buildDeptOptions(depts, d.id, level + 1)
      ])
  }

  const handleAdd = async e => {
    e.preventDefault()
    if (!form.department_id) return
    setSaving(true)
    setError('')

    // Kiểm tra đã có role trong dept này chưa
    const existing = roles.find(r => r.department_id === form.department_id)
    if (existing) {
      setError('Nhân viên này đã có chức danh trong bộ phận đó!')
      setSaving(false)
      return
    }

    // Nếu là leader, kiểm tra dept đã có leader chưa
    if (form.role_type === 'leader') {
      const { data: existingLeader } = await supabase
        .from('department_roles')
        .select('id')
        .eq('department_id', form.department_id)
        .eq('role_type', 'leader')
        .eq('is_active', true)

      if (existingLeader?.length > 0) {
        setError('Bộ phận này đã có Leader! Hãy xóa Leader cũ trước.')
        setSaving(false)
        return
      }
    }

    const level = getLevel(form.department_id)
    const defaultTitle = DEFAULT_TITLES[form.role_type]?.[level] || form.role_type
    
    const { error } = await supabase.from('department_roles').insert([{
      department_id: form.department_id,
      employee_id: employee.id,
      role_type: form.role_type,
      title: form.title || defaultTitle,
      is_active: true,
      assigned_by: (await supabase.auth.getUser()).data.user?.id,
    }])

    if (error) setError(error.message)
    else {
      setForm({ department_id: '', role_type: 'leader', title: '' })
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

  // Tên đầy đủ của dept (bao gồm cả cây cha)
  const getDeptFullName = (deptId) => {
    const parts = []
    let current = departments.find(d => d.id === deptId)
    while (current) {
      parts.unshift(current.name)
      current = departments.find(d => d.id === current.parent_id)
    }
    return parts.join(' › ')
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.empInfo}>
            <div style={styles.avatar}>{employee.full_name?.[0]}</div>
            <div>
              <h2 style={styles.title}>👔 Gán chức danh</h2>
              <p style={styles.subtitle}>{employee.full_name} · {employee.employee_code}</p>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Chức danh hiện tại */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Chức danh hiện tại</p>
            {loading ? (
              <p style={styles.empty}>Đang tải...</p>
            ) : roles.length === 0 ? (
              <p style={styles.empty}>Chưa có chức danh nào</p>
            ) : (
              <div style={styles.roleList}>
                {roles.map(r => (
                  <div key={r.id} style={{
                    ...styles.roleItem,
                    borderLeft: `3px solid ${r.role_type === 'leader' ? '#1a56db' : '#d97706'}`
                  }}>
                    <div>
                      <div style={styles.roleDept}>{getDeptFullName(r.department_id)}</div>
                      <span style={{
                        ...styles.roleBadge,
                        background: r.role_type === 'leader' ? '#eff6ff' : '#fffbeb',
                        color: r.role_type === 'leader' ? '#1a56db' : '#d97706',
                      }}>
                        {r.role_type === 'leader' ? '👑' : '⭐'} {r.title}
                      </span>
                    </div>
                    <button style={styles.removeBtn} onClick={() => handleRemove(r.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form thêm chức danh */}
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Thêm chức danh mới</p>
            <form onSubmit={handleAdd}>
              <div style={styles.field}>
                <label style={styles.label}>Bộ phận / Chi nhánh *</label>
                <select style={styles.input} value={form.department_id}
                  onChange={e => {
                    const deptId = e.target.value
                    const level = getLevel(deptId)
                    setForm({
                      ...form,
                      department_id: deptId,
                      title: DEFAULT_TITLES[form.role_type]?.[level] || ''
                    })
                  }} required>
                  <option value="">-- Chọn bộ phận --</option>
                  {buildDeptOptions(departments)}
                </select>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Loại chức danh *</label>
                  <select style={styles.input} value={form.role_type}
                    onChange={e => {
                      const type = e.target.value
                      const level = getLevel(form.department_id)
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
                    placeholder="VD: Tổ trưởng, Phó phòng..." />
                </div>
              </div>

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.formActions}>
                <button type="button" style={styles.cancelBtn} onClick={onClose}>Đóng</button>
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
  modal: { background: '#fff', borderRadius: 12, width: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  empInfo: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 },
  title: { fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#6b7280' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' },
  body: { overflowY: 'auto', padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 },
  section: {},
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 10 },
  empty: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  roleList: { display: 'flex', flexDirection: 'column', gap: 8 },
  roleItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f9fafb', borderRadius: 8 },
  roleDept: { fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 },
  roleBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500 },
  removeBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { fontSize: 12, fontWeight: 500, color: '#374151' },
  input: { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn: { padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  submitBtn: { padding: '8px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}