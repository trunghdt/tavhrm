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

const fmt = (val) => val ? new Intl.NumberFormat('vi-VN').format(Number(val)) + ' đ' : '—'

const SALARY_FIELDS = [
  { key: 'base_salary', label: 'Lương cơ bản' },
  { key: 'hieu_suat', label: 'Hiệu suất' },
  { key: 'chuyen_can', label: 'Chuyên cần' },
  { key: 'doi_song', label: 'Đời sống' },
  { key: 'tich_luy', label: 'Tích lũy' },
]

const calcTotal = (obj) => SALARY_FIELDS.reduce((s, f) => s + (Number(obj?.[f.key]) || 0), 0)

export default function SalaryReviewPage() {
  const { role } = useAuthStore()
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([])
  const [departmentRoles, setDepartmentRoles] = useState([])
  const [employees, setEmployees] = useState([])
  const [salaryMap, setSalaryMap] = useState({})

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', deadline: '' })
  const [deptAssignments, setDeptAssignments] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [showPropose, setShowPropose] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [cycleEmployees, setCycleEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [proposals, setProposals] = useState([])
  const [saving, setSaving] = useState(false)

  const [propSalary, setPropSalary] = useState({
    base_salary: '', hieu_suat: '', chuyen_can: '', doi_song: '', tich_luy: '', proposed_total: ''
  })
  const [propReason, setPropReason] = useState('')

  const [showSummary, setShowSummary] = useState(false)
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
      supabase.from('salary_records').select('employee_id, base_salary, hieu_suat, chuyen_can, doi_song, tich_luy').order('created_at', { ascending: false }),
    ])
    setCycles(cyclesData || [])
    setDepartments(deptsData || [])
    setDepartmentRoles(rolesData || [])
    setEmployees(empsData || [])
    const sMap = {}
    salaryData?.forEach(s => {
      if (!sMap[s.employee_id]) {
        sMap[s.employee_id] = {
          base_salary: s.base_salary || 0,
          hieu_suat: s.hieu_suat || 0,
          chuyen_can: s.chuyen_can || 0,
          doi_song: s.doi_song || 0,
          tich_luy: s.tich_luy || 0,
        }
      }
    })
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
      title: form.title, deadline: form.deadline, status: 'open',
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
      currentSalary: salaryMap[emp.id] || { base_salary: 0, hieu_suat: 0, chuyen_can: 0, doi_song: 0, tich_luy: 0 },
      is_leader: departmentRoles.some(r => r.employee_id === emp.id && r.role_type === 'leader'),
    }))
    result.sort((a, b) => a.is_leader ? -1 : b.is_leader ? 1 : 0)
    // Thêm TBP của các dept vào danh sách (nếu chưa có)
if (role === 'board_manager' || role === 'hr') {
  const deptIds = (cycle.scope?.dept_assignments || []).map(d => d.dept_id)
  const leaderIds = departmentRoles
    .filter(r => deptIds.includes(r.department_id) && r.role_type === 'leader')
    .map(r => r.employee_id)
  
  const existingIds = result.map(e => e.id)
  const missingLeaders = employees.filter(e => 
    leaderIds.includes(e.id) && !existingIds.includes(e.id)
  ).map(emp => ({
    ...emp,
    currentSalary: salaryMap[emp.id] || { base_salary: 0, hieu_suat: 0, chuyen_can: 0, doi_song: 0, tich_luy: 0 },
    is_leader: true,
  }))
  
  result.unshift(...missingLeaders)
}
    setCycleEmployees(result)
    setShowPropose(true)
    setShowSummary(false)
  }

  const handleSelectEmployee = (emp) => {
    const existing = proposals.find(p => p.employee_id === emp.id)
    if (role === 'manager' && ['submitted', 'hr_reviewed', 'approved'].includes(existing?.status)) {
      alert('Đề xuất này đã được submit và khóa lại!'); return
    }
    if (role === 'hr') {
      if (!existing || existing.status === 'draft') { alert('TBP chưa submit đề xuất cho nhân viên này!'); return }
      if (['hr_reviewed', 'approved'].includes(existing?.status)) { alert('Bạn đã review đề xuất này rồi!'); return }
    }
if (role === 'board_manager') {
  if (!existing || existing.status !== 'hr_reviewed') {
    // TBP chưa có đề xuất → BLĐ vẫn có thể tạo đề xuất trực tiếp
    if (emp.is_leader) {
      // BLĐ đánh giá TBP trực tiếp, không cần qua TBP/HR
    } else {
      alert('HR chưa review đề xuất này!'); return
    }
  }
}

    setSelectedEmployee(emp)
    setPropReason('')
    const currentSal = emp.currentSalary
    const currentTotal = calcTotal(currentSal)

    if (role === 'manager') {
      setPropSalary({ ...currentSal, proposed_total: existing?.proposed_salary || currentTotal })
      setPropReason(existing?.manager_reason || '')
    } else if (role === 'hr') {
  const tbpProposed = existing?.proposed_salary || 0
  const increase = Math.max(0, tbpProposed - currentTotal)
  setPropSalary({
    base_salary: currentSal.base_salary || 0,
    hieu_suat: (currentSal.hieu_suat || 0) + increase,
    chuyen_can: currentSal.chuyen_can || 0,
    doi_song: currentSal.doi_song || 0,
    tich_luy: currentSal.tich_luy || 0,
  })
      setPropReason(existing?.hr_note || '')
    } else if (role === 'board_manager') {
      setPropSalary({
        base_salary: existing?.final_base_salary ?? existing?.proposed_salary ?? currentSal.base_salary ?? 0,
        hieu_suat: existing?.final_hieu_suat ?? existing?.proposed_hieu_suat ?? currentSal.hieu_suat ?? 0,
        chuyen_can: existing?.final_chuyen_can ?? existing?.proposed_chuyen_can ?? currentSal.chuyen_can ?? 0,
        doi_song: existing?.final_doi_song ?? existing?.proposed_doi_song ?? currentSal.doi_song ?? 0,
        tich_luy: existing?.final_tich_luy ?? existing?.proposed_tich_luy ?? currentSal.tich_luy ?? 0,
      })
      setPropReason(existing?.bm_note || '')
    }
  }

  const handleSaveProposal = async () => {
    if (!selectedEmployee || !selectedCycle) return
    setSaving(true)
    const userId = (await supabase.auth.getUser()).data.user?.id
    const existing = proposals.find(p => p.employee_id === selectedEmployee.id)
    const currentSal = selectedEmployee.currentSalary
    const currentTotal = calcTotal(currentSal)

    let payload = {}

    if (role === 'manager') {
      const proposedTotal = Number(propSalary.proposed_total) || 0
      const increase = proposedTotal - currentTotal
      const newHieuSuat = (currentSal.hieu_suat || 0) + Math.max(0, increase)
      payload = {
        cycle_id: selectedCycle.id,
        employee_id: selectedEmployee.id,
        current_salary: currentTotal,
        current_hieu_suat: currentSal.hieu_suat || 0,
        current_chuyen_can: currentSal.chuyen_can || 0,
        current_doi_song: currentSal.doi_song || 0,
        current_tich_luy: currentSal.tich_luy || 0,
        proposed_salary: proposedTotal,
        proposed_hieu_suat: newHieuSuat,
        proposed_chuyen_can: currentSal.chuyen_can || 0,
        proposed_doi_song: currentSal.doi_song || 0,
        proposed_tich_luy: currentSal.tich_luy || 0,
        manager_reason: propReason,
        status: 'draft',
        submitted_by: userId,
      }
    } else if (role === 'hr') {
      const hrTotal = calcTotal(propSalary)
      payload = {
        proposed_hieu_suat: Number(propSalary.hieu_suat) || 0,
        proposed_chuyen_can: Number(propSalary.chuyen_can) || 0,
        proposed_doi_song: Number(propSalary.doi_song) || 0,
        proposed_tich_luy: Number(propSalary.tich_luy) || 0,
        hr_adjusted_salary: hrTotal,
        hr_note: propReason,
        hr_reviewed_by: userId,
        hr_reviewed_at: new Date().toISOString(),
        status: existing?.status || 'submitted',
      }
} else if (role === 'board_manager') {
  const bmTotal = calcTotal(propSalary)
  if (selectedEmployee.is_leader) {
    // BLĐ đánh giá TBP trực tiếp → tạo proposal mới với status hr_reviewed
    payload = {
      cycle_id: selectedCycle.id,
      employee_id: selectedEmployee.id,
      current_salary: calcTotal(selectedEmployee.currentSalary),
      current_hieu_suat: selectedEmployee.currentSalary?.hieu_suat || 0,
      current_chuyen_can: selectedEmployee.currentSalary?.chuyen_can || 0,
      current_doi_song: selectedEmployee.currentSalary?.doi_song || 0,
      current_tich_luy: selectedEmployee.currentSalary?.tich_luy || 0,
      proposed_salary: bmTotal,
      final_base_salary: Number(propSalary.base_salary) || 0,
      final_hieu_suat: Number(propSalary.hieu_suat) || 0,
      final_chuyen_can: Number(propSalary.chuyen_can) || 0,
      final_doi_song: Number(propSalary.doi_song) || 0,
      final_tich_luy: Number(propSalary.tich_luy) || 0,
      final_salary: bmTotal,
      bm_note: propReason,
      status: 'hr_reviewed', // Sẵn sàng để approve
      submitted_by: userId,
    }
  } else {
    // BLĐ sửa đề xuất NV thường
    payload = {
      final_base_salary: Number(propSalary.base_salary) || 0,
      final_hieu_suat: Number(propSalary.hieu_suat) || 0,
      final_chuyen_can: Number(propSalary.chuyen_can) || 0,
      final_doi_song: Number(propSalary.doi_song) || 0,
      final_tich_luy: Number(propSalary.tich_luy) || 0,
      final_salary: bmTotal,
      bm_note: propReason,
      status: 'hr_reviewed',
    }
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
        await supabase.from('salary_proposals').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', p.id)
      }
      alert(`Đã submit ${toSubmit.length} đề xuất lên HR!`)
    } else if (role === 'hr') {
      const toSubmit = proposals.filter(p => p.status === 'submitted')
      if (toSubmit.length === 0) { alert('Không có đề xuất nào ở trạng thái TBP đã submit!'); return }
      for (const p of toSubmit) {
        await supabase.from('salary_proposals').update({
          status: 'hr_reviewed', hr_reviewed_by: userId, hr_reviewed_at: new Date().toISOString(),
        }).eq('id', p.id)
      }
      alert(`Đã submit ${toSubmit.length} đề xuất lên Ban lãnh đạo!`)
    } else if (role === 'board_manager') {
      setShowApproveModal(true)
      return
    }

    const { data: props } = await supabase.from('salary_proposals').select('*').eq('cycle_id', selectedCycle.id)
    setProposals(props || [])
  }

  const doApproveAll = async (userId) => {
    setApprovingAll(true)
    const toApprove = proposals.filter(p => p.status === 'hr_reviewed')
    if (toApprove.length === 0) { alert('Không có đề xuất nào để phê duyệt!'); setApprovingAll(false); return }

    for (const p of toApprove) {
      const finalBase = p.final_base_salary || p.current_salary || 0
      const finalHieuSuat = p.final_hieu_suat || p.proposed_hieu_suat || p.current_hieu_suat || 0
      const finalChuyenCan = p.final_chuyen_can || p.proposed_chuyen_can || p.current_chuyen_can || 0
      const finalDoiSong = p.final_doi_song || p.proposed_doi_song || p.current_doi_song || 0
      const finalTichLuy = p.final_tich_luy || p.proposed_tich_luy || p.current_tich_luy || 0
      const finalTotal = finalBase + finalHieuSuat + finalChuyenCan + finalDoiSong + finalTichLuy

      await supabase.from('salary_proposals').update({
        status: 'approved', final_salary: finalTotal,
        final_base_salary: finalBase, final_hieu_suat: finalHieuSuat,
        final_chuyen_can: finalChuyenCan, final_doi_song: finalDoiSong, final_tich_luy: finalTichLuy,
        approved_by: userId, effective_date: approveEffectiveDate,
      }).eq('id', p.id)

      await supabase.from('salary_records').insert([{
        employee_id: p.employee_id,
        base_salary: finalBase,
        hieu_suat: finalHieuSuat,
        chuyen_can: finalChuyenCan,
        doi_song: finalDoiSong,
        tich_luy: finalTichLuy,
        salary_type: 'time_based',
        effective_date: approveEffectiveDate,
        change_reason: `Tăng lương đợt: ${selectedCycle?.title}`,
        approved_by: userId,
      }])
    }

    await supabase.from('salary_review_cycles').update({
      status: 'approved', approved_by: userId,
      approved_at: new Date().toISOString(), effective_date: approveEffectiveDate,
    }).eq('id', selectedCycle.id)

    alert(`Đã phê duyệt ${toApprove.length} đề xuất! Hiệu lực từ ${new Date(approveEffectiveDate).toLocaleDateString('vi-VN')}`)
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
              const currentTotal = calcTotal(emp.currentSalary)
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
                  <td style={styles.td}><span style={{ fontSize: 12 }}>{fmt(currentTotal)}</span></td>
                  <td style={styles.td}>
                    {prop?.proposed_salary ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: prop.proposed_salary > currentTotal ? '#16a34a' : prop.proposed_salary < currentTotal ? '#dc2626' : '#374151' }}>
                        {fmt(prop.proposed_salary)}
                        {prop.proposed_salary !== currentTotal && <span style={{ fontSize: 10, marginLeft: 4 }}>{prop.proposed_salary > currentTotal ? '▲' : '▼'}</span>}
                      </span>
                    ) : <span style={{ color: '#9ca3af', fontSize: 12 }}>Chưa đề xuất</span>}
                  </td>
                  {(role === 'hr' || role === 'board_manager') && (
                    <td style={styles.td}>
                      {prop?.hr_adjusted_salary ? <span style={{ fontSize: 12, color: '#1a56db' }}>{fmt(prop.hr_adjusted_salary)} ✏️</span>
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                    </td>
                  )}
                  {role === 'board_manager' && (
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        {fmt(prop?.final_salary || prop?.hr_adjusted_salary || prop?.proposed_salary)}
                      </span>
                    </td>
                  )}
                  <td style={styles.td}>
                    <span style={{ fontSize: 11, color: '#6b7280', maxWidth: 120, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <div style={{ ...styles.modal, width: 960, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <div>
              <h2 style={styles.modalTitle}>📊 Tổng hợp đề xuất lương</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{selectedCycle?.title}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {role === 'manager' && <button style={{ ...styles.submitBtn, fontSize: 13 }} onClick={handleSubmitAll}>✅ Submit lên HR</button>}
              {role === 'hr' && <button style={{ ...styles.submitBtn, fontSize: 13 }} onClick={handleSubmitAll}>🔵 HR Submit lên BLĐ</button>}
              {role === 'board_manager' && <button style={{ ...styles.submitBtn, fontSize: 13, background: '#16a34a' }} onClick={() => setShowApproveModal(true)}>✅ Phê duyệt & Áp dụng lương</button>}
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

  // Form đề xuất theo role
  const currentSal = selectedEmployee?.currentSalary || {}
  const currentTotal = calcTotal(currentSal)
  const existing = selectedEmployee ? proposals.find(p => p.employee_id === selectedEmployee.id) : null

  return (
    <div>
      <div style={styles.headerRow}>
        {canCreate && <button style={styles.addBtn} onClick={() => { setShowForm(true); setError('') }}>+ Mở đợt tăng lương</button>}
      </div>

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
                <input style={styles.input} type="date" value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })} required />
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
                  <div style={styles.infoRow}><span style={styles.infoLabel}>Deadline</span><span style={styles.infoValue}>{cycle.deadline ? new Date(cycle.deadline).toLocaleDateString('vi-VN') : '—'}</span></div>
                  <div style={styles.infoRow}><span style={styles.infoLabel}>Bộ phận</span><span style={styles.infoValue}>{cycle.scope?.dept_assignments?.length || 0} bộ phận</span></div>
                  {cycle.effective_date && <div style={styles.infoRow}><span style={styles.infoLabel}>Ngày hiệu lực</span><span style={styles.infoValue}>{new Date(cycle.effective_date).toLocaleDateString('vi-VN')}</span></div>}
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
  {role === 'board_manager' && (
    <button style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, cursor: 'pointer', padding: 0 }}
      onClick={async () => {
        if (!confirm(`Xóa đợt tăng lương "${cycle.title}"?\nTất cả đề xuất liên quan sẽ bị xóa!`)) return
        await supabase.from('salary_proposals').delete().eq('cycle_id', cycle.id)
        await supabase.from('salary_review_cycles').delete().eq('id', cycle.id)
        fetchAll()
      }}>
      🗑️ Xóa
    </button>
  )}
</div>
              </div>
            ))}
          </div>
        )}

      {/* Modal đề xuất */}
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
<div style={styles.empList}>
  {role === 'board_manager' && visibleEmployees.filter(e => e.is_leader).length > 0 && (
    <>
      <p style={styles.groupLabel}>👔 Trưởng bộ phận</p>
      {visibleEmployees.filter(e => e.is_leader).map(emp => {
        const prop = proposals.find(p => p.employee_id === emp.id)
        return (
          <div key={emp.id}
            style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}) }}
            onClick={() => handleSelectEmployee(emp)}>
            <div style={{ ...styles.empAvatar, background: '#7c3aed' }}>{emp.full_name?.[0]}</div>
            <div>
              <div style={styles.empName}>{emp.full_name}</div>
              <div style={styles.empMeta}>{prop ? PROPOSAL_STATUS[prop.status]?.label : '⬜ Chưa đề xuất'}</div>
            </div>
          </div>
        )
      })}
      <div style={{ borderTop: '1px solid #f3f4f6', margin: '8px 0' }} />
    </>
  )}
  <p style={styles.groupLabel}>👥 Nhân viên</p>
  {visibleEmployees.filter(e => !e.is_leader).map(emp => {
                  const prop = proposals.find(p => p.employee_id === emp.id)
                  return (
                    <div key={emp.id} style={{ ...styles.empItem, ...(selectedEmployee?.id === emp.id ? styles.empItemActive : {}) }}
                      onClick={() => handleSelectEmployee(emp)}>
                      <div style={styles.empAvatar}>{emp.full_name?.[0]}</div>
                      <div>
                        <div style={styles.empName}>{emp.full_name}</div>
                        <div style={styles.empMeta}>{prop ? PROPOSAL_STATUS[prop.status]?.label : '⬜ Chưa đề xuất'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedEmployee && (
                <div style={styles.scoreForm}>
                  <div style={styles.scoreHeader}>
                    <strong style={{ fontSize: 14 }}>{selectedEmployee.full_name}</strong>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{selectedEmployee.employee_code}</span>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {/* Lương hiện tại */}
                    <div style={styles.currentSalaryBox}>
                      <p style={styles.currentSalaryLabel}>💵 Lương hiện tại · Tổng: {fmt(currentTotal)}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                        {SALARY_FIELDS.map(f => (
                          <div key={f.key} style={{ fontSize: 12 }}>
                            <span style={{ color: '#6b7280' }}>{f.label}: </span>
                            <span style={{ fontWeight: 600 }}>{fmt(currentSal[f.key] || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TBP: chỉ nhập tổng lương */}
                    {role === 'manager' && (
                      <>
                        <div style={styles.field}>
                          <label style={styles.label}>Tổng lương đề xuất (VNĐ)</label>
                          <input style={styles.input} type="number"
                            value={propSalary.proposed_total}
                            onChange={e => setPropSalary({ ...propSalary, proposed_total: e.target.value })} />
                          {Number(propSalary.proposed_total) > 0 && (() => {
                            const diff = Number(propSalary.proposed_total) - currentTotal
                            return (
                              <span style={{ fontSize: 12, marginTop: 4, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280' }}>
                                {diff > 0 ? `▲ Tăng ${fmt(diff)}` : diff < 0 ? `▼ Giảm ${fmt(Math.abs(diff))}` : '= Giữ nguyên'}
                                {diff > 0 && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6 }}>(cộng vào Hiệu suất)</span>}
                              </span>
                            )
                          })()}
                        </div>
                        <div style={{ ...styles.field, marginTop: 12 }}>
                          <label style={styles.label}>Lý do đề xuất</label>
                          <textarea style={{ ...styles.input, resize: 'vertical' }} rows={3}
                            value={propReason} onChange={e => setPropReason(e.target.value)} />
                        </div>
                      </>
                    )}

                    {/* HR / BLĐ: nhập đầy đủ cơ cấu */}
                    {(role === 'hr' || role === 'board_manager') && (
                      <>
                        {existing && (
                          <div style={styles.originalBox}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>
                              📋 TBP đề xuất tổng: {fmt(existing.proposed_salary)}
                              <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6 }}>(phần tăng gán vào Hiệu suất)</span>
                            </p>
                            {existing.manager_reason && <p style={{ fontSize: 11, color: '#92400e' }}>{existing.manager_reason}</p>}
                          </div>
                        )}

                        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, marginTop: 8 }}>
                          {role === 'hr' ? '🔵 HR điều chỉnh cơ cấu lương' : '👑 BLĐ điều chỉnh cơ cấu lương'}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          {SALARY_FIELDS.map(f => (
                            <div key={f.key} style={styles.field}>
                              <label style={styles.label}>{f.label}</label>
                              <input style={styles.input} type="number" placeholder="0"
                                value={propSalary[f.key] || ''}
                                onChange={e => setPropSalary({ ...propSalary, [f.key]: e.target.value })} />
                            </div>
                          ))}
                          <div style={styles.field}>
                            <label style={{ ...styles.label, color: '#1a56db', fontWeight: 700 }}>Tổng lương</label>
                            <div style={{ padding: '9px 12px', borderRadius: 7, background: '#eff6ff', fontSize: 14, fontWeight: 700, color: '#1a56db' }}>
                              {fmt(calcTotal(propSalary))}
                            </div>
                          </div>
                        </div>

                        <div style={styles.field}>
                          <label style={styles.label}>{role === 'hr' ? 'Ghi chú HR' : 'Ghi chú BLĐ'}</label>
                          <textarea style={{ ...styles.input, resize: 'vertical' }} rows={3}
                            value={propReason} onChange={e => setPropReason(e.target.value)} />
                        </div>
                      </>
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

      {showSummary && selectedCycle && <SummaryView />}

      {/* Modal approve */}
      {showApproveModal && (
        <div style={styles.overlay} onClick={() => setShowApproveModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 420, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>✅ Phê duyệt tăng lương</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Chọn ngày hiệu lực áp dụng mức lương mới.</p>
            <div style={styles.field}>
              <label style={styles.label}>Ngày hiệu lực *</label>
              <input style={styles.input} type="date" value={approveEffectiveDate}
                onChange={e => setApproveEffectiveDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button style={styles.cancelBtn} onClick={() => setShowApproveModal(false)}>Hủy</button>
              <button style={{ ...styles.submitBtn, background: '#16a34a' }}
                onClick={async () => {
                  if (!approveEffectiveDate) { alert('Vui lòng chọn ngày hiệu lực!'); return }
                  const userId = (await supabase.auth.getUser()).data.user?.id
                  await doApproveAll(userId)
                }} disabled={approvingAll}>
                {approvingAll ? 'Đang xử lý...' : '✅ Xác nhận phê duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <button style={styles.primaryBtn} onClick={() => { setSelected(null); handleOpenPropose(selected) }}>💰 Xem đề xuất</button>
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
  scoreHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  currentSalaryBox: { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 14px', marginBottom: 12 },
  currentSalaryLabel: { fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 4 },
  currentSalaryVal: { fontSize: 20, fontWeight: 800, color: '#111827' },
  originalBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 8 },
  scoreActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' },
  tr: { borderTop: '1px solid #f3f4f6' },
  td: { padding: '12px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  smallBtn: { padding: '4px 10px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 500 },
}
