import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ROLE_LABELS = { board_manager: 'Board Manager', hr: 'HR Manager', manager: 'Trưởng bộ phận', employee: 'Nhân viên' }
const ROLE_COLORS = { board_manager: '#7c3aed', hr: '#1a56db', manager: '#d97706', employee: '#16a34a' }

const ALL_PERMISSIONS = [
  {
    key: 'manage_employees',
    label: 'Quản lý nhân viên',
    description: 'Thêm, sửa thông tin nhân viên trong hệ thống',
    icon: '👥',
  },
  {
    key: 'manage_evaluations',
    label: 'Đánh giá',
    description: 'Mở kỳ đánh giá năng lực & tăng lương, phê duyệt trung gian trước BLĐ',
    icon: '⭐',
  },
  {
    key: 'manage_cb',
    label: 'C&B (Lương & Phúc lợi)',
    description: 'Xem & quản lý bảng lương toàn bộ nhân viên, tạo & chỉnh sửa bảng lương hàng tháng',
    icon: '💰',
  },
]

export default function PermissionsPage() {
  const [employees, setEmployees] = useState([])
  const [permissions, setPermissions] = useState({}) // { user_id: { role, permissions } }
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState(null) // employee đang phân quyền
  const [editForm, setEditForm] = useState({ role: 'employee', permissions: {} })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // Fetch tất cả nhân viên
    const { data: emps } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .eq('status', 'active')
      .order('full_name')

    // Fetch tất cả permissions
    const { data: perms } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('is_active', true)

    // Map permissions theo user_id
    const permMap = {}
    perms?.forEach(p => { permMap[p.user_id] = p })

    // Map employee với user_id
    const empsWithPerms = (emps || []).map(emp => ({
      ...emp,
      userPerm: Object.values(permMap).find(p => {
        // Match theo user_id trong employees
        return emp.user_id && p.user_id === emp.user_id
      }) || null
    }))

    setEmployees(empsWithPerms)
    setLoading(false)
  }

  const handleOpenEdit = (emp) => {
    setEditingUser(emp)
    setEditForm({
      role: emp.userPerm?.role || 'employee',
      permissions: emp.userPerm?.permissions || {},
    })
    setError('')
  }

  const handleTogglePermission = (key) => {
    setEditForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      }
    }))
  }

  const handleSave = async () => {
    if (!editingUser) return
    setSaving(true)
    setError('')

    const userId = editingUser.user_id
    if (!userId) {
      setError('Nhân viên này chưa có tài khoản đăng nhập!')
      setSaving(false)
      return
    }

    // Kiểm tra đã có permission chưa
    const existing = editingUser.userPerm

    if (existing) {
      // Update
      const { error } = await supabase
        .from('user_permissions')
        .update({
          role: editForm.role,
          permissions: editForm.permissions,
          granted_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) { setError(error.message); setSaving(false); return }
    } else {
      // Insert mới
      const { error } = await supabase
        .from('user_permissions')
        .insert([{
          user_id: userId,
          role: editForm.role,
          permissions: editForm.permissions,
          is_active: true,
          granted_at: new Date().toISOString(),
        }])

      if (error) { setError(error.message); setSaving(false); return }
    }

    setEditingUser(null)
    fetchData()
    setSaving(false)
  }

  // Filter theo search
  const filtered = employees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
    e.position?.toLowerCase().includes(search.toLowerCase())
  )

  const getActivePermCount = (emp) => {
    if (!emp.userPerm?.permissions) return 0
    return Object.values(emp.userPerm.permissions).filter(Boolean).length
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.headerCard}>
        <div>
          <h3 style={styles.headerTitle}>Phân quyền hệ thống</h3>
          <p style={styles.headerSub}>Gán quyền truy cập cho từng nhân viên</p>
        </div>
        <input
          style={styles.search}
          placeholder="🔍 Tìm nhân viên..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Danh sách nhân viên */}
      <div style={styles.card}>
        {loading ? (
          <p style={styles.empty}>Đang tải...</p>
        ) : filtered.length === 0 ? (
          <p style={styles.empty}>Không tìm thấy nhân viên nào</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Nhân viên</th>
                <th style={styles.th}>Bộ phận</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Quyền được cấp</th>
                <th style={styles.th}>Tài khoản</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt="avatar" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={styles.avatar}>{emp.full_name?.[0]}</div>
                      )}
                      <div>
                        <div style={styles.name}>{emp.full_name}</div>
                        <div style={styles.sub}>{emp.employee_code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>{emp.departments?.name || '—'}</td>
                  <td style={styles.td}>
                    {emp.userPerm ? (
                      <span style={{
                        ...styles.badge,
                        background: (ROLE_COLORS[emp.userPerm.role] || '#6b7280') + '15',
                        color: ROLE_COLORS[emp.userPerm.role] || '#6b7280',
                      }}>
                        {ROLE_LABELS[emp.userPerm.role] || emp.userPerm.role}
                      </span>
                    ) : (
                      <span style={{ ...styles.badge, background: '#f3f4f6', color: '#9ca3af' }}>
                        Chưa phân quyền
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {getActivePermCount(emp) > 0 ? (
                      <div style={styles.permTags}>
                        {ALL_PERMISSIONS.filter(p => emp.userPerm?.permissions?.[p.key]).map(p => (
                          <span key={p.key} style={styles.permTag}>{p.icon} {p.label}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {emp.user_id ? (
                      <span style={{ ...styles.badge, background: '#f0fdf4', color: '#16a34a' }}>
                        ✅ Có tài khoản
                      </span>
                    ) : (
                      <span style={{ ...styles.badge, background: '#fef2f2', color: '#dc2626' }}>
                        ❌ Chưa có
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.permBtn}
                      onClick={() => handleOpenEdit(emp)}
                      disabled={!emp.user_id}
                      title={!emp.user_id ? 'Nhân viên chưa có tài khoản' : 'Phân quyền'}
                    >
                      🔐 Phân quyền
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal phân quyền */}
      {editingUser && (
        <div style={styles.overlay} onClick={() => setEditingUser(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.nameCell}>
                <div style={styles.avatar}>{editingUser.full_name?.[0]}</div>
                <div>
                  <h2 style={styles.modalTitle}>🔐 Phân quyền</h2>
                  <p style={styles.modalSub}>{editingUser.full_name} · {editingUser.employee_code}</p>
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setEditingUser(null)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {/* Role */}
              <div style={styles.section}>
                <p style={styles.sectionTitle}>Role hệ thống</p>
                <div style={styles.roleGrid}>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <div
                      key={key}
                      style={{
                        ...styles.roleOption,
                        border: editForm.role === key
                          ? `2px solid ${ROLE_COLORS[key]}`
                          : '2px solid #e5e7eb',
                        background: editForm.role === key
                          ? ROLE_COLORS[key] + '10'
                          : '#fff',
                      }}
                      onClick={() => setEditForm({ ...editForm, role: key })}
                    >
                      <div style={{ ...styles.roleColor, background: ROLE_COLORS[key] }} />
                      <span style={{
                        fontSize: 13, fontWeight: editForm.role === key ? 700 : 500,
                        color: editForm.role === key ? ROLE_COLORS[key] : '#374151',
                      }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div style={styles.section}>
                <p style={styles.sectionTitle}>Quyền truy cập</p>
                <div style={styles.permList}>
                  {ALL_PERMISSIONS.map(perm => {
                    const enabled = !!editForm.permissions[perm.key]
                    return (
                      <div key={perm.key} style={styles.permItem}>
                        <div style={styles.permInfo}>
                          <span style={styles.permIcon}>{perm.icon}</span>
                          <div>
                            <div style={styles.permLabel}>{perm.label}</div>
                            <div style={styles.permDesc}>{perm.description}</div>
                          </div>
                        </div>
                        {/* Toggle switch */}
                        <div
                          style={{
                            ...styles.toggle,
                            background: enabled ? '#1a56db' : '#d1d5db',
                          }}
                          onClick={() => handleTogglePermission(perm.key)}
                        >
                          <div style={{
                            ...styles.toggleDot,
                            transform: enabled ? 'translateX(20px)' : 'translateX(2px)',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.modalActions}>
                <button style={styles.cancelBtn} onClick={() => setEditingUser(null)}>Hủy</button>
                <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? 'Đang lưu...' : '💾 Lưu phân quyền'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  headerCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  headerTitle: { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 },
  headerSub: { fontSize: 13, color: '#6b7280' },
  search: { padding: '9px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', width: 260 },
  card: { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  empty: { padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  name: { fontWeight: 600, color: '#111827', fontSize: 14 },
  sub: { fontSize: 12, color: '#6b7280' },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  permTags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  permTag: { fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#1a56db', fontWeight: 500 },
  permBtn: { padding: '6px 14px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, width: 520, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 2 },
  modalSub: { fontSize: 13, color: '#6b7280' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' },
  modalBody: { padding: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 12 },
  roleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  roleOption: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' },
  roleColor: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  permList: { display: 'flex', flexDirection: 'column', gap: 12 },
  permItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f9fafb', borderRadius: 8 },
  permInfo: { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 },
  permIcon: { fontSize: 20, flexShrink: 0 },
  permLabel: { fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 },
  permDesc: { fontSize: 12, color: '#6b7280', lineHeight: 1.4 },
  toggle: { width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleDot: { position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  saveBtn: { padding: '9px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}