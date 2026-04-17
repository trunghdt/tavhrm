import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const STATUS_LABELS = { draft: 'Nháp', open: 'Đang mở', closed: 'Đã đóng', approved: 'Đã duyệt' }
const STATUS_COLORS = { draft: '#6b7280', open: '#16a34a', closed: '#d97706', approved: '#1a56db' }
const EVAL_STATUS = {
  draft: { label: '💾 Đã lưu nháp', color: '#7c3aed' },
  submitted: { label: '🟡 TBP đã submit', color: '#d97706' },
  hr_reviewed: { label: '🔵 HR đã review', color: '#1a56db' },
  approved: { label: '✅ Đã duyệt', color: '#16a34a' },
}
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
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', period: '', deadline: '' })
  const [deptAssignments, setDeptAssignments] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showEvaluate, setShowEvaluate] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [cycleEmployees, setCycleEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [scores, setScores] = useState({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [existingEvals, setExistingEvals] = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [selected, setSelected] = useState(null)
  const [myDeptIds, setMyDeptIds] = useState([]) // BP mà TBP hiện tại quản lý

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

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

    // Xác định BP mà TBP hiện tại là leader
    if (role === 'manager') {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: myEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (myEmp) {
        const myRoles = (rolesData || []).filter(r => r.employee_id === myEmp.id && r.role_type === 'leader')
        const myDirectDeptIds = myRoles.map(r => r.department_id)
        // Thêm cả các BP con bên dưới
        const getDescendantIds = (depts, parentId) => {
          const children = depts.filter(d => d.parent_id === parentId)
          return [...children.map(c => c.id), ...children.flatMap(c => getDescendantIds(depts, c.id))]
        }


// Lấy tất cả dept con
const allDescendants = myDirectDeptIds.flatMap(id => getDescendantIds(deptsData || [], id))

// Loại bỏ các dept con đã có leader riêng (không phải mình)
const deptIdsWithOtherLeader = (rolesData || [])
  .filter(r =>
    r.role_type === 'leader' &&
    r.employee_id !== myEmp.id &&
    allDescendants.includes(r.department_id)
  )
  .map(r => r.department_id)

// Loại bỏ luôn tất cả con cháu của dept đã có leader riêng
const deptIdsToExclude = [
  ...deptIdsWithOtherLeader,
  ...deptIdsWithOtherLeader.flatMap(id => getDescendantIds(deptsData || [], id))
]

const allMyDeptIds = [
  ...myDirectDeptIds,
  ...allDescendants.filter(id => !deptIdsToExclude.includes(id))
]
setMyDeptIds(allMyDeptIds)
      }
    }

    setLoading(false)
  }

const resolveDeptLevels = (deptId) => {
  const chain = []
  let current = departments.find(d => d.id === deptId)
  while (current) {
    chain.unshift(current)
    current = current.parent_id ? departments.find(d => d.id === current.parent_id) : null
  }
  // chain[0] = Chi nhánh, chain[1] = Bộ phận, chain[2] = Tổ
  return {
    branch: chain[0]?.name || '—',
    department: chain[1]?.name || '—',
    team: chain[2]?.name || '—',
  }
}
  const findLeader = (deptId) => {
    const leader = departmentRoles.find(r => r.department_id === deptId && r.role_type === 'leader')
    if (leader) return leader
    const dept = departments.find(d => d.id === deptId)
    if (dept?.parent_id) return findLeader(dept.parent_id)
    return null
  }

  const toggleDept = (deptId) => {
    const getDescendantIds = (id) => {
      const children = departments.filter(d => d.parent_id === id)
      return [...children.map(c => c.id), ...children.flatMap(c => getDescendantIds(c.id))]
    }
    const allIds = [deptId, ...getDescendantIds(deptId)]
    setDeptAssignments(prev => {
      const isChecked = prev.some(d => d.dept_id === deptId)
      if (isChecked) return prev.filter(d => !allIds.includes(d.dept_id))
      const newIds = allIds.filter(id => !prev.some(d => d.dept_id === id))
      return [...prev, ...newIds.map(id => ({ dept_id: id, template_type: 'sx' }))]
    })
  }

  const setDeptTemplate = (deptId, type) => {
    setDeptAssignments(prev => prev.map(d => d.dept_id === deptId ? { ...d, template_type: type } : d))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (deptAssignments.length === 0) { setError('Chọn ít nhất 1 bộ phận!'); return }
    setCreating(true)
    setError('')
    const { error: err } = await supabase.from('evaluation_cycles').insert([{
      title: form.title, period: form.period, deadline: form.deadline,
      status: 'open', scope: { dept_assignments: deptAssignments },
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }])
    if (err) { setError(err.message); setCreating(false); return }
    setShowForm(false)
    setForm({ title: '', period: '', deadline: '' })
    setDeptAssignments([])
    fetchAll()
    setCreating(false)
  }

  const handleOpenEvaluate = async (cycle) => {
    setSelectedCycle(cycle)
    const deptIds = (cycle.scope?.dept_assignments || []).map(d => d.dept_id)
    const { data: emps } = await supabase
      .from('employees').select('*, departments(name)')
      .in('department_id', deptIds).eq('status', 'active')
    const { data: evals } = await supabase
      .from('evaluations').select('*').eq('cycle_id', cycle.id)
    setExistingEvals(evals || [])
    const deptAssign = cycle.scope?.dept_assignments || []
    const result = (emps || []).map(emp => {
      const isLeader = departmentRoles.some(r => r.employee_id === emp.id && r.role_type === 'leader')
      const deptInfo = deptAssign.find(d => d.dept_id === emp.department_id)
      const leader = findLeader(emp.department_id)
      return {
        ...emp,
        template_type: isLeader ? 'ql' : (deptInfo?.template_type || 'sx'),
        is_leader: isLeader,
        evaluator: isLeader ? 'Board Manager' : (leader?.employees?.full_name || 'Chưa có leader'),
      }
    })
    result.sort((a, b) => (a.is_leader ? -1 : b.is_leader ? 1 : 0))
    setCycleEmployees(result)
    setShowEvaluate(true)
    setShowSummary(false)
  }

  const getTemplate = (emp) => templates.find(t => t.template_type === emp?.template_type)

  const calcTotalScore = (scoreData, emp) => {
    const template = getTemplate(emp)
    if (!template?.criteria_data) return 0
    let total = 0
    template.criteria_data.forEach(group => {
      const groupSum = group.items.reduce((s, item) => s + (Number(scoreData[item.name]) || 0), 0)
      const groupMax = group.items.reduce((s, item) => s + item.max_score, 0)
      total += (groupSum / groupMax) * group.weight
    })
    return Math.round(total * 10) / 10
  }

  const handleSelectEmployee = (emp) => {
    const existingEval = existingEvals.find(e => e.employee_id === emp.id)
    if (role === 'manager') {
      if (emp.is_leader) return
      if (['submitted', 'hr_reviewed', 'approved'].includes(existingEval?.status)) {
        alert('Đánh giá đã được submit và khóa lại!')
        return
      }
    }
    if (role === 'hr') {
      if (!existingEval || existingEval.status === 'draft') {
        alert('Trưởng bộ phận chưa submit đánh giá nhân viên này!')
        return
      }
      if (['hr_reviewed', 'approved'].includes(existingEval?.status)) {
        alert('Bạn đã review đánh giá này rồi!')
        return
      }
    }
    if (role === 'board_manager' && !emp.is_leader) {
      if (!existingEval || existingEval.status !== 'hr_reviewed') {
        alert('HR chưa review đánh giá của nhân viên này!')
        return
      }
    }
    setSelectedEmployee(emp)
    setScores(existingEval?.scores || {})
    setComment(existingEval?.comment || '')
  }

  const handleSaveEval = async () => {
  if (!selectedEmployee || !selectedCycle) return
  setSubmitting(true)
  const totalScore = calcTotalScore(scores, selectedEmployee)
  const ranking = RANKING(totalScore)
  const userId = (await supabase.auth.getUser()).data.user?.id
  const existing = existingEvals.find(e => e.employee_id === selectedEmployee.id)

  let payload = {}

  if (role === 'manager') {
    // TBP lưu nháp → status: draft
    payload = {
      scores,
      total_score: totalScore,
      ranking: ranking.label,
      comment,
      status: 'draft',
      original_scores: scores,
      original_comment: comment,
      evaluator_id: userId,
    }
  } else if (role === 'hr') {
    // HR lưu → giữ nguyên status hiện tại (submitted), chỉ lưu hr_scores
    payload = {
      hr_scores: scores,
      hr_comment: comment,
      total_score: totalScore,
      ranking: ranking.label,
      hr_reviewed_by: userId,
      hr_reviewed_at: new Date().toISOString(),
      status: existing?.status || 'submitted', // Giữ nguyên status
    }
  } else if (role === 'board_manager') {
    if (selectedEmployee.is_leader) {
      // BLĐ đánh giá TBP → status: submitted (để sau approve)
      payload = {
        scores,
        total_score: totalScore,
        ranking: ranking.label,
        comment,
        status: 'hr_reviewed',
        original_scores: scores,
        original_comment: comment,
        evaluator_id: userId,
      }
    } else {
      // BLĐ sửa điểm NV thường → giữ nguyên hr_reviewed
      payload = {
        scores,
        total_score: totalScore,
        ranking: ranking.label,
        comment,
        status: 'hr_reviewed', // Giữ nguyên để BLĐ có thể approve
        evaluator_id: userId,
      }
    }
  }

  if (existing) {
    await supabase.from('evaluations').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('evaluations').insert([{
      cycle_id: selectedCycle.id,
      employee_id: selectedEmployee.id,
      ...payload,
    }])
  }

  const { data: evals } = await supabase.from('evaluations').select('*').eq('cycle_id', selectedCycle.id)
  setExistingEvals(evals || [])
  setSelectedEmployee(null)
  setSubmitting(false)
}

const handleSubmitAll = async () => {
  if (!confirm('Xác nhận submit toàn bộ đánh giá?')) return
  const userId = (await supabase.auth.getUser()).data.user?.id

  if (role === 'manager') {
    const draftEvals = existingEvals.filter(e => e.status === 'draft')
    if (draftEvals.length === 0) {
      alert('Không có đánh giá nào ở trạng thái đã lưu nháp!')
      return
    }
    for (const ev of draftEvals) {
      await supabase.from('evaluations')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', ev.id)
    }
    alert(`Đã submit ${draftEvals.length} đánh giá lên HR!`)

  } else if (role === 'hr') {
    const toSubmit = existingEvals.filter(e => e.status === 'submitted')
    if (toSubmit.length === 0) {
      alert('Không có đánh giá nào ở trạng thái TBP đã submit!')
      return
    }
    for (const ev of toSubmit) {
      await supabase.from('evaluations')
        .update({
          status: 'hr_reviewed',
          hr_reviewed_by: userId,
          hr_reviewed_at: new Date().toISOString(),
        })
        .eq('id', ev.id)
    }
    alert(`Đã submit ${toSubmit.length} đánh giá lên Ban lãnh đạo!`)

  } else if (role === 'board_manager') {
    const toApprove = existingEvals.filter(e => e.status === 'hr_reviewed')
    if (toApprove.length === 0) {
      alert('Không có đánh giá nào ở trạng thái HR đã review!')
      return
    }
    for (const ev of toApprove) {
      await supabase.from('evaluations')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', ev.id)
    }
    alert(`Đã phê duyệt ${toApprove.length} đánh giá!`)
  }

  const { data: evals } = await supabase
    .from('evaluations').select('*').eq('cycle_id', selectedCycle.id)
  setExistingEvals(evals || [])
}

  const handleApprove = async (empId) => {
    const ev = existingEvals.find(e => e.employee_id === empId)
    if (!ev) return
    const userId = (await supabase.auth.getUser()).data.user?.id
    await supabase.from('evaluations').update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    }).eq('id', ev.id)
    const { data: evals } = await supabase.from('evaluations').select('*').eq('cycle_id', selectedCycle.id)
    setExistingEvals(evals || [])
  }

const visibleEmployees = cycleEmployees.filter(emp => {
    if (role === 'board_manager') return true
    if (role === 'hr') return !emp.is_leader
    if (role === 'manager') return !emp.is_leader && myDeptIds.includes(emp.department_id)
    return false
  })

  const canCreate = role === 'board_manager' || role === 'hr'

  const buildDeptOptions = (depts, parentId = null, level = 0) => {
    return depts.filter(d => d.parent_id === parentId).flatMap(d => [
      { ...d, level },
      ...buildDeptOptions(depts, d.id, level + 1)
    ])
  }
  const flatDepts = buildDeptOptions(departments)

  const SummaryView = () => {
const nonLeaders = visibleEmployees.filter(e => !e.is_leader)
const leaders = visibleEmployees.filter(e => e.is_leader)

    const showGroup = (group, title) => (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>{title}</h3>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Nhân viên</th>
              <th style={styles.th}>Chi nhánh</th>
              <th style={styles.th}>Bộ phận</th>
              <th style={styles.th}>Tổ</th>
              <th style={styles.th}>Loại ĐG</th>
              <th style={styles.th}>Điểm TBP</th>
              {(role === 'hr' || role === 'board_manager') && <th style={styles.th}>Điểm HR</th>}
              <th style={styles.th}>Tổng điểm</th>
              <th style={styles.th}>Xếp loại</th>
              <th style={styles.th}>Trạng thái</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {group.map(emp => {
              const ev = existingEvals.find(e => e.employee_id === emp.id)
              const tbpScore = ev?.original_scores || ev?.scores
              const hrScore = ev?.hr_scores
              const finalScore = ev?.total_score
              const evalStatus = ev?.status || 'draft'
              const rankInfo = finalScore ? RANKING(finalScore) : null
              const hasHrEdit = !!ev?.hr_scores
              const canEdit =
                (role === 'manager' && ev && evalStatus === 'draft') ||
                (role === 'hr' && ev && evalStatus === 'submitted') ||
                (role === 'board_manager' && ev && evalStatus === 'hr_reviewed')
              return (
                <tr key={emp.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ ...styles.empAvatar, width: 28, height: 28, fontSize: 11 }}>{emp.full_name?.[0]}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{emp.full_name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{emp.employee_code}</div>
                      </div>
                    </div>
                  </td>
                  {(() => { const lvl = resolveDeptLevels(emp.department_id); return (
  <>
    <td style={styles.td}><span style={{ fontSize: 12 }}>{lvl.branch}</span></td>
    <td style={styles.td}><span style={{ fontSize: 12 }}>{lvl.department}</span></td>
    <td style={styles.td}><span style={{ fontSize: 12 }}>{lvl.team}</span></td>
  </>
) })()}
                  <td style={styles.td}><span style={{ fontSize: 11 }}>{TEMPLATE_LABELS[emp.template_type]}</span></td>
                  <td style={styles.td}>
                    {tbpScore ? <span style={{ fontSize: 13 }}>{calcTotalScore(tbpScore, emp)} đ</span>
                      : <span style={{ color: '#9ca3af', fontSize: 12 }}>Chưa đánh giá</span>}
                  </td>
                  {(role === 'hr' || role === 'board_manager') && (
                    <td style={styles.td}>
                      {hasHrEdit ? <span style={{ fontSize: 13, color: '#1a56db' }}>{calcTotalScore(hrScore, emp)} đ ✏️</span>
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                    </td>
                  )}
                  <td style={styles.td}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{finalScore || '—'}</span>
                  </td>
                  <td style={styles.td}>
                    {rankInfo ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: rankInfo.color + '15', color: rankInfo.color, fontWeight: 600 }}>{rankInfo.label}</span> : '—'}
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 11, color: ev ? EVAL_STATUS[evalStatus]?.color : '#9ca3af' }}>
                      {ev ? EVAL_STATUS[evalStatus]?.label : '⬜ Chưa đánh giá'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canEdit && (
                        <button style={styles.smallBtn} onClick={() => { setShowSummary(false); handleSelectEmployee(emp) }}>
                          ✏️ {role === 'hr' ? 'Review' : 'Sửa'}
                        </button>
                      )}
                      {role === 'board_manager' && evalStatus === 'hr_reviewed' && (
                        <button style={{ ...styles.smallBtn, background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}
                          onClick={() => handleApprove(emp.id)}>✅ Duyệt</button>
                      )}
                      {evalStatus === 'approved' && <span style={{ fontSize: 11, color: '#16a34a' }}>✅ Hoàn thành</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )

    return (
      <div style={styles.overlay} onClick={() => setShowSummary(false)}>
        <div style={{ ...styles.modal, width: 900, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <div>
              <h2 style={styles.modalTitle}>📊 Bảng tổng hợp đánh giá</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{selectedCycle?.title}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {role === 'manager' && (
                <button style={{ ...styles.submitBtn, fontSize: 13 }} onClick={handleSubmitAll}>✅ Submit lên HR</button>
              )}
              {role === 'hr' && (
                <button style={{ ...styles.submitBtn, fontSize: 13 }} onClick={handleSubmitAll}>🔵 HR Submit lên BLĐ</button>
              )}
              {role === 'board_manager' && (
                <button style={{ ...styles.submitBtn, fontSize: 13, background: '#16a34a' }} onClick={handleSubmitAll}>✅ Duyệt tất cả</button>
              )}
              <button style={styles.closeBtn} onClick={() => setShowSummary(false)}>✕</button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: 24 }}>
            {role === 'board_manager' && leaders.length > 0 && showGroup(leaders, '👔 Trưởng bộ phận')}
            {showGroup(nonLeaders, '👥 Nhân viên')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={styles.headerRow}>
        {canCreate && (
          <button style={styles.addBtn} onClick={() => { setShowForm(true); setError('') }}>+ Tạo kỳ đánh giá</button>
        )}
      </div>

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
            <div style={styles.deptSection}>
              <p style={styles.deptTitle}>📋 Chọn bộ phận & loại đánh giá</p>
              <p style={styles.deptSub}>⚠️ Leader tự động được xếp nhóm <strong>Quản lý</strong> do Board Manager đánh giá</p>
              <div style={styles.deptList}>
                {flatDepts.map(dept => {
                  const assigned = deptAssignments.find(d => d.dept_id === dept.id)
                  const leader = findLeader(dept.id)
                  const descendantIds = (() => {
                    const getIds = (id) => {
                      const children = departments.filter(d => d.parent_id === id)
                      return [...children.map(c => c.id), ...children.flatMap(c => getIds(c.id))]
                    }
                    return getIds(dept.id)
                  })()
                  const someChecked = descendantIds.some(id => deptAssignments.some(d => d.dept_id === id))
                  const allChecked = descendantIds.length > 0 && descendantIds.every(id => deptAssignments.some(d => d.dept_id === id))
                  return (
                    <div key={dept.id} style={{ ...styles.deptItem, ...(assigned ? styles.deptItemActive : {}), paddingLeft: 12 + dept.level * 16 }}>
                      <div style={styles.deptItemLeft}>
                        <input type="checkbox" checked={!!assigned}
                          ref={el => { if (el) el.indeterminate = someChecked && !allChecked && !assigned }}
                          onChange={() => toggleDept(dept.id)} />
                        <span style={{ fontSize: dept.level === 0 ? 14 : 13, fontWeight: dept.level < 2 ? 600 : 400 }}>
                          {dept.level > 0 ? '└ ' : ''}{dept.name}
                        </span>
                        {leader && <span style={styles.leaderTag}>👑 {leader.employees?.full_name}</span>}
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
            {deptAssignments.length > 0 && (
              <div style={styles.previewBox}>
                <p style={styles.previewTitle}>👥 Tổng quan:</p>
                {deptAssignments.map(d => {
                  const dept = departments.find(dep => dep.id === d.dept_id)
                  const empCount = employees.filter(e => e.department_id === d.dept_id).length
                  const leader = findLeader(d.dept_id)
                  return (
                    <div key={d.dept_id} style={styles.previewItem}>
                      <span style={styles.previewDept}>{dept?.name}</span>
                      <span style={styles.previewMeta}>{empCount} NV · {TEMPLATE_LABELS[d.template_type]}</span>
                      <span style={styles.previewLeader}>{leader ? `👑 ${leader.employees?.full_name}` : '⚠️ Chưa có leader'}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {error && <p style={styles.error}>{error}</p>}
            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowForm(false); setDeptAssignments([]) }}>Hủy</button>
              <button type="submit" style={styles.submitBtn} disabled={creating}>{creating ? 'Đang tạo...' : 'Tạo kỳ đánh giá'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: '#6b7280' }}>Đang tải...</p>
        : cycles.length === 0 ? (
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
                  <div style={styles.infoRow}><span style={styles.infoLabel}>Kỳ</span><span style={styles.infoValue}>{cycle.period || '—'}</span></div>
                  <div style={styles.infoRow}><span style={styles.infoLabel}>Deadline</span><span style={styles.infoValue}>{cycle.deadline ? new Date(cycle.deadline).toLocaleDateString('vi-VN') : '—'}</span></div>
                  <div style={styles.infoRow}><span style={styles.infoLabel}>Bộ phận</span><span style={styles.infoValue}>{cycle.scope?.dept_assignments?.length || 0} bộ phận</span></div>
                </div>
<div style={styles.cardFooter}>
  {cycle.status === 'open' && (
    <>
      <button style={styles.evalBtn} onClick={() => handleOpenEvaluate(cycle)}>📝 Đánh giá</button>
    </>
  )}
  {/* Nút tổng hợp hiện với tất cả trạng thái */}
  <button style={{ ...styles.evalBtn, background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc' }}
    onClick={async () => { await handleOpenEvaluate(cycle); setShowSummary(true) }}>
    📊 Tổng hợp
  </button>
  <button style={styles.viewBtn} onClick={() => setSelected(cycle)}>Chi tiết →</button>
  {role === 'board_manager' && (
    <button style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, cursor: 'pointer', padding: 0 }}
      onClick={async () => {
        if (!confirm(`Xóa kỳ đánh giá "${cycle.title}"?\nTất cả dữ liệu đánh giá liên quan sẽ bị xóa!`)) return
        await supabase.from('evaluations').delete().eq('cycle_id', cycle.id)
        await supabase.from('evaluation_cycles').delete().eq('id', cycle.id)
        fetchAll()
      }}>🗑️ Xóa</button>
  )}
</div>
              </div>
            ))}
          </div>
        )}

      {showEvaluate && selectedCycle && !showSummary && (
        <div style={styles.overlay} onClick={() => { setShowEvaluate(false); setSelectedEmployee(null) }}>
          <div style={{ ...styles.modal, width: selectedEmployee ? 760 : 480 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>📝 {selectedCycle.title}</h2>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {role === 'manager' ? 'Trưởng bộ phận điền điểm' : role === 'hr' ? 'HR review đánh giá' : 'Board Manager đánh giá'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...styles.evalBtn, fontSize: 12 }} onClick={() => setShowSummary(true)}>📊 Tổng hợp</button>
                <button style={styles.closeBtn} onClick={() => { setShowEvaluate(false); setSelectedEmployee(null) }}>✕</button>
              </div>
            </div>
            <div style={{ display: 'flex', maxHeight: '70vh', overflow: 'hidden' }}>
              <div style={styles.empList}>
                {role === 'board_manager' && cycleEmployees.filter(e => e.is_leader).length > 0 && (
                  <>
                    <p style={styles.groupLabel}>👔 Trưởng bộ phận</p>
                    {cycleEmployees.filter(e => e.is_leader).map(emp => {
                      const ev = existingEvals.find(e => e.employee_id === emp.id)
                      return (
                        <div key={emp.id} style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}) }}
                          onClick={() => handleSelectEmployee(emp)}>
                          <div style={{ ...styles.empAvatar, background: '#7c3aed' }}>{emp.full_name?.[0]}</div>
                          <div>
                            <div style={styles.empName}>{emp.full_name}</div>
                            <div style={styles.empMeta}>{ev ? EVAL_STATUS[ev.status]?.label : '⬜ Chưa đánh giá'}</div>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ borderTop: '1px solid #f3f4f6', margin: '8px 0' }} />
                  </>
                )}
                <p style={styles.groupLabel}>👥 Nhân viên</p>
                {visibleEmployees.filter(e => !e.is_leader).map(emp => {
                  const ev = existingEvals.find(e => e.employee_id === emp.id)
                  return (
                    <div key={emp.id} style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}) }}
                      onClick={() => handleSelectEmployee(emp)}>
                      <div style={styles.empAvatar}>{emp.full_name?.[0]}</div>
                      <div>
                        <div style={styles.empName}>{emp.full_name}</div>
                        <div style={styles.empMeta}>{ev ? EVAL_STATUS[ev.status]?.label : '⬜ Chưa đánh giá'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {selectedEmployee && (
                <div style={styles.scoreForm}>
                  <div style={styles.scoreHeader}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{selectedEmployee.full_name}</strong>
                      <span style={{ ...styles.templateBadge, marginLeft: 8 }}>{TEMPLATE_LABELS[selectedEmployee.template_type]}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {role === 'hr' ? '🔵 HR đang review' : role === 'board_manager' ? '👑 Board Manager' : `Người ĐG: ${selectedEmployee.evaluator}`}
                    </div>
                  </div>
                  {(role === 'hr' || role === 'board_manager') && existingEvals.find(e => e.employee_id === selectedEmployee.id)?.original_scores && (
                    <div style={styles.originalScoreBox}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#d97706' }}>
                        📋 Điểm gốc TBP: {calcTotalScore(existingEvals.find(e => e.employee_id === selectedEmployee.id)?.original_scores || {}, selectedEmployee)} điểm
                      </p>
                    </div>
                  )}
                  <div style={{ overflowY: 'auto', flex: 1, paddingRight: 8 }}>
                    {(getTemplate(selectedEmployee)?.criteria_data || []).map((group, gi) => (
                      <div key={gi} style={styles.criteriaGroup}>
                        <div style={styles.groupHeader}>
                          <span style={styles.groupName}>{group.group}</span>
                          <span style={styles.groupWeight}>Trọng số: {group.weight}% · /{group.total_score}</span>
                        </div>
                        {group.items.map((item, ii) => (
                          <div key={ii} style={styles.criteriaRow}>
                            <div style={styles.criteriaInfo}>
                              <span style={styles.criteriaName}>{item.name}</span>
                              <span style={styles.criteriaDesc}>{item.description}</span>
                            </div>
                            <div style={styles.scoreInput}>
                              <input type="number" min="0" max={item.max_score} style={styles.scoreField} placeholder="0"
                                value={scores[item.name] || ''}
                                onChange={e => setScores({ ...scores, [item.name]: Math.min(Number(e.target.value), item.max_score) })} />
                              <span style={styles.scoreMax}>/{item.max_score}</span>
                            </div>
                          </div>
                        ))}
                        <div style={styles.groupTotal}>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>Tổng nhóm:</span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {group.items.reduce((s, item) => s + (Number(scores[item.name]) || 0), 0)}/{group.total_score}
                          </span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(scores).length > 0 && (
                      <div style={styles.totalBox}>
                        <div style={styles.totalScore}>
                          <span style={{ fontSize: 13 }}>Tổng điểm:</span>
                          <span style={{ fontSize: 26, fontWeight: 700, color: '#1a56db' }}>{calcTotalScore(scores, selectedEmployee)}</span>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>/100</span>
                        </div>
                        <div style={{ ...styles.rankBadge, background: RANKING(calcTotalScore(scores, selectedEmployee)).color + '15', color: RANKING(calcTotalScore(scores, selectedEmployee)).color }}>
                          {RANKING(calcTotalScore(scores, selectedEmployee)).label}
                        </div>
                      </div>
                    )}
                    <div style={styles.commentBox}>
                      <label style={styles.label}>Nhận xét</label>
                      <textarea style={styles.textarea} placeholder="Nhận xét về nhân viên..."
                        value={comment} onChange={e => setComment(e.target.value)} rows={3} />
                    </div>
                  </div>
                  <div style={styles.scoreActions}>
                    <button style={styles.cancelBtn} onClick={() => setSelectedEmployee(null)}>Hủy</button>
                    <button style={styles.submitBtn} onClick={handleSaveEval} disabled={submitting}>
                      {submitting ? 'Đang lưu...' : '💾 Lưu'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSummary && selectedCycle && <SummaryView />}

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
              {canCreate && selected.status === 'open' && (
                <div style={styles.actionRow}>
                  <button style={styles.primaryBtn} onClick={() => { setSelected(null); handleOpenEvaluate(selected) }}>📝 Điền đánh giá</button>
                  {role === 'board_manager' && (
                    <button style={styles.warningBtn} onClick={async () => {
                      await supabase.from('evaluation_cycles').update({ status: 'closed' }).eq('id', selected.id)
                      fetchAll(); setSelected(null)
                    }}>Đóng kỳ</button>
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
  cardFooter: { borderTop: '1px solid #f3f4f6', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' },
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
  scoreForm: { flex: 1, padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  scoreHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  templateBadge: { fontSize: 11, background: '#eff6ff', color: '#1a56db', padding: '2px 7px', borderRadius: 10 },
  originalScoreBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px', marginBottom: 10, flexShrink: 0 },
  criteriaGroup: { marginBottom: 12 },
  groupHeader: { display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, marginBottom: 6 },
  groupName: { fontSize: 12, fontWeight: 700, color: '#111827' },
  groupWeight: { fontSize: 11, color: '#6b7280' },
  criteriaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 4px', borderBottom: '1px solid #f9fafb' },
  criteriaInfo: { flex: 1, marginRight: 10 },
  criteriaName: { fontSize: 12, fontWeight: 500, color: '#374151', display: 'block' },
  criteriaDesc: { fontSize: 10, color: '#9ca3af', display: 'block', marginTop: 1 },
  scoreInput: { display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 },
  scoreField: { width: 48, padding: '3px 6px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'center', outline: 'none' },
  scoreMax: { fontSize: 11, color: '#6b7280' },
  groupTotal: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '3px 4px 0', alignItems: 'center' },
  totalBox: { background: '#f0f9ff', borderRadius: 8, padding: '10px 14px', margin: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  totalScore: { display: 'flex', alignItems: 'baseline', gap: 6 },
  rankBadge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  commentBox: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 },
  textarea: { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', resize: 'vertical' },
  scoreActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '12px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  smallBtn: { padding: '4px 10px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 500 },
}