import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const STATUS_LABELS = { draft: 'Nháp', open: 'Đang mở', closed: 'Đã đóng', approved: 'Đã duyệt' }
const STATUS_COLORS = { draft: '#6b7280', open: '#16a34a', closed: '#d97706', approved: '#1a56db' }
const TEMPLATE_LABELS = { sx: '🏭 Sản xuất', vp: '🏢 Văn phòng', ql: '👔 Quản lý' }

const RANKING = (score) => {
  if (score >= 90) return { label: '🏆 Xuất sắc', color: '#d97706' }
  if (score >= 80) return { label: '⭐⭐ Tốt', color: '#1a56db' }
  if (score >= 70) return { label: '⭐ Khá', color: '#7c3aed' }
  if (score >= 65) return { label: '✅ Đạt', color: '#16a34a' }
  return { label: '⚠️ Cần cải thiện', color: '#dc2626' }
}

export default function EvaluationsPage() {
  const { role } = useAuthStore()
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState([])
  const [departments, setDepartments] = useState([])
  const [departmentRoles, setDepartmentRoles] = useState([])
  const [employees, setEmployees] = useState([])

  // Form tạo kỳ
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', period: '', deadline: '' })
  const [deptAssignments, setDeptAssignments] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Điền điểm
  const [showEvaluate, setShowEvaluate] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [cycleEmployees, setCycleEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [scores, setScores] = useState({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [existingEvals, setExistingEvals] = useState([])

  // Chi tiết kỳ
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: cyclesData },
      { data: tmplData },
      { data: deptsData },
      { data: rolesData },
      { data: empsData },
    ] = await Promise.all([
      supabase.from('evaluation_cycles').select('*').order('created_at', { ascending: false }),
      supabase.from('criteria_templates').select('*').eq('is_active', true),
      supabase.from('departments').select('*').eq('is_active', true),
      supabase.from('department_roles').select('*, employees(full_name, employee_code)').eq('is_active', true),
      supabase.from('employees').select('*, departments(name)').eq('status', 'active'),
    ])
    setCycles(cyclesData || [])
    setTemplates(tmplData || [])
    setDepartments(deptsData || [])
    setDepartmentRoles(rolesData || [])
    setEmployees(empsData || [])
    setLoading(false)
  }

  // Tìm leader của dept hoặc dept cha
  const findLeader = (deptId) => {
    const leader = departmentRoles.find(r => r.department_id === deptId && r.role_type === 'leader')
    if (leader) return leader
    // Tìm ở dept cha
    const dept = departments.find(d => d.id === deptId)
    if (dept?.parent_id) return findLeader(dept.parent_id)
    return null
  }

  // Toggle chọn dept
const toggleDept = (deptId) => {
  // Lấy tất cả ID con cháu của dept này
  const getDescendantIds = (id) => {
    const children = departments.filter(d => d.parent_id === id)
    return [...children.map(c => c.id), ...children.flatMap(c => getDescendantIds(c.id))]
  }

  const descendantIds = getDescendantIds(deptId)
  const allIds = [deptId, ...descendantIds]

  setDeptAssignments(prev => {
    const isChecked = prev.some(d => d.dept_id === deptId)

    if (isChecked) {
      // Bỏ tick node này và tất cả con cháu
      return prev.filter(d => !allIds.includes(d.dept_id))
    } else {
      // Tick node này và tất cả con cháu (giữ lại các node đã tick trước)
      const newIds = allIds.filter(id => !prev.some(d => d.dept_id === id))
      const newAssignments = newIds.map(id => ({
        dept_id: id,
        template_type: 'sx' // default
      }))
      return [...prev, ...newAssignments]
    }
  })
}

  const setDeptTemplate = (deptId, type) => {
    setDeptAssignments(prev =>
      prev.map(d => d.dept_id === deptId ? { ...d, template_type: type } : d)
    )
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (deptAssignments.length === 0) { setError('Chọn ít nhất 1 bộ phận!'); return }
    setCreating(true)
    setError('')

    const { data: cycle, error: err } = await supabase
      .from('evaluation_cycles')
      .insert([{
        title: form.title,
        period: form.period,
        deadline: form.deadline,
        status: 'open',
        scope: { dept_assignments: deptAssignments },
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }])
      .select().single()

    if (err) { setError(err.message); setCreating(false); return }

    setShowForm(false)
    setForm({ title: '', period: '', deadline: '' })
    setDeptAssignments([])
    fetchAll()
    setCreating(false)
  }

  const handleOpenEvaluate = async (cycle) => {
    setSelectedCycle(cycle)
    const scope = cycle.scope || {}
    const deptAssign = scope.dept_assignments || []
    const deptIds = deptAssign.map(d => d.dept_id)

    // Lấy NV trong các dept
    const { data: emps } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .in('department_id', deptIds)
      .eq('status', 'active')

    // Lấy đánh giá đã có
    const { data: evals } = await supabase
      .from('evaluations')
      .select('*')
      .eq('cycle_id', cycle.id)

    setExistingEvals(evals || [])

    // Xác định template và evaluator cho từng NV
    const result = (emps || []).map(emp => {
      const isLeader = departmentRoles.some(r => r.employee_id === emp.id && r.role_type === 'leader')
      const deptInfo = deptAssign.find(d => d.dept_id === emp.department_id)
      const leader = findLeader(emp.department_id)
      return {
        ...emp,
        template_type: isLeader ? 'ql' : (deptInfo?.template_type || 'vp'),
        is_leader: isLeader,
        evaluator: isLeader ? 'board_manager' : (leader?.employees?.full_name || 'Chưa có leader'),
        leader_id: isLeader ? null : leader?.employee_id,
      }
    })

    // Sắp xếp: Leader → Sub-leader → NV thường
    result.sort((a, b) => {
      if (a.is_leader && !b.is_leader) return -1
      if (!a.is_leader && b.is_leader) return 1
      return 0
    })

    setCycleEmployees(result)
    setShowEvaluate(true)
  }

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp)
    setScores({})
    setComment('')
    const existing = existingEvals.find(e => e.employee_id === emp.id)
    if (existing) {
      setScores(existing.scores || {})
      setComment(existing.comment || '')
    }
  }

  const getTemplate = (emp) => templates.find(t => t.template_type === emp?.template_type)

  const calcTotalScore = (emp) => {
    const template = getTemplate(emp)
    if (!template?.criteria_data) return 0
    let total = 0
    template.criteria_data.forEach(group => {
      const groupScores = group.items.map(item => Number(scores[item.name] || 0))
      const groupSum = groupScores.reduce((a, b) => a + b, 0)
      const groupMax = group.items.reduce((a, b) => a + b.max_score, 0)
      total += (groupSum / groupMax) * group.weight
    })
    return Math.round(total * 10) / 10
  }

  const handleSubmitEval = async () => {
    if (!selectedEmployee || !selectedCycle) return
    setSubmitting(true)
    const totalScore = calcTotalScore(selectedEmployee)
    const ranking = RANKING(totalScore)
    const userId = (await supabase.auth.getUser()).data.user?.id
    const existing = existingEvals.find(e => e.employee_id === selectedEmployee.id)

    if (existing) {
      await supabase.from('evaluations').update({
        scores, total_score: totalScore, ranking: ranking.label,
        comment, status: 'submitted', submitted_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('evaluations').insert([{
        cycle_id: selectedCycle.id,
        employee_id: selectedEmployee.id,
        evaluator_id: userId,
        scores, total_score: totalScore, ranking: ranking.label,
        comment, status: 'submitted', submitted_at: new Date().toISOString(),
      }])
    }

    // Reload evals
    const { data: evals } = await supabase.from('evaluations').select('*').eq('cycle_id', selectedCycle.id)
    setExistingEvals(evals || [])
    setSelectedEmployee(null)
    setSubmitting(false)
  }

  // Lọc NV theo role
  const visibleEmployees = cycleEmployees.filter(emp => {
    if (role === 'board_manager') return true
    if (role === 'hr') return true
    if (role === 'manager') return !emp.is_leader
    return false
  })

  const canCreate = role === 'board_manager' || role === 'hr'

  // Build dept tree cho form
  const buildDeptOptions = (depts, parentId = null, level = 0) => {
    return depts
      .filter(d => d.parent_id === parentId)
      .flatMap(d => [
        { ...d, level },
        ...buildDeptOptions(depts, d.id, level + 1)
      ])
  }
  const flatDepts = buildDeptOptions(departments)

  return (
    <div>
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

            {/* Chọn bộ phận */}
            <div style={styles.deptSection}>
              <p style={styles.deptTitle}>📋 Chọn bộ phận & loại đánh giá</p>
              <p style={styles.deptSub}>⚠️ Leader sẽ tự động được đánh giá theo loại <strong>Quản lý</strong> bởi Board Manager</p>
              <div style={styles.deptList}>
                {flatDepts.map(dept => {
                  const assigned = deptAssignments.find(d => d.dept_id === dept.id)
                  const leader = findLeader(dept.id)
                  return (
                    <div key={dept.id} style={{ ...styles.deptItem, ...(assigned ? styles.deptItemActive : {}), paddingLeft: 12 + dept.level * 16 }}>
                      <div style={styles.deptItemLeft}>
                        <input
  type="checkbox"
  checked={!!assigned}
  ref={el => {
    if (el) {
      // Trạng thái partial: có một số con được tick
      const descendantIds = (() => {
        const getIds = (id) => {
          const children = departments.filter(d => d.parent_id === id)
          return [...children.map(c => c.id), ...children.flatMap(c => getIds(c.id))]
        }
        return getIds(dept.id)
      })()
      const hasDescendants = descendantIds.length > 0
      const someChecked = hasDescendants && descendantIds.some(id => deptAssignments.some(d => d.dept_id === id))
      const allChecked = hasDescendants && descendantIds.every(id => deptAssignments.some(d => d.dept_id === id))
      el.indeterminate = someChecked && !allChecked && !assigned
    }
  }}
  onChange={() => toggleDept(dept.id)}
/>
                        <span style={{ fontSize: dept.level === 0 ? 14 : dept.level === 1 ? 13 : 12, fontWeight: dept.level === 0 ? 700 : dept.level === 1 ? 600 : 400, color: '#111827' }}>
                          {dept.level > 0 ? '└ ' : ''}{dept.name}
                        </span>
                        {leader && (
                          <span style={styles.leaderTag}>
                            👑 {leader.employees?.full_name}
                          </span>
                        )}
                      </div>
                      {assigned && (
                        <select style={styles.templateSelect} value={assigned.template_type}
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

            {/* Preview số NV */}
            {deptAssignments.length > 0 && (
              <div style={styles.previewBox}>
                <p style={styles.previewTitle}>👥 Tổng quan kỳ đánh giá:</p>
                {deptAssignments.map(d => {
                  const dept = departments.find(dep => dep.id === d.dept_id)
                  const empCount = employees.filter(e => e.department_id === d.dept_id).length
                  const leader = findLeader(d.dept_id)
                  return (
                    <div key={d.dept_id} style={styles.previewItem}>
                      <span style={styles.previewDept}>{dept?.name}</span>
                      <span style={styles.previewMeta}>{empCount} NV · {TEMPLATE_LABELS[d.template_type]}</span>
                      <span style={styles.previewLeader}>
                        {leader ? `👑 ${leader.employees?.full_name}` : '⚠️ Chưa có leader'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

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
                  <span style={styles.infoLabel}>Bộ phận</span>
                  <span style={styles.infoValue}>{cycle.scope?.dept_assignments?.length || 0} bộ phận</span>
                </div>
              </div>
              <div style={styles.cardFooter}>
                {cycle.status === 'open' && (
                  <button style={styles.evalBtn} onClick={() => handleOpenEvaluate(cycle)}>
                    📝 Điền đánh giá
                  </button>
                )}
                <button style={styles.viewBtn} onClick={() => setSelected(cycle)}>Chi tiết →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal điền điểm */}
      {showEvaluate && selectedCycle && (
        <div style={styles.overlay} onClick={() => { setShowEvaluate(false); setSelectedEmployee(null) }}>
          <div style={{ ...styles.modal, width: selectedEmployee ? 760 : 480 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>📝 {selectedCycle.title}</h2>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {selectedEmployee ? `Đang đánh giá: ${selectedEmployee.full_name}` : 'Chọn nhân viên để bắt đầu'}
                </p>
              </div>
              <button style={styles.closeBtn} onClick={() => { setShowEvaluate(false); setSelectedEmployee(null) }}>✕</button>
            </div>

            <div style={{ display: 'flex', maxHeight: '70vh', overflow: 'hidden' }}>
              {/* Danh sách NV */}
              <div style={styles.empList}>
                {/* Leader */}
                {visibleEmployees.filter(e => e.is_leader).length > 0 && role === 'board_manager' && (
                  <>
                    <p style={styles.groupLabel}>👔 Trưởng bộ phận</p>
                    {visibleEmployees.filter(e => e.is_leader).map(emp => {
                      const evalDone = existingEvals.find(ev => ev.employee_id === emp.id)
                      return (
                        <div key={emp.id}
                          style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}) }}
                          onClick={() => handleSelectEmployee(emp)}>
                          <div style={{ ...styles.empAvatar, background: '#7c3aed' }}>{emp.full_name?.[0]}</div>
                          <div>
                            <div style={styles.empName}>{emp.full_name}</div>
                            <div style={styles.empMeta}>👔 QL {evalDone ? '✅' : ''}</div>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ borderTop: '1px solid #f3f4f6', margin: '8px 0' }} />
                  </>
                )}

                {/* NV thường */}
                <p style={styles.groupLabel}>👥 Nhân viên</p>
                {visibleEmployees.filter(e => !e.is_leader).map(emp => {
                  const evalDone = existingEvals.find(ev => ev.employee_id === emp.id)
                  return (
                    <div key={emp.id}
                      style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}) }}
                      onClick={() => handleSelectEmployee(emp)}>
                      <div style={styles.empAvatar}>{emp.full_name?.[0]}</div>
                      <div>
                        <div style={styles.empName}>{emp.full_name}</div>
                        <div style={styles.empMeta}>
                          {TEMPLATE_LABELS[emp.template_type]} {evalDone ? '✅' : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {visibleEmployees.length === 0 && (
                  <p style={{ fontSize: 12, color: '#9ca3af', padding: 8 }}>Không có nhân viên</p>
                )}
              </div>

              {/* Form điền điểm */}
              {selectedEmployee && (
                <div style={styles.scoreForm}>
                  {/* Header NV */}
                  <div style={styles.scoreHeader}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{selectedEmployee.full_name}</strong>
                      <span style={{ ...styles.templateBadge, marginLeft: 8 }}>
                        {TEMPLATE_LABELS[selectedEmployee.template_type]}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Người đánh giá: {selectedEmployee.is_leader ? 'Board Manager' : selectedEmployee.evaluator}
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, paddingRight: 8 }}>
                    {(getTemplate(selectedEmployee)?.criteria_data || []).map((group, gi) => (
                      <div key={gi} style={styles.criteriaGroup}>
                        <div style={styles.groupHeader}>
                          <span style={styles.groupName}>{group.group}</span>
                          <span style={styles.groupWeight}>Trọng số: {group.weight}% · Tổng: {group.total_score} điểm</span>
                        </div>
                        {group.items.map((item, ii) => (
                          <div key={ii} style={styles.criteriaRow}>
                            <div style={styles.criteriaInfo}>
                              <span style={styles.criteriaName}>{item.name}</span>
                              <span style={styles.criteriaDesc}>{item.description}</span>
                            </div>
                            <div style={styles.scoreInput}>
                              <input
                                type="number" min="0" max={item.max_score}
                                style={{
                                  ...styles.scoreField,
                                  borderColor: scores[item.name] > item.max_score ? '#dc2626' : '#d1d5db',
                                }}
                                placeholder="0"
                                value={scores[item.name] || ''}
                                onChange={e => setScores({ ...scores, [item.name]: Math.min(Number(e.target.value), item.max_score) })}
                              />
                              <span style={styles.scoreMax}>/{item.max_score}</span>
                            </div>
                          </div>
                        ))}
                        {/* Tổng nhóm */}
                        <div style={styles.groupTotal}>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Tổng nhóm:</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                            {group.items.reduce((sum, item) => sum + (Number(scores[item.name]) || 0), 0)} / {group.total_score}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Tổng điểm */}
                    {Object.keys(scores).length > 0 && (
                      <div style={styles.totalBox}>
                        <div style={styles.totalScore}>
                          <span style={{ fontSize: 14, color: '#374151' }}>Tổng điểm quy đổi:</span>
                          <span style={{ fontSize: 28, fontWeight: 700, color: '#1a56db' }}>
                            {calcTotalScore(selectedEmployee)}
                          </span>
                          <span style={{ fontSize: 13, color: '#6b7280' }}>/100</span>
                        </div>
                        <div style={{
                          ...styles.rankBadge,
                          background: RANKING(calcTotalScore(selectedEmployee)).color + '15',
                          color: RANKING(calcTotalScore(selectedEmployee)).color,
                        }}>
                          {RANKING(calcTotalScore(selectedEmployee)).label}
                        </div>
                      </div>
                    )}

                    {/* Nhận xét */}
                    <div style={styles.commentBox}>
                      <label style={styles.label}>Nhận xét tổng quan</label>
                      <textarea style={styles.textarea} placeholder="Nhận xét về nhân viên..."
                        value={comment} onChange={e => setComment(e.target.value)} rows={3} />
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
                  ['Số bộ phận', `${selected.scope?.dept_assignments?.length || 0} bộ phận`],
                  ['Ngày tạo', new Date(selected.created_at).toLocaleDateString('vi-VN')],
                ].map(([label, value]) => (
                  <div key={label} style={styles.infoItem}>
                    <span style={styles.infoLabel}>{label}</span>
                    <span style={styles.infoValue}>{value || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Bộ phận trong kỳ */}
              {selected.scope?.dept_assignments?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Bộ phận tham gia:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selected.scope.dept_assignments.map(d => {
                      const dept = departments.find(dep => dep.id === d.dept_id)
                      const leader = findLeader(d.dept_id)
                      return (
                        <div key={d.dept_id} style={styles.deptChip}>
                          <span>{dept?.name || '—'}</span>
                          <span style={{ color: '#6b7280' }}>· {TEMPLATE_LABELS[d.template_type]}</span>
                          {leader && <span style={{ color: '#1a56db' }}>· 👑 {leader.employees?.full_name}</span>}
                        </div>
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
                          fetchAll(); setSelected(null)
                        }}>Đóng kỳ</button>
                      )}
                    </>
                  )}
                  {selected.status === 'closed' && role === 'board_manager' && (
                    <button style={styles.primaryBtn} onClick={async () => {
                      await supabase.from('evaluation_cycles').update({ status: 'approved' }).eq('id', selected.id)
                      fetchAll(); setSelected(null)
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
  deptList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' },
  deptItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff' },
  deptItemActive: { border: '1px solid #bfdbfe', background: '#eff6ff' },
  deptItemLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  leaderTag: { fontSize: 11, color: '#d97706', background: '#fffbeb', padding: '1px 6px', borderRadius: 10 },
  templateSelect: { padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' },
  previewBox: { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 14, marginBottom: 16 },
  previewTitle: { fontSize: 13, fontWeight: 600, color: '#16a34a', marginBottom: 8 },
  previewItem: { display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, marginBottom: 4 },
  previewDept: { fontWeight: 600, color: '#111827', minWidth: 120 },
  previewMeta: { color: '#6b7280' },
  previewLeader: { color: '#d97706', fontSize: 12 },
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
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  modalBody: { padding: 24, overflowY: 'auto' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  infoItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  deptChip: { display: 'flex', gap: 6, fontSize: 12, padding: '4px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e5e7eb' },
  actionRow: { display: 'flex', gap: 12 },
  primaryBtn: { padding: '10px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  warningBtn: { padding: '10px 20px', background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  empList: { width: 200, borderRight: '1px solid #f3f4f6', padding: '12px 8px', overflowY: 'auto', flexShrink: 0 },
  groupLabel: { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 },
  empItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 3 },
  empItemActive: { background: '#eff6ff' },
  empAvatar: { width: 28, height: 28, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 },
  empName: { fontSize: 12, fontWeight: 600, color: '#111827' },
  empMeta: { fontSize: 10, color: '#6b7280' },
  scoreForm: { flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 },
  scoreHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  templateBadge: { fontSize: 11, background: '#eff6ff', color: '#1a56db', padding: '2px 7px', borderRadius: 10 },
  criteriaGroup: { marginBottom: 14 },
  groupHeader: { display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '7px 10px', borderRadius: 6, marginBottom: 6 },
  groupName: { fontSize: 12, fontWeight: 700, color: '#111827' },
  groupWeight: { fontSize: 11, color: '#6b7280' },
  criteriaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 4px', borderBottom: '1px solid #f9fafb' },
  criteriaInfo: { flex: 1, marginRight: 10 },
  criteriaName: { fontSize: 12, fontWeight: 500, color: '#374151', display: 'block' },
  criteriaDesc: { fontSize: 10, color: '#9ca3af', display: 'block', marginTop: 1 },
  scoreInput: { display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 },
  scoreField: { width: 50, padding: '3px 6px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'center', outline: 'none' },
  scoreMax: { fontSize: 11, color: '#6b7280' },
  groupTotal: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '4px 4px 0', alignItems: 'center' },
  totalBox: { background: '#f0f9ff', borderRadius: 8, padding: '12px 16px', margin: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  totalScore: { display: 'flex', alignItems: 'baseline', gap: 6 },
  rankBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  commentBox: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 },
  textarea: { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', resize: 'vertical' },
  scoreActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6', flexShrink: 0 },
}