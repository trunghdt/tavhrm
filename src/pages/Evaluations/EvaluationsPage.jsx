import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const STATUS_LABELS = { draft: 'Nháp', open: 'Đang mở', closed: 'Đã đóng', approved: 'Đã duyệt' }
const STATUS_COLORS = { draft: '#6b7280', open: '#16a34a', closed: '#d97706', approved: '#1a56db' }

const RANKING = (score) => {
  if (score >= 90) return '🏆 Xuất sắc'
  if (score >= 80) return '⭐⭐ Tốt'
  if (score >= 70) return '⭐ Khá'
  if (score >= 65) return '✅ Đạt'
  return '⚠️ Cần cải thiện'
}

const TEMPLATE_LABELS = { sx: '🏭 Sản xuất', vp: '🏢 Văn phòng', ql: '👔 Quản lý' }

export default function EvaluationsPage() {
  const { role } = useAuthStore()
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [templates, setTemplates] = useState([])
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])

  // Form tạo kỳ
  const [form, setForm] = useState({ title: '', period: '', deadline: '' })
  const [deptAssignments, setDeptAssignments] = useState([]) // [{dept_id, template_type}]
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Form điền điểm
  const [showEvaluate, setShowEvaluate] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [cycleEmployees, setCycleEmployees] = useState([])
  const [scores, setScores] = useState({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [existingEvals, setExistingEvals] = useState([])

  useEffect(() => {
    fetchCycles()
    fetchTemplates()
    fetchDepartments()
  }, [])

  const fetchCycles = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('evaluation_cycles')
      .select('*')
      .order('created_at', { ascending: false })
    setCycles(data || [])
    setLoading(false)
  }

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('criteria_templates')
      .select('*')
      .eq('is_active', true)
    setTemplates(data || [])
  }

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
    setDepartments(data || [])
  }

  const fetchCycleEmployees = async (cycle) => {
    const scope = cycle.scope || {}
    const deptAssign = scope.dept_assignments || []

    // Lấy tất cả nhân viên thuộc các phòng ban trong kỳ
    const deptIds = deptAssign.map(d => d.dept_id)
    const { data: emps } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .in('department_id', deptIds)
      .eq('status', 'active')

    // Lấy các đánh giá đã có
    const { data: evals } = await supabase
      .from('evaluations')
      .select('*')
      .eq('cycle_id', cycle.id)

    setExistingEvals(evals || [])

    // Phân nhóm: NV thường theo BP, Trưởng BP → nhóm QL (do Board Manager đánh giá)
    const userPerms = await supabase
      .from('user_permissions')
      .select('user_id, role')
      .in('role', ['manager'])
      .eq('is_active', true)

    const managerUserIds = (userPerms.data || []).map(p => p.user_id)

    // Gán template cho từng NV
    const result = (emps || []).map(emp => {
      const isManager = managerUserIds.includes(emp.user_id)
      const deptInfo = deptAssign.find(d => d.dept_id === emp.department_id)
      return {
        ...emp,
        template_type: isManager ? 'ql' : (deptInfo?.template_type || 'vp'),
        is_manager: isManager,
        evaluated_by: isManager ? 'board_manager' : 'manager',
      }
    })

    setCycleEmployees(result)
    setEmployees(emps || [])
  }

  // Thêm/xóa phòng ban vào kỳ đánh giá
  const toggleDept = (deptId) => {
    setDeptAssignments(prev => {
      const exists = prev.find(d => d.dept_id === deptId)
      if (exists) return prev.filter(d => d.dept_id !== deptId)
      return [...prev, { dept_id: deptId, template_type: 'vp' }]
    })
  }

  const setDeptTemplate = (deptId, templateType) => {
    setDeptAssignments(prev =>
      prev.map(d => d.dept_id === deptId ? { ...d, template_type: templateType } : d)
    )
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (deptAssignments.length === 0) {
      setError('Vui lòng chọn ít nhất 1 phòng ban!')
      return
    }
    setCreating(true)
    setError('')

    const { data: cycle, error: cycleError } = await supabase
      .from('evaluation_cycles')
      .insert([{
        title: form.title,
        period: form.period,
        deadline: form.deadline,
        status: 'open',
        scope: { dept_assignments: deptAssignments },
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }])
      .select()
      .single()

    if (cycleError) {
      setError(cycleError.message)
      setCreating(false)
      return
    }

    setShowForm(false)
    setForm({ title: '', period: '', deadline: '' })
    setDeptAssignments([])
    fetchCycles()
    setCreating(false)
  }

  const handleOpenEvaluate = async (cycle) => {
    setSelectedCycle(cycle)
    await fetchCycleEmployees(cycle)
    setShowEvaluate(true)
  }

  const handleSelectEmployee = (emp) => {
    // Kiểm tra quyền: manager chỉ đánh giá NV thường, board_manager đánh giá manager
    if (role === 'manager' && emp.is_manager) return
    if (role === 'board_manager' && !emp.is_manager) {
      // Board manager có thể đánh giá tất cả
    }
    setSelectedEmployee(emp)
    setScores({})
    setComment('')

    // Load điểm đã có nếu có
    const existing = existingEvals.find(e => e.employee_id === emp.id)
    if (existing) {
      setScores(existing.scores || {})
      setComment(existing.comment || '')
    }
  }

  const handleSubmitEval = async () => {
    if (!selectedEmployee || !selectedCycle) return
    setSubmitting(true)

    // Tính tổng điểm
    const template = templates.find(t => t.template_type === selectedEmployee.template_type)
    const criteria = template?.criteria_data || []
    let totalScore = 0

    criteria.forEach(group => {
      const groupScores = group.items.map(item => Number(scores[item.name] || 0))
      const groupTotal = groupScores.reduce((a, b) => a + b, 0)
      const groupMax = group.items.reduce((a, b) => a + b.max_score, 0)
      totalScore += (groupTotal / groupMax) * group.weight
    })

    const ranking = RANKING(totalScore)
    const userId = (await supabase.auth.getUser()).data.user?.id

    // Kiểm tra đã có đánh giá chưa
    const existing = existingEvals.find(e => e.employee_id === selectedEmployee.id)

    if (existing) {
      await supabase.from('evaluations').update({
        scores, total_score: totalScore, ranking, comment,
        status: 'submitted', submitted_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('evaluations').insert([{
        cycle_id: selectedCycle.id,
        employee_id: selectedEmployee.id,
        evaluator_id: userId,
        scores, total_score: totalScore, ranking, comment,
        status: 'submitted', submitted_at: new Date().toISOString(),
      }])
    }

    // Reload
    await fetchCycleEmployees(selectedCycle)
    setSelectedEmployee(null)
    setSubmitting(false)
  }

  const canCreate = role === 'board_manager' || role === 'hr'

  // Lọc NV theo quyền
  const visibleEmployees = cycleEmployees.filter(emp => {
    if (role === 'board_manager') return true
    if (role === 'manager') return !emp.is_manager // Chỉ thấy NV thường
    return false
  })

  const getTemplate = (emp) => {
    return templates.find(t => t.template_type === emp?.template_type)
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.headerRow}>
        {canCreate && (
          <button style={styles.addBtn} onClick={() => { setShowForm(true); setError('') }}>
            + Tạo kỳ đánh giá
          </button>
        )}
      </div>

      {/* Form tạo kỳ */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Tạo kỳ đánh giá mới</h3>
          <form onSubmit={handleCreate}>
            <div style={styles.formGrid3}>
              <div style={styles.field}>
                <label style={styles.label}>Tên kỳ đánh giá *</label>
                <input style={styles.input} placeholder="VD: Đánh giá Q1/2026"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Kỳ *</label>
                <input style={styles.input} placeholder="VD: Q1/2026"
                  value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Deadline *</label>
                <input style={styles.input} type="date"
                  value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} required />
              </div>
            </div>

            {/* Chọn phòng ban + loại đánh giá */}
            <div style={styles.deptSection}>
              <p style={styles.deptTitle}>📋 Chọn phòng ban & loại đánh giá</p>
              <p style={styles.deptSub}>
                ⚠️ Trưởng bộ phận sẽ tự động được xếp vào nhóm <strong>Quản lý</strong> và do <strong>Board Manager</strong> đánh giá.
              </p>
              <div style={styles.deptList}>
                {departments.map(dept => {
                  const assigned = deptAssignments.find(d => d.dept_id === dept.id)
                  return (
                    <div key={dept.id} style={{ ...styles.deptItem, ...(assigned ? styles.deptItemActive : {}) }}>
                      <div style={styles.deptItemLeft}>
                        <input type="checkbox" checked={!!assigned}
                          onChange={() => toggleDept(dept.id)} id={`dept-${dept.id}`} />
                        <label htmlFor={`dept-${dept.id}`} style={styles.deptName}>{dept.name}</label>
                      </div>
                      {assigned && (
                        <select style={styles.templateSelect}
                          value={assigned.template_type}
                          onChange={e => setDeptTemplate(dept.id, e.target.value)}>
                          <option value="sx">🏭 Sản xuất</option>
                          <option value="vp">🏢 Văn phòng</option>
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}
            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowForm(false); setDeptAssignments([]) }}>Hủy</button>
              <button type="submit" style={styles.submitBtn} disabled={creating}>
                {creating ? 'Đang tạo...' : 'Tạo kỳ đánh giá'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách kỳ */}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Đang tải...</p>
      ) : cycles.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyIcon}>⭐</p>
          <p style={styles.emptyText}>Chưa có kỳ đánh giá nào</p>
          <p style={styles.emptySub}>HR tạo kỳ đánh giá để bắt đầu quy trình</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {cycles.map(cycle => (
            <div key={cycle.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>{cycle.title}</h3>
                <span style={{ ...styles.badge, background: (STATUS_COLORS[cycle.status] || '#6b7280') + '15', color: STATUS_COLORS[cycle.status] || '#6b7280' }}>
                  {STATUS_LABELS[cycle.status] || cycle.status}
                </span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Kỳ</span>
                  <span style={styles.infoValue}>{cycle.period || '—'}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Deadline</span>
                  <span style={styles.infoValue}>{cycle.deadline ? new Date(cycle.deadline).toLocaleDateString('vi-VN') : '—'}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Phòng ban</span>
                  <span style={styles.infoValue}>{(cycle.scope?.dept_assignments?.length || 0)} BP</span>
                </div>
              </div>
              <div style={styles.cardFooter}>
                {cycle.status === 'open' && (
                  <button style={styles.evalBtn} onClick={() => handleOpenEvaluate(cycle)}>
                    📝 Điền đánh giá
                  </button>
                )}
                <button style={styles.viewBtn} onClick={() => setSelected(cycle)}>
                  Chi tiết →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal điền đánh giá */}
      {showEvaluate && selectedCycle && (
        <div style={styles.overlay} onClick={() => { setShowEvaluate(false); setSelectedEmployee(null) }}>
          <div style={{ ...styles.modal, width: selectedEmployee ? 700 : 500 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>📝 {selectedCycle.title}</h2>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {selectedEmployee ? `Đang đánh giá: ${selectedEmployee.full_name}` : 'Chọn nhân viên để đánh giá'}
                </p>
              </div>
              <button style={styles.closeBtn} onClick={() => { setShowEvaluate(false); setSelectedEmployee(null) }}>✕</button>
            </div>

            <div style={{ display: 'flex', maxHeight: '70vh', overflow: 'hidden' }}>
              {/* Danh sách NV */}
              <div style={styles.empList}>
                {/* Nhóm NV thường */}
                <p style={styles.groupLabel}>👥 Nhân viên</p>
                {visibleEmployees.filter(e => !e.is_manager).map(emp => {
                  const evalDone = existingEvals.find(ev => ev.employee_id === emp.id)
                  return (
                    <div key={emp.id}
                      style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}), ...(evalDone ? styles.empItemDone : {}) }}
                      onClick={() => handleSelectEmployee(emp)}>
                      <div style={styles.empAvatar}>{emp.full_name?.[0]}</div>
                      <div>
                        <div style={styles.empName}>{emp.full_name}</div>
                        <div style={styles.empMeta}>{TEMPLATE_LABELS[emp.template_type]} {evalDone ? '✅' : ''}</div>
                      </div>
                    </div>
                  )
                })}

                {/* Nhóm Quản lý — chỉ Board Manager thấy */}
                {role === 'board_manager' && cycleEmployees.filter(e => e.is_manager).length > 0 && (
                  <>
                    <p style={{ ...styles.groupLabel, marginTop: 12 }}>👔 Trưởng bộ phận</p>
                    {cycleEmployees.filter(e => e.is_manager).map(emp => {
                      const evalDone = existingEvals.find(ev => ev.employee_id === emp.id)
                      return (
                        <div key={emp.id}
                          style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}), ...(evalDone ? styles.empItemDone : {}) }}
                          onClick={() => handleSelectEmployee(emp)}>
                          <div style={{ ...styles.empAvatar, background: '#7c3aed' }}>{emp.full_name?.[0]}</div>
                          <div>
                            <div style={styles.empName}>{emp.full_name}</div>
                            <div style={styles.empMeta}>👔 Quản lý {evalDone ? '✅' : ''}</div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>

              {/* Form điền điểm */}
              {selectedEmployee && (
                <div style={styles.scoreForm}>
                  <div style={styles.scoreHeader}>
                    <strong>{selectedEmployee.full_name}</strong>
                    <span style={styles.templateBadge}>{TEMPLATE_LABELS[selectedEmployee.template_type]}</span>
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: 'calc(70vh - 160px)', paddingRight: 8 }}>
                    {(getTemplate(selectedEmployee)?.criteria_data || []).map((group, gi) => (
                      <div key={gi} style={styles.criteriaGroup}>
                        <div style={styles.groupHeader}>
                          <span style={styles.groupName}>{group.group}</span>
                          <span style={styles.groupWeight}>Trọng số: {group.weight}%</span>
                        </div>
                        {group.items.map((item, ii) => (
                          <div key={ii} style={styles.criteriaRow}>
                            <div style={styles.criteriaInfo}>
                              <span style={styles.criteriaName}>{item.name}</span>
                              <span style={styles.criteriaDesc}>{item.description}</span>
                            </div>
                            <div style={styles.scoreInput}>
                              <input
                                type="number"
                                min="0"
                                max={item.max_score}
                                style={styles.scoreField}
                                placeholder="0"
                                value={scores[item.name] || ''}
                                onChange={e => setScores({ ...scores, [item.name]: e.target.value })}
                              />
                              <span style={styles.scoreMax}>/{item.max_score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    <div style={styles.commentBox}>
                      <label style={styles.label}>Nhận xét tổng quan</label>
                      <textarea
                        style={styles.textarea}
                        placeholder="Nhận xét về nhân viên..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div style={styles.scoreActions}>
                    <button style={styles.cancelBtn} onClick={() => setSelectedEmployee(null)}>Hủy</button>
                    <button style={styles.submitBtn} onClick={handleSubmitEval} disabled={submitting}>
                      {submitting ? 'Đang lưu...' : '✅ Lưu đánh giá'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal chi tiết kỳ */}
      {selected && (
        <div style={styles.overlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selected.title}</h2>
                <span style={{ ...styles.badge, background: (STATUS_COLORS[selected.status] || '#6b7280') + '15', color: STATUS_COLORS[selected.status] || '#6b7280' }}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>
              <button style={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.infoGrid}>
                {[
                  ['Kỳ đánh giá', selected.period],
                  ['Deadline', selected.deadline ? new Date(selected.deadline).toLocaleDateString('vi-VN') : '—'],
                  ['Số phòng ban', `${selected.scope?.dept_assignments?.length || 0} phòng ban`],
                  ['Ngày tạo', new Date(selected.created_at).toLocaleDateString('vi-VN')],
                ].map(([label, value]) => (
                  <div key={label} style={styles.infoItem}>
                    <span style={styles.infoLabel}>{label}</span>
                    <span style={styles.infoValue}>{value || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Phòng ban trong kỳ */}
              {selected.scope?.dept_assignments?.length > 0 && (
                <div style={styles.deptSection}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Phòng ban tham gia:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selected.scope.dept_assignments.map(d => {
                      const dept = departments.find(dep => dep.id === d.dept_id)
                      return (
                        <span key={d.dept_id} style={{ ...styles.badge, background: '#eff6ff', color: '#1a56db' }}>
                          {dept?.name || d.dept_id} · {TEMPLATE_LABELS[d.template_type]}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {canCreate && (
                <div style={styles.actionRow}>
                  {selected.status === 'open' && (
                    <>
                      <button style={styles.primaryBtn} onClick={() => { setSelected(null); handleOpenEvaluate(selected) }}>
                        📝 Điền đánh giá
                      </button>
                      {role === 'board_manager' && (
                        <button style={styles.warningBtn} onClick={async () => {
                          await supabase.from('evaluation_cycles').update({ status: 'closed' }).eq('id', selected.id)
                          fetchCycles(); setSelected(null)
                        }}>Đóng kỳ</button>
                      )}
                    </>
                  )}
                  {selected.status === 'closed' && role === 'board_manager' && (
                    <button style={styles.primaryBtn} onClick={async () => {
                      await supabase.from('evaluation_cycles').update({ status: 'approved' }).eq('id', selected.id)
                      fetchCycles(); setSelected(null)
                    }}>✅ Phê duyệt</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  headerRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: 20 },
  addBtn: { padding: '10px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  formCard: { background: '#fff', borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '2px solid #bfdbfe' },
  formTitle: { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 20 },
  formGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  input: { padding: '9px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' },
  deptSection: { background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16 },
  deptTitle: { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  deptSub: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  deptList: { display: 'flex', flexDirection: 'column', gap: 8 },
  deptItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' },
  deptItemActive: { border: '1px solid #bfdbfe', background: '#eff6ff' },
  deptItemLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  deptName: { fontSize: 14, fontWeight: 500, color: '#111827', cursor: 'pointer' },
  templateSelect: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  submitBtn: { padding: '9px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  empty: { background: '#fff', borderRadius: 10, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6b7280' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#111827' },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  infoRow: { display: 'flex', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValue: { fontSize: 13, fontWeight: 500, color: '#111827' },
  cardFooter: { borderTop: '1px solid #f3f4f6', paddingTop: 12, display: 'flex', gap: 8 },
  evalBtn: { padding: '6px 14px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  viewBtn: { background: 'none', border: 'none', color: '#1a56db', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 12, width: 560, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#111827' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  modalBody: { padding: 24, overflowY: 'auto' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  infoItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  actionRow: { display: 'flex', gap: 12, marginTop: 20 },
  primaryBtn: { padding: '10px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  warningBtn: { padding: '10px 20px', background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  empList: { width: 200, borderRight: '1px solid #f3f4f6', padding: '16px 12px', overflowY: 'auto', flexShrink: 0 },
  groupLabel: { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 },
  empItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4 },
  empItemActive: { background: '#eff6ff' },
  empItemDone: { opacity: 0.7 },
  empAvatar: { width: 30, height: 30, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  empName: { fontSize: 13, fontWeight: 600, color: '#111827' },
  empMeta: { fontSize: 11, color: '#6b7280' },
  scoreForm: { flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  scoreHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' },
  templateBadge: { fontSize: 12, background: '#eff6ff', color: '#1a56db', padding: '2px 8px', borderRadius: 12 },
  criteriaGroup: { marginBottom: 16 },
  groupHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, marginBottom: 8 },
  groupName: { fontSize: 13, fontWeight: 600, color: '#111827' },
  groupWeight: { fontSize: 12, color: '#6b7280' },
  criteriaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 4px', borderBottom: '1px solid #f9fafb' },
  criteriaInfo: { flex: 1, marginRight: 12 },
  criteriaName: { fontSize: 13, fontWeight: 500, color: '#374151', display: 'block' },
  criteriaDesc: { fontSize: 11, color: '#9ca3af', display: 'block', marginTop: 2 },
  scoreInput: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  scoreField: { width: 56, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, textAlign: 'center', outline: 'none' },
  scoreMax: { fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' },
  commentBox: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 },
  textarea: { padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', resize: 'vertical' },
  scoreActions: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6', flexShrink: 0 },
}