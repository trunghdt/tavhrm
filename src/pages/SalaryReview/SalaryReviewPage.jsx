import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const STATUS_LABELS = { draft: 'Nháp', open: 'Đang mở', closed: 'Đã đóng', approved: 'Đã duyệt' }
const STATUS_COLORS = { draft: '#6b7280', open: '#16a34a', closed: '#d97706', approved: '#1a56db' }
const PROPOSAL_STATUS = {
  draft: { label: '💾 Đã lưu nháp', color: '#7c3aed' },
  submitted: { label: '🟡 TBP đã submit', color: '#d97706' },
  hr_reviewed: { label: '🔵 HR đã review', color: '#1a56db' },
  approved: { label: '✅ Đã duyệt', color: '#16a34a' },
}

const formatSalary = (val) => val ? new Intl.NumberFormat('vi-VN').format(val) + ' đ' : '—'

export default function SalaryReviewPage() {
  const { role } = useAuthStore()
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([])
  const [departmentRoles, setDepartmentRoles] = useState([])
  const [employees, setEmployees] = useState([])
  const [salaryMap, setSalaryMap] = useState({})

  // Form tạo đợt
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', deadline: '' })
  const [deptAssignments, setDeptAssignments] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Đề xuất lương
  const [showPropose, setShowPropose] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [cycleEmployees, setCycleEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [proposals, setProposals] = useState([])
  const [propForm, setPropForm] = useState({ proposed_salary: '', manager_reason: '' })
  const [saving, setSaving] = useState(false)

  // Bảng tổng hợp
  const [showSummary, setShowSummary] = useState(false)

  // Phê duyệt BLĐ
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approveEffectiveDate, setApproveEffectiveDate] = useState('')
  const [approvingAll, setApprovingAll] = useState(false)

  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: cyclesData },
      { data: deptsData },
      { data: rolesData },
      { data: empsData },
      { data: salaryData },
    ] = await Promise.all([
      supabase.from('salary_review_cycles').select('*').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').eq('is_active', true),
      supabase.from('department_roles').select('*, employees(full_name, employee_code)').eq('is_active', true),
      supabase.from('employees').select('*, departments(name)').eq('status', 'active'),
      supabase.from('salary_records').select('employee_id, base_salary, effective_date').order('effective_date', { ascending: false }),
    ])
    setCycles(cyclesData || [])
    setDepartments(deptsData || [])
    setDepartmentRoles(rolesData || [])
    setEmployees(empsData || [])

    // Build salary map (lương mới nhất)
    const sMap = {}
    salaryData?.forEach(s => { if (!sMap[s.employee_id]) sMap[s.employee_id] = s.base_salary })
    setSalaryMap(sMap)
    setLoading(false)
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
      return [...prev, ...newIds.map(id => ({ dept_id: id }))]
    })
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (deptAssignments.length === 0) { setError('Chọn ít nhất 1 bộ phận!'); return }
    setCreating(true)
    setError('')
    const { error: err } = await supabase.from('salary_review_cycles').insert([{
      title: form.title,
      deadline: form.deadline,
      status: 'open',
      scope: { dept_assignments: deptAssignments },
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }])
    if (err) { setError(err.message); setCreating(false); return }
    setShowForm(false)
    setForm({ title: '', deadline: '' })
    setDeptAssignments([])
    fetchAll()
    setCreating(false)
  }

  const handleOpenPropose = async (cycle) => {
    setSelectedCycle(cycle)
    const deptIds = (cycle.scope?.dept_assignments || []).map(d => d.dept_id)
    const { data: emps } = await supabase
      .from('employees').select('*, departments(name)')
      .in('department_id', deptIds).eq('status', 'active')
    const { data: props } = await supabase
      .from('salary_proposals').select('*').eq('cycle_id', cycle.id)
    setProposals(props || [])
    const result = (emps || []).map(emp => ({
      ...emp,
      current_salary: salaryMap[emp.id] || 0,
      is_leader: departmentRoles.some(r => r.employee_id === emp.id && r.role_type === 'leader'),
    }))
    result.sort((a, b) => a.is_leader ? -1 : b.is_leader ? 1 : 0)
    setCycleEmployees(result)
    setShowPropose(true)
    setShowSummary(false)
  }

  const handleSelectEmployee = (emp) => {
    const existing = proposals.find(p => p.employee_id === emp.id)
    if (role === 'manager' && ['submitted', 'hr_reviewed', 'approved'].includes(existing?.status)) {
      alert('Đề xuất này đã được submit và khóa lại!')
      return
    }
    if (role === 'hr') {
      if (!existing || existing.status === 'draft') {
        alert('Trưởng bộ phận chưa submit đề xuất cho nhân viên này!')
        return
      }
      if (['hr_reviewed', 'approved'].includes(existing?.status)) {
        alert('Bạn đã review đề xuất này rồi!')
        return
      }
    }
    if (role === 'board_manager') {
      if (!existing || existing.status !== 'hr_reviewed') {
        alert('HR chưa review đề xuất của nhân viên này!')
        return
      }
    }
    setSelectedEmployee(emp)
    setPropForm({
      proposed_salary: existing?.hr_adjusted_salary || existing?.proposed_salary || emp.current_salary || '',
      manager_reason: existing?.manager_reason || '',
    })
  }

  const handleSaveProposal = async () => {
    if (!selectedEmployee || !selectedCycle) return
    setSaving(true)
    const userId = (await supabase.auth.getUser()).data.user?.id
    const existing = proposals.find(p => p.employee_id === selectedEmployee.id)

    let payload = {}
    if (role === 'manager') {
      payload = {
        cycle_id: selectedCycle.id,
        employee_id: selectedEmployee.id,
        current_salary: selectedEmployee.current_salary,
        proposed_salary: Number(propForm.proposed_salary),
        manager_reason: propForm.manager_reason,
        status: 'draft',
        submitted_by: userId,
      }
    } else if (role === 'hr') {
      payload = {
        hr_adjusted_salary: Number(propForm.proposed_salary),
        hr_note: propForm.manager_reason,
        hr_reviewed_by: userId,
        hr_reviewed_at: new Date().toISOString(),
        status: existing?.status || 'submitted',
      }
    } else if (role === 'board_manager') {
      payload = {
        final_salary: Number(propForm.proposed_salary),
        bm_note: propForm.manager_reason,
        status: 'hr_reviewed',
      }
    }

    if (existing) {
      await supabase.from('salary_proposals').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('salary_proposals').insert([payload])
    }

    const { data: props } = await supabase.from('salary_proposals').select('*').eq('cycle_id', selectedCycle.id)
    setProposals(props || [])
    setSelectedEmployee(null)
    setSaving(false)
  }

  const handleSubmitAll = async () => {
    if (!confirm('Xác nhận submit toàn bộ đề xuất?')) return
    const userId = (await supabase.auth.getUser()).data.user?.id

    if (role === 'manager') {
      const toSubmit = proposals.filter(p => p.status === 'draft')
      if (toSubmit.length === 0) { alert('Không có đề xuất nào ở trạng thái nháp!'); return }
      for (const p of toSubmit) {
        await supabase.from('salary_proposals').update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        }).eq('id', p.id)
      }
      alert(`Đã submit ${toSubmit.length} đề xuất lên HR!`)
    } else if (role === 'hr') {
      const toSubmit = proposals.filter(p => p.status === 'submitted')
      if (toSubmit.length === 0) { alert('Không có đề xuất nào ở trạng thái TBP đã submit!'); return }
      for (const p of toSubmit) {
        await supabase.from('salary_proposals').update({
          status: 'hr_reviewed',
          hr_reviewed_by: userId,
          hr_reviewed_at: new Date().toISOString(),
        }).eq('id', p.id)
      }
      alert(`Đã submit ${toSubmit.length} đề xuất lên Ban lãnh đạo!`)
    }

    const { data: props } = await supabase.from('salary_proposals').select('*').eq('cycle_id', selectedCycle.id)
    setProposals(props || [])
  }

  const handleApproveAll = async () => {
    if (!approveEffectiveDate) { alert('Vui lòng chọn ngày hiệu lực!'); return }
    if (!confirm(`Phê duyệt tất cả đề xuất lương?\nNgày hiệu lực: ${new Date(approveEffectiveDate).toLocaleDateString('vi-VN')}`)) return
    setApprovingAll(true)
    const userId = (await supabase.auth.getUser()).data.user?.id
    const toApprove = proposals.filter(p => p.status === 'hr_reviewed')

    for (const p of toApprove) {
      const finalSalary = p.final_salary || p.hr_adjusted_salary || p.proposed_salary
      // Update proposal
      await supabase.from('salary_proposals').update({
        status: 'approved',
        final_salary: finalSalary,
        approved_by: userId,
        effective_date: approveEffectiveDate,
      }).eq('id', p.id)

      // Tạo salary_record mới
      await supabase.from('salary_records').insert([{
        employee_id: p.employee_id,
        base_salary: finalSalary,
        salary_type: 'time_based',
        effective_date: approveEffectiveDate,
        change_reason: `Tăng lương theo đợt: ${selectedCycle?.title}`,
        approved_by: userId,
      }])
    }

    // Đóng cycle
    await supabase.from('salary_review_cycles').update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      effective_date: approveEffectiveDate,
    }).eq('id', selectedCycle.id)

    alert(`Đã phê duyệt ${toApprove.length} đề xuất! Lương sẽ có hiệu lực từ ${new Date(approveEffectiveDate).toLocaleDateString('vi-VN')}`)
    setShowApproveModal(false)
    setShowSummary(false)
    setShowPropose(false)
    fetchAll()
    setApprovingAll(false)
  }

  const visibleEmployees = cycleEmployees.filter(emp => {
    if (role === 'board_manager' || role === 'hr') return true
    if (role === 'manager') return !emp.is_leader
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

  // Summary View
  const SummaryView = () => {
    const showGroup = (group, title) => (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>{title}</h3>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Nhân viên</th>
              <th style={styles.th}>Lương hiện tại</th>
              <th style={styles.th}>TBP đề xuất</th>
              {(role === 'hr' || role === 'board_manager') && <th style={styles.th}>HR điều chỉnh</th>}
              {role === 'board_manager' && <th style={styles.th}>Lương cuối</th>}
              <th style={styles.th}>Lý do</th>
              <th style={styles.th}>Trạng thái</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {group.map(emp => {
              const prop = proposals.find(p => p.employee_id === emp.id)
              const propStatus = prop?.status || 'draft'
              const canEdit =
                (role === 'manager' && prop && propStatus === 'draft') ||
                (role === 'hr' && prop && propStatus === 'submitted') ||
                (role === 'board_manager' && prop && propStatus === 'hr_reviewed')

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
                  <td style={styles.td}><span style={{ fontSize: 12 }}>{formatSalary(emp.current_salary)}</span></td>
                  <td style={styles.td}>
                    {prop?.proposed_salary ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: prop.proposed_salary > emp.current_salary ? '#16a34a' : prop.proposed_salary < emp.current_salary ? '#dc2626' : '#374151' }}>
                        {formatSalary(prop.proposed_salary)}
                        {prop.proposed_salary > emp.current_salary && <span style={{ fontSize: 10, marginLeft: 4, color: '#16a34a' }}>▲</span>}
                        {prop.proposed_salary < emp.current_salary && <span style={{ fontSize: 10, marginLeft: 4, color: '#dc2626' }}>▼</span>}
                      </span>
                    ) : <span style={{ color: '#9ca3af', fontSize: 12 }}>Chưa đề xuất</span>}
                  </td>
                  {(role === 'hr' || role === 'board_manager') && (
                    <td style={styles.td}>
                      {prop?.hr_adjusted_salary
                        ? <span style={{ fontSize: 12, color: '#1a56db' }}>{formatSalary(prop.hr_adjusted_salary)} ✏️</span>
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                    </td>
                  )}
                  {role === 'board_manager' && (
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                        {formatSalary(prop?.final_salary || prop?.hr_adjusted_salary || prop?.proposed_salary)}
                      </span>
                    </td>
                  )}
                  <td style={styles.td}>
                    <span style={{ fontSize: 11, color: '#6b7280', maxWidth: 150, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prop?.manager_reason || '—'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 11, color: prop ? PROPOSAL_STATUS[propStatus]?.color : '#9ca3af' }}>
                      {prop ? PROPOSAL_STATUS[propStatus]?.label : '⬜ Chưa đề xuất'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {canEdit && (
                      <button style={styles.smallBtn} onClick={() => { setShowSummary(false); handleSelectEmployee(emp) }}>
                        ✏️ {role === 'hr' ? 'Review' : 'Sửa'}
                      </button>
                    )}
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
        <div style={{ ...styles.modal, width: 950, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <div>
              <h2 style={styles.modalTitle}>📊 Tổng hợp đề xuất lương</h2>
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
                <button style={{ ...styles.submitBtn, fontSize: 13, background: '#16a34a' }}
                  onClick={() => setShowApproveModal(true)}>
                  ✅ Phê duyệt & Áp dụng lương
                </button>
              )}
              <button style={styles.closeBtn} onClick={() => setShowSummary(false)}>✕</button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: 24 }}>
            {showGroup(visibleEmployees, '👥 Nhân viên')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={styles.headerRow}>
        {canCreate && (
          <button style={styles.addBtn} onClick={() => { setShowForm(true); setError('') }}>+ Mở đợt tăng lương</button>
        )}
      </div>

      {/* Form tạo đợt */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Mở đợt tăng lương mới</h3>
          <form onSubmit={handleCreate}>
            <div style={styles.formGrid2}>
              <div style={styles.field}>
                <label style={styles.label}>Tên đợt *</label>
                <input style={styles.input} placeholder="VD: Tăng lương Q1/2026"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Deadline *</label>
                <input style={styles.input} type="date"
                  value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} required />
              </div>
            </div>

            <div style={styles.deptSection}>
              <p style={styles.deptTitle}>📋 Chọn bộ phận áp dụng</p>
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
                    </div>
                  )
                })}
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}
            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowForm(false); setDeptAssignments([]) }}>Hủy</button>
              <button type="submit" style={styles.submitBtn} disabled={creating}>{creating ? 'Đang tạo...' : 'Mở đợt tăng lương'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách đợt */}
      {loading ? <p style={{ color: '#6b7280' }}>Đang tải...</p>
        : cycles.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyIcon}>💰</p>
            <p style={styles.emptyText}>Chưa có đợt tăng lương nào</p>
            <p style={styles.emptySub}>HR mở đợt tăng lương để bắt đầu quy trình</p>
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
                    <span style={styles.infoLabel}>Deadline</span>
                    <span style={styles.infoValue}>{cycle.deadline ? new Date(cycle.deadline).toLocaleDateString('vi-VN') : '—'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Bộ phận</span>
                    <span style={styles.infoValue}>{cycle.scope?.dept_assignments?.length || 0} bộ phận</span>
                  </div>
                  {cycle.effective_date && (
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Ngày hiệu lực</span>
                      <span style={styles.infoValue}>{new Date(cycle.effective_date).toLocaleDateString('vi-VN')}</span>
                    </div>
                  )}
                </div>
                <div style={styles.cardFooter}>
                  {cycle.status === 'open' && (
                    <>
                      <button style={styles.evalBtn} onClick={() => handleOpenPropose(cycle)}>💰 Đề xuất</button>
                      <button style={{ ...styles.evalBtn, background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc' }}
                        onClick={async () => { await handleOpenPropose(cycle); setShowSummary(true) }}>
                        📊 Tổng hợp
                      </button>
                    </>
                  )}
                  <button style={styles.viewBtn} onClick={() => setSelected(cycle)}>Chi tiết →</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Modal đề xuất lương */}
      {showPropose && selectedCycle && !showSummary && (
        <div style={styles.overlay} onClick={() => { setShowPropose(false); setSelectedEmployee(null) }}>
          <div style={{ ...styles.modal, width: selectedEmployee ? 680 : 460 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>💰 {selectedCycle.title}</h2>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {role === 'manager' ? 'Trưởng bộ phận đề xuất lương' : role === 'hr' ? 'HR review đề xuất' : 'Board Manager xem xét'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...styles.evalBtn, fontSize: 12 }} onClick={() => setShowSummary(true)}>📊 Tổng hợp</button>
                <button style={styles.closeBtn} onClick={() => { setShowPropose(false); setSelectedEmployee(null) }}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', maxHeight: '70vh', overflow: 'hidden' }}>
              {/* Danh sách NV */}
              <div style={styles.empList}>
                <p style={styles.groupLabel}>👥 Nhân viên</p>
                {visibleEmployees.filter(e => !e.is_leader).map(emp => {
                  const prop = proposals.find(p => p.employee_id === emp.id)
                  return (
                    <div key={emp.id}
                      style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}) }}
                      onClick={() => handleSelectEmployee(emp)}>
                      <div style={styles.empAvatar}>{emp.full_name?.[0]}</div>
                      <div>
                        <div style={styles.empName}>{emp.full_name}</div>
                        <div style={styles.empMeta}>
                          {prop ? PROPOSAL_STATUS[prop.status]?.label : '⬜ Chưa đề xuất'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Form đề xuất */}
              {selectedEmployee && (
                <div style={styles.scoreForm}>
                  <div style={styles.scoreHeader}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{selectedEmployee.full_name}</strong>
                      <span style={{ fontSize: 11, color: '#6b7280', display: 'block', marginTop: 2 }}>{selectedEmployee.employee_code}</span>
                    </div>
                  </div>

                  {/* Lương hiện tại */}
                  <div style={styles.currentSalaryBox}>
                    <p style={styles.currentSalaryLabel}>💵 Lương hiện tại</p>
                    <p style={styles.currentSalaryVal}>{formatSalary(selectedEmployee.current_salary)}</p>
                  </div>

                  {/* Điểm đánh giá gần nhất nếu có */}

                  <div style={{ padding: '0 16px 16px', flex: 1, overflowY: 'auto' }}>
                    <div style={styles.field}>
                      <label style={styles.label}>
                        {role === 'hr' ? 'Mức lương HR điều chỉnh (VNĐ)' :
                          role === 'board_manager' ? 'Mức lương cuối (VNĐ)' :
                            'Mức lương đề xuất (VNĐ) *'}
                      </label>
                      <input style={styles.input} type="number"
                        placeholder="VD: 9000000"
                        value={propForm.proposed_salary}
                        onChange={e => setPropForm({ ...propForm, proposed_salary: e.target.value })} />
                      {propForm.proposed_salary && selectedEmployee.current_salary && (
                        <span style={{
                          fontSize: 12, marginTop: 4,
                          color: Number(propForm.proposed_salary) > selectedEmployee.current_salary ? '#16a34a' :
                            Number(propForm.proposed_salary) < selectedEmployee.current_salary ? '#dc2626' : '#6b7280'
                        }}>
                          {Number(propForm.proposed_salary) > selectedEmployee.current_salary ? '▲ Tăng ' :
                            Number(propForm.proposed_salary) < selectedEmployee.current_salary ? '▼ Giảm ' : '= Giữ nguyên '}
                          {Number(propForm.proposed_salary) !== selectedEmployee.current_salary &&
                            formatSalary(Math.abs(Number(propForm.proposed_salary) - selectedEmployee.current_salary))}
                        </span>
                      )}
                    </div>

                    <div style={{ ...styles.field, marginTop: 12 }}>
                      <label style={styles.label}>
                        {role === 'hr' ? 'Ghi chú HR' :
                          role === 'board_manager' ? 'Ghi chú BLĐ' : 'Lý do đề xuất'}
                      </label>
                      <textarea style={{ ...styles.input, resize: 'vertical' }}
                        rows={4}
                        placeholder={role === 'manager' ? 'Lý do đề xuất tăng/giảm/giữ nguyên lương...' : 'Ghi chú...'}
                        value={propForm.manager_reason}
                        onChange={e => setPropForm({ ...propForm, manager_reason: e.target.value })} />
                    </div>

                    {/* Hiện đề xuất TBP nếu HR/BLĐ đang xem */}
                    {(role === 'hr' || role === 'board_manager') && proposals.find(p => p.employee_id === selectedEmployee.id) && (
                      <div style={styles.originalBox}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 6 }}>📋 Đề xuất của TBP:</p>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>
                          {formatSalary(proposals.find(p => p.employee_id === selectedEmployee.id)?.proposed_salary)}
                        </p>
                        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                          {proposals.find(p => p.employee_id === selectedEmployee.id)?.manager_reason}
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={styles.scoreActions}>
                    <button style={styles.cancelBtn} onClick={() => setSelectedEmployee(null)}>Hủy</button>
                    <button style={styles.submitBtn} onClick={handleSaveProposal} disabled={saving}>
                      {saving ? 'Đang lưu...' : '💾 Lưu'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bảng tổng hợp */}
      {showSummary && selectedCycle && <SummaryView />}

      {/* Modal chọn ngày hiệu lực khi BLĐ approve */}
      {showApproveModal && (
        <div style={styles.overlay} onClick={() => setShowApproveModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 420, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>✅ Phê duyệt tăng lương</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
              Chọn ngày hiệu lực áp dụng mức lương mới cho toàn bộ nhân viên trong đợt này.
            </p>
            <div style={styles.field}>
              <label style={styles.label}>Ngày hiệu lực *</label>
              <input style={styles.input} type="date"
                value={approveEffectiveDate}
                onChange={e => setApproveEffectiveDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button style={styles.cancelBtn} onClick={() => setShowApproveModal(false)}>Hủy</button>
              <button style={{ ...styles.submitBtn, background: '#16a34a' }}
                onClick={handleApproveAll} disabled={approvingAll}>
                {approvingAll ? 'Đang xử lý...' : '✅ Xác nhận phê duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chi tiết */}
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
                  ['Deadline', selected.deadline ? new Date(selected.deadline).toLocaleDateString('vi-VN') : '—'],
                  ['Số bộ phận', `${selected.scope?.dept_assignments?.length || 0} bộ phận`],
                  ['Ngày hiệu lực', selected.effective_date ? new Date(selected.effective_date).toLocaleDateString('vi-VN') : '—'],
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
                  <button style={styles.primaryBtn} onClick={() => { setSelected(null); handleOpenPropose(selected) }}>
                    💰 Xem đề xuất
                  </button>
                  {role === 'board_manager' && (
                    <button style={styles.warningBtn} onClick={async () => {
                      await supabase.from('salary_review_cycles').update({ status: 'closed' }).eq('id', selected.id)
                      fetchAll(); setSelected(null)
                    }}>Đóng đợt</button>
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
  formGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  input: { padding: '9px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' },
  deptSection: { background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16 },
  deptTitle: { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 },
  deptList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' },
  deptItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff' },
  deptItemActive: { border: '1px solid #bfdbfe', background: '#eff6ff' },
  deptItemLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  leaderTag: { fontSize: 11, color: '#d97706', background: '#fffbeb', padding: '1px 6px', borderRadius: 10 },
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
  scoreForm: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  scoreHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 16px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  currentSalaryBox: { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', margin: '12px 16px', flexShrink: 0 },
  currentSalaryLabel: { fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 4 },
  currentSalaryVal: { fontSize: 20, fontWeight: 800, color: '#111827' },
  originalBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginTop: 12 },
  scoreActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '12px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  smallBtn: { padding: '4px 10px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 500 },
}