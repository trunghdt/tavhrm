import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

// ─── Constants ───────────────────────────────────────────────────────────────
const CYCLE_STATUS_LABELS = { draft: 'Nháp', open: 'Đang mở', closed: 'Đã đóng', approved: 'Đã duyệt' }
const CYCLE_STATUS_COLORS = { draft: '#6b7280', open: '#16a34a', closed: '#d97706', approved: '#1a56db' }
const PROPOSAL_STATUS = {
  draft:       { label: '💾 Đã lưu nháp',   color: '#7c3aed' },
  submitted:   { label: '🟡 TBP đã submit',  color: '#d97706' },
  hr_reviewed: { label: '🔵 HR đã review',   color: '#1a56db' },
  approved:    { label: '✅ Đã duyệt',        color: '#16a34a' },
}
const SALARY_FIELDS = [
  { key: 'base_salary',  label: 'Lương cơ bản' },
  { key: 'hieu_suat',    label: 'Hiệu suất'    },
  { key: 'chuyen_can',   label: 'Chuyên cần'   },
  { key: 'doi_song',     label: 'Đời sống'      },
  { key: 'tich_luy',     label: 'Tích lũy'      },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (val) => val ? new Intl.NumberFormat('vi-VN').format(Number(val)) + ' đ' : '—'
const calcTotal = (obj) => SALARY_FIELDS.reduce((s, f) => s + (Number(obj?.[f.key]) || 0), 0)
const num = (v) => Number(v) || 0

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalaryReviewPage() {
  const { role } = useAuthStore()

  // Master data
  const [cycles, setCycles]             = useState([])
  const [departments, setDepartments]   = useState([])
  const [deptRoles, setDeptRoles]       = useState([])
  const [employees, setEmployees]       = useState([])
  const [salaryMap, setSalaryMap]       = useState({})
  const [loading, setLoading]           = useState(true)
  const [myDeptIds, setMyDeptIds]       = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [currentEmpId, setCurrentEmpId]   = useState(null)

  // Cycle form
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ title: '', deadline: '' })
  const [deptAssignments, setDeptAssignments] = useState([])
  const [creating, setCreating]         = useState(false)
  const [formError, setFormError]       = useState('')

  // Propose view
  const [showPropose, setShowPropose]   = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [cycleEmployees, setCycleEmployees] = useState([])
  const [proposals, setProposals]       = useState([])
  const [selectedEmp, setSelectedEmp]   = useState(null)
  const [saving, setSaving]             = useState(false)

  // Propose form
  const [propSalary, setPropSalary]     = useState({
    base_salary: 0, hieu_suat: 0, chuyen_can: 0, doi_song: 0, tich_luy: 0, proposed_total: 0
  })
  const [propReason, setPropReason]     = useState('')

  // Summary & approve
  const [showSummary, setShowSummary]   = useState(false)
  const [showApprove, setShowApprove]   = useState(false)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [approving, setApproving]       = useState(false)

  // Detail modal
  const [selectedDetail, setSelectedDetail] = useState(null)

  // ─── Load all master data ─────────────────────────────────────────────────
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
      supabase.from('salary_records')
        .select('employee_id, base_salary, hieu_suat, chuyen_can, doi_song, tich_luy')
        .order('created_at', { ascending: false }),
    ])

    setCycles(cyclesData || [])
    setDepartments(deptsData || [])
    setDeptRoles(rolesData || [])
    setEmployees(empsData || [])

    // Build salary map (latest record per employee)
    const sMap = {}
    ;(salaryData || []).forEach(s => {
      if (!sMap[s.employee_id]) {
        sMap[s.employee_id] = {
          base_salary: s.base_salary || 0,
          hieu_suat:   s.hieu_suat   || 0,
          chuyen_can:  s.chuyen_can  || 0,
          doi_song:    s.doi_song    || 0,
          tich_luy:    s.tich_luy    || 0,
        }
      }
    })
    setSalaryMap(sMap)

    // Get current user info
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id)

    if (user?.id) {
      const { data: myEmp } = await supabase
        .from('employees').select('id').eq('user_id', user.id).single()
      if (myEmp) {
        setCurrentEmpId(myEmp.id)

        // For managers: compute which dept IDs they manage
        if (role === 'manager') {
          const getDescendants = (depts, parentId) => {
            const children = depts.filter(d => d.parent_id === parentId)
            return [...children.map(c => c.id), ...children.flatMap(c => getDescendants(depts, c.id))]
          }
          const myLeaderRows = (rolesData || []).filter(
            r => r.employee_id === myEmp.id && r.role_type === 'leader'
          )
          const myDirectIds = myLeaderRows.map(r => r.department_id)
          const allDescendants = myDirectIds.flatMap(id => getDescendants(deptsData || [], id))

          // Exclude descendants that have their own leader
          const otherLeaderDeptIds = (rolesData || [])
            .filter(r => r.role_type === 'leader' && r.employee_id !== myEmp.id && allDescendants.includes(r.department_id))
            .map(r => r.department_id)
          const excludeIds = [
            ...otherLeaderDeptIds,
            ...otherLeaderDeptIds.flatMap(id => getDescendants(deptsData || [], id))
          ]
          setMyDeptIds([
            ...myDirectIds,
            ...allDescendants.filter(id => !excludeIds.includes(id))
          ])
        }
      }
    }

    setLoading(false)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getDescendants = (parentId) => {
    const children = departments.filter(d => d.parent_id === parentId)
    return [...children.map(c => c.id), ...children.flatMap(c => getDescendants(c.id))]
  }

  const resolveDeptLevels = (deptId) => {
    const chain = []
    let current = departments.find(d => d.id === deptId)
    while (current) {
      chain.unshift(current)
      current = current.parent_id ? departments.find(d => d.id === current.parent_id) : null
    }
    return {
      branch:     chain[0]?.name || '—',
      department: chain[1]?.name || '—',
      team:       chain[2]?.name || '—',
    }
  }

  const findLeader = (deptId) => {
    const leader = deptRoles.find(r => r.department_id === deptId && r.role_type === 'leader')
    if (leader) return leader
    const dept = departments.find(d => d.id === deptId)
    if (dept?.parent_id) return findLeader(dept.parent_id)
    return null
  }

  const buildFlatDepts = (parentId = null, level = 0) =>
    departments.filter(d => d.parent_id === parentId).flatMap(d => [
      { ...d, level },
      ...buildFlatDepts(d.id, level + 1)
    ])

  const existingProposal = (empId) => proposals.find(p => p.employee_id === empId)

  // ─── Visible employees filter ─────────────────────────────────────────────
  const visibleEmployees = cycleEmployees.filter(emp => {
    if (role === 'board_manager' || role === 'hr') return true
    if (role === 'manager') return !emp.is_leader && myDeptIds.includes(emp.department_id)
    return false
  })

  // ─── Create cycle ─────────────────────────────────────────────────────────
  const handleCreateCycle = async (e) => {
    e.preventDefault()
    if (deptAssignments.length === 0) { setFormError('Chọn ít nhất 1 bộ phận!'); return }
    setCreating(true); setFormError('')
    const { error } = await supabase.from('salary_review_cycles').insert([{
      title: form.title,
      deadline: form.deadline,
      status: 'open',
      scope: { dept_assignments: deptAssignments },
      created_by: currentUserId,
    }])
    if (error) { setFormError(error.message); setCreating(false); return }
    setShowForm(false)
    setForm({ title: '', deadline: '' })
    setDeptAssignments([])
    fetchAll()
    setCreating(false)
  }

  // ─── Toggle dept assignment ───────────────────────────────────────────────
  const toggleDept = (deptId) => {
    const allIds = [deptId, ...getDescendants(deptId)]
    setDeptAssignments(prev => {
      const isChecked = prev.some(d => d.dept_id === deptId)
      if (isChecked) return prev.filter(d => !allIds.includes(d.dept_id))
      const newIds = allIds.filter(id => !prev.some(d => d.dept_id === id))
      return [...prev, ...newIds.map(id => ({ dept_id: id }))]
    })
  }

  // ─── Open propose view for a cycle ───────────────────────────────────────
  const handleOpenPropose = async (cycle) => {
    setSelectedCycle(cycle)
    setSelectedEmp(null)
    setShowSummary(false)

    const deptIds = (cycle.scope?.dept_assignments || []).map(d => d.dept_id)

    const [{ data: emps }, { data: props }] = await Promise.all([
      supabase.from('employees').select('*, departments(name)')
        .in('department_id', deptIds).eq('status', 'active'),
      supabase.from('salary_proposals').select('*').eq('cycle_id', cycle.id),
    ])
    setProposals(props || [])

    // Build cycleEmployees with salary data
    const result = (emps || []).map(emp => ({
      ...emp,
      currentSalary: salaryMap[emp.id] || { base_salary: 0, hieu_suat: 0, chuyen_can: 0, doi_song: 0, tich_luy: 0 },
      is_leader: deptRoles.some(r => r.employee_id === emp.id && r.role_type === 'leader'),
    }))

    // For HR/BLĐ: also include leaders who are not in any dept in scope (they manage the scope depts)
    if (role === 'board_manager' || role === 'hr') {
      const leaderEmpIds = deptRoles
        .filter(r => deptIds.includes(r.department_id) && r.role_type === 'leader')
        .map(r => r.employee_id)
      const existingEmpIds = result.map(e => e.id)
      const missingLeaders = employees
        .filter(e => leaderEmpIds.includes(e.id) && !existingEmpIds.includes(e.id))
        .map(emp => ({
          ...emp,
          currentSalary: salaryMap[emp.id] || { base_salary: 0, hieu_suat: 0, chuyen_can: 0, doi_song: 0, tich_luy: 0 },
          is_leader: true,
        }))
      result.unshift(...missingLeaders)
    }

    // Sort: leaders first
    result.sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0))
    setCycleEmployees(result)
    setShowPropose(true)
  }

  // ─── Select employee to propose/review ───────────────────────────────────
  const handleSelectEmp = (emp) => {
    const prop = existingProposal(emp.id)

    // Guard checks by role
    if (role === 'manager') {
      if (prop && ['submitted', 'hr_reviewed', 'approved'].includes(prop.status)) {
        alert('Đề xuất này đã được submit và khóa lại!'); return
      }
    }
    if (role === 'hr') {
      if (!prop || prop.status === 'draft') {
        alert('TBP chưa submit đề xuất cho nhân viên này!'); return
      }
      if (prop.status === 'approved') {
        alert('Đề xuất này đã được phê duyệt, không thể sửa!'); return
      }
      // Allow hr to review/re-review submitted or hr_reviewed proposals
    }
    if (role === 'board_manager') {
      if (!emp.is_leader && (!prop || prop.status !== 'hr_reviewed')) {
        alert('HR chưa review đề xuất này!'); return
      }
    }

    setSelectedEmp(emp)
    setPropReason('')

    const cur = emp.currentSalary
    const curTotal = calcTotal(cur)

    if (role === 'manager') {
      // TBP: load proposed_total from existing draft, else use current total
      setPropSalary({
        ...cur,
        proposed_total: prop?.proposed_salary || curTotal,
      })
      setPropReason(prop?.manager_reason || '')

    } else if (role === 'hr') {
      // HR: load HR's previously saved data if exists, else pre-fill from TBP proposal
      const hasHrSaved = (prop?.hr_adjusted_salary || 0) > 0
      if (hasHrSaved) {
        // Load what HR previously saved
        setPropSalary({
          base_salary: num(prop.proposed_base_salary) || num(cur.base_salary),
          hieu_suat:   num(prop.proposed_hieu_suat),
          chuyen_can:  num(prop.proposed_chuyen_can),
          doi_song:    num(prop.proposed_doi_song),
          tich_luy:    num(prop.proposed_tich_luy),
        })
      } else {
        // Pre-fill: base same, hieu_suat gets the increase from TBP
        const tbpTotal = num(prop?.proposed_salary)
        const increase = Math.max(0, tbpTotal - curTotal)
        setPropSalary({
          base_salary: num(cur.base_salary),
          hieu_suat:   num(cur.hieu_suat) + increase,
          chuyen_can:  num(cur.chuyen_can),
          doi_song:    num(cur.doi_song),
          tich_luy:    num(cur.tich_luy),
        })
      }
      setPropReason(prop?.hr_note || '')

    } else if (role === 'board_manager') {
      // BLĐ: load final if exists, else HR adjusted, else current
      const hasFinal = (prop?.final_salary || 0) > 0
      const hasHr    = (prop?.hr_adjusted_salary || 0) > 0
      setPropSalary({
        base_salary: hasFinal ? num(prop.final_base_salary)
          : hasHr ? (num(prop.proposed_base_salary) || num(cur.base_salary))
          : num(cur.base_salary),
        hieu_suat: hasFinal ? num(prop.final_hieu_suat)
          : hasHr ? num(prop.proposed_hieu_suat)
          : num(cur.hieu_suat),
        chuyen_can: hasFinal ? num(prop.final_chuyen_can)
          : hasHr ? num(prop.proposed_chuyen_can)
          : num(cur.chuyen_can),
        doi_song: hasFinal ? num(prop.final_doi_song)
          : hasHr ? num(prop.proposed_doi_song)
          : num(cur.doi_song),
        tich_luy: hasFinal ? num(prop.final_tich_luy)
          : hasHr ? num(prop.proposed_tich_luy)
          : num(cur.tich_luy),
      })
      setPropReason(prop?.bm_note || '')
    }
  }

  // ─── Save proposal ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedEmp || !selectedCycle) return
    setSaving(true)

    const prop = existingProposal(selectedEmp.id)
    const cur = selectedEmp.currentSalary
    const curTotal = calcTotal(cur)
    let payload = {}

    if (role === 'manager') {
      const proposedTotal = num(propSalary.proposed_total)
      const increase = proposedTotal - curTotal
      payload = {
        cycle_id:            selectedCycle.id,
        employee_id:         selectedEmp.id,
        current_salary:      curTotal,
        current_base_salary: num(cur.base_salary),
        current_hieu_suat:   num(cur.hieu_suat),
        current_chuyen_can:  num(cur.chuyen_can),
        current_doi_song:    num(cur.doi_song),
        current_tich_luy:    num(cur.tich_luy),
        proposed_salary:     proposedTotal,
        proposed_base_salary: num(cur.base_salary),
        proposed_hieu_suat:  num(cur.hieu_suat) + Math.max(0, increase),
        proposed_chuyen_can: num(cur.chuyen_can),
        proposed_doi_song:   num(cur.doi_song),
        proposed_tich_luy:   num(cur.tich_luy),
        manager_reason:      propReason,
        status:              'draft',
        submitted_by:        currentUserId,
      }

    } else if (role === 'hr') {
      const hrTotal = calcTotal(propSalary)
      payload = {
        proposed_base_salary: num(propSalary.base_salary),
        proposed_hieu_suat:   num(propSalary.hieu_suat),
        proposed_chuyen_can:  num(propSalary.chuyen_can),
        proposed_doi_song:    num(propSalary.doi_song),
        proposed_tich_luy:    num(propSalary.tich_luy),
        hr_adjusted_salary:   hrTotal,
        hr_note:              propReason,
        hr_reviewed_by:       currentUserId,
        hr_reviewed_at:       new Date().toISOString(),
        status:               'hr_reviewed',
      }

    } else if (role === 'board_manager') {
      const bmTotal = calcTotal(propSalary)
      if (selectedEmp.is_leader && !prop) {
        // BLĐ tạo đề xuất mới cho TBP (không qua TBP/HR)
        payload = {
          cycle_id:            selectedCycle.id,
          employee_id:         selectedEmp.id,
          current_salary:      curTotal,
          current_base_salary: num(cur.base_salary),
          current_hieu_suat:   num(cur.hieu_suat),
          current_chuyen_can:  num(cur.chuyen_can),
          current_doi_song:    num(cur.doi_song),
          current_tich_luy:    num(cur.tich_luy),
          proposed_salary:     bmTotal,
          proposed_base_salary: num(propSalary.base_salary),
          proposed_hieu_suat:  num(propSalary.hieu_suat),
          proposed_chuyen_can: num(propSalary.chuyen_can),
          proposed_doi_song:   num(propSalary.doi_song),
          proposed_tich_luy:   num(propSalary.tich_luy),
          final_base_salary:   num(propSalary.base_salary),
          final_hieu_suat:     num(propSalary.hieu_suat),
          final_chuyen_can:    num(propSalary.chuyen_can),
          final_doi_song:      num(propSalary.doi_song),
          final_tich_luy:      num(propSalary.tich_luy),
          final_salary:        bmTotal,
          bm_note:             propReason,
          status:              'hr_reviewed',
          submitted_by:        currentUserId,
        }
      } else {
        // BLĐ sửa đề xuất đã có
        payload = {
          final_base_salary: num(propSalary.base_salary),
          final_hieu_suat:   num(propSalary.hieu_suat),
          final_chuyen_can:  num(propSalary.chuyen_can),
          final_doi_song:    num(propSalary.doi_song),
          final_tich_luy:    num(propSalary.tich_luy),
          final_salary:      bmTotal,
          bm_note:           propReason,
          status:            'hr_reviewed',
        }
      }
    }

    // Upsert
    if (prop) {
      const { error } = await supabase.from('salary_proposals').update(payload).eq('id', prop.id)
      if (error) { alert('Lỗi khi lưu: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('salary_proposals').insert([payload])
      if (error) { alert('Lỗi khi lưu: ' + error.message); setSaving(false); return }
    }

    // Refresh proposals
    const { data: newProps } = await supabase
      .from('salary_proposals').select('*').eq('cycle_id', selectedCycle.id)
    setProposals(newProps || [])
    setSelectedEmp(null)
    setSaving(false)
  }

  // ─── Submit all (by role) ─────────────────────────────────────────────────
  const handleSubmitAll = async () => {
    if (!confirm('Xác nhận submit toàn bộ?')) return

    if (role === 'manager') {
      const toSubmit = proposals.filter(p => p.status === 'draft')
      if (!toSubmit.length) { alert('Không có đề xuất nháp nào!'); return }
      for (const p of toSubmit) {
        await supabase.from('salary_proposals')
          .update({ status: 'submitted', submitted_at: new Date().toISOString() })
          .eq('id', p.id)
      }
      alert(`Đã submit ${toSubmit.length} đề xuất lên HR!`)

    } else if (role === 'hr') {
      const toSubmit = proposals.filter(p => p.status === 'submitted' || p.status === 'hr_reviewed')
      if (!toSubmit.length) { alert('Không có đề xuất nào để submit!'); return }
      for (const p of toSubmit) {
        await supabase.from('salary_proposals')
          .update({ status: 'hr_reviewed', hr_reviewed_by: currentUserId, hr_reviewed_at: new Date().toISOString() })
          .eq('id', p.id)
      }
      alert(`Đã submit ${toSubmit.length} đề xuất lên Ban lãnh đạo!`)

    } else if (role === 'board_manager') {
      setShowApprove(true)
      return
    }

    const { data: newProps } = await supabase
      .from('salary_proposals').select('*').eq('cycle_id', selectedCycle.id)
    setProposals(newProps || [])
  }

  // ─── Approve all ──────────────────────────────────────────────────────────
  const handleApproveAll = async () => {
    if (!effectiveDate) { alert('Vui lòng chọn ngày hiệu lực!'); return }
    setApproving(true)

    const toApprove = proposals.filter(p => p.status === 'hr_reviewed')
    if (!toApprove.length) { alert('Không có đề xuất nào để phê duyệt!'); setApproving(false); return }

    for (const p of toApprove) {
      const finalBase       = num(p.final_base_salary) || num(p.proposed_base_salary) || num(p.current_base_salary)
      const finalHieuSuat   = num(p.final_hieu_suat)   || num(p.proposed_hieu_suat)   || num(p.current_hieu_suat)
      const finalChuyenCan  = num(p.final_chuyen_can)  || num(p.proposed_chuyen_can)  || num(p.current_chuyen_can)
      const finalDoiSong    = num(p.final_doi_song)    || num(p.proposed_doi_song)    || num(p.current_doi_song)
      const finalTichLuy    = num(p.final_tich_luy)    || num(p.proposed_tich_luy)    || num(p.current_tich_luy)
      const finalTotal      = finalBase + finalHieuSuat + finalChuyenCan + finalDoiSong + finalTichLuy

      await supabase.from('salary_proposals').update({
        status:           'approved',
        final_base_salary: finalBase,
        final_hieu_suat:   finalHieuSuat,
        final_chuyen_can:  finalChuyenCan,
        final_doi_song:    finalDoiSong,
        final_tich_luy:    finalTichLuy,
        final_salary:      finalTotal,
        approved_by:       currentUserId,
        effective_date:    effectiveDate,
      }).eq('id', p.id)

      await supabase.from('salary_records').insert([{
        employee_id:   p.employee_id,
        base_salary:   finalBase,
        hieu_suat:     finalHieuSuat,
        chuyen_can:    finalChuyenCan,
        doi_song:      finalDoiSong,
        tich_luy:      finalTichLuy,
        salary_type:   'time_based',
        effective_date: effectiveDate,
        change_reason: `Tăng lương đợt: ${selectedCycle?.title}`,
        approved_by:   currentUserId,
      }])
    }

    await supabase.from('salary_review_cycles').update({
      status:       'approved',
      approved_by:  currentUserId,
      approved_at:  new Date().toISOString(),
      effective_date: effectiveDate,
    }).eq('id', selectedCycle.id)

    alert(`Đã phê duyệt ${toApprove.length} đề xuất! Hiệu lực từ ${new Date(effectiveDate).toLocaleDateString('vi-VN')}`)
    setShowApprove(false)
    setShowSummary(false)
    setShowPropose(false)
    fetchAll()
    setApproving(false)
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  const canCreate = role === 'board_manager' || role === 'hr'
  const flatDepts = buildFlatDepts()

  const currentSal   = selectedEmp?.currentSalary || {}
  const currentTotal = calcTotal(currentSal)
  const prop         = selectedEmp ? existingProposal(selectedEmp.id) : null

  // ─── SUMMARY VIEW ─────────────────────────────────────────────────────────
  const SummaryView = () => {
    const leaders    = visibleEmployees.filter(e => e.is_leader)
    const nonLeaders = visibleEmployees.filter(e => !e.is_leader)

    const renderGroup = (group, title) => {
      if (!group.length) return null
      return (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>{title}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Nhân viên</th>
                  <th style={s.th}>Chi nhánh</th>
                  <th style={s.th}>Bộ phận</th>
                  <th style={s.th}>Tổ</th>
                  <th style={s.th}>Lương hiện tại</th>
                  <th style={s.th}>TBP đề xuất</th>
                  {(role === 'hr' || role === 'board_manager') && <th style={s.th}>HR điều chỉnh</th>}
                  {role === 'board_manager' && <th style={s.th}>Lương cuối</th>}
                  <th style={s.th}>Lý do</th>
                  <th style={s.th}>Trạng thái</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {group.map(emp => {
                  const p          = existingProposal(emp.id)
                  const pStatus    = p?.status || null
                  const curTotal   = calcTotal(emp.currentSalary)
                  const lvl        = resolveDeptLevels(emp.department_id)
                  const canEdit =
                    (role === 'manager' && p && pStatus === 'draft') ||
                    (role === 'hr' && p && ['submitted', 'hr_reviewed'].includes(pStatus)) ||
                    (role === 'board_manager' && (
                      pStatus === 'hr_reviewed' || (emp.is_leader && !p)
                    ))

                  return (
                    <tr key={emp.id} style={s.tr}>
                      <td style={s.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ ...s.avatar, width: 26, height: 26, fontSize: 11 }}>{emp.full_name?.[0]}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{emp.full_name}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{emp.employee_code}</div>
                          </div>
                        </div>
                      </td>
                      <td style={s.td}><span style={{ fontSize: 12 }}>{lvl.branch}</span></td>
                      <td style={s.td}><span style={{ fontSize: 12 }}>{lvl.department}</span></td>
                      <td style={s.td}><span style={{ fontSize: 12 }}>{lvl.team}</span></td>
                      <td style={s.td}><span style={{ fontSize: 12 }}>{fmt(curTotal)}</span></td>
                      <td style={s.td}>
                        {p?.proposed_salary
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: p.proposed_salary > curTotal ? '#16a34a' : p.proposed_salary < curTotal ? '#dc2626' : '#374151' }}>
                              {fmt(p.proposed_salary)}
                              {p.proposed_salary !== curTotal && <span style={{ fontSize: 10, marginLeft: 3 }}>{p.proposed_salary > curTotal ? '▲' : '▼'}</span>}
                            </span>
                          : <span style={{ color: '#9ca3af', fontSize: 12 }}>Chưa đề xuất</span>
                        }
                      </td>
                      {(role === 'hr' || role === 'board_manager') && (
                        <td style={s.td}>
                          {p?.hr_adjusted_salary
                            ? <span style={{ fontSize: 12, color: '#1a56db' }}>{fmt(p.hr_adjusted_salary)} ✏️</span>
                            : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                          }
                        </td>
                      )}
                      {role === 'board_manager' && (
                        <td style={s.td}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            {fmt(p?.final_salary || p?.hr_adjusted_salary || p?.proposed_salary)}
                          </span>
                        </td>
                      )}
                      <td style={s.td}>
                        <span style={{ fontSize: 11, color: '#6b7280', maxWidth: 120, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p?.manager_reason || p?.hr_note || p?.bm_note || '—'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{ fontSize: 11, color: p ? PROPOSAL_STATUS[pStatus]?.color : '#9ca3af' }}>
                          {p ? PROPOSAL_STATUS[pStatus]?.label : '⬜ Chưa đề xuất'}
                        </span>
                      </td>
                      <td style={s.td}>
                        {canEdit && (
                          <button style={s.smallBtn} onClick={() => { setShowSummary(false); handleSelectEmp(emp) }}>
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
        </div>
      )
    }

    return (
      <div style={s.overlay} onClick={() => setShowSummary(false)}>
        <div style={{ ...s.modal, width: 1020, maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
          <div style={s.modalHeader}>
            <div>
              <h2 style={s.modalTitle}>📊 Tổng hợp đề xuất lương</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{selectedCycle?.title}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {role === 'manager' && (
                <button style={s.submitBtn} onClick={handleSubmitAll}>✅ Submit lên HR</button>
              )}
              {role === 'hr' && (
                <button style={s.submitBtn} onClick={handleSubmitAll}>🔵 Submit lên BLĐ</button>
              )}
              {role === 'board_manager' && (
                <button style={{ ...s.submitBtn, background: '#16a34a' }} onClick={() => setShowApprove(true)}>
                  ✅ Phê duyệt & Áp dụng
                </button>
              )}
              <button style={s.closeBtn} onClick={() => setShowSummary(false)}>✕</button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: 24 }}>
            {leaders.length > 0 && renderGroup(leaders, '👔 Trưởng bộ phận')}
            {renderGroup(nonLeaders, '👥 Nhân viên')}
          </div>
        </div>
      </div>
    )
  }

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        {canCreate && (
          <button style={s.addBtn} onClick={() => { setShowForm(true); setFormError('') }}>
            + Mở đợt tăng lương
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>Mở đợt tăng lương mới</h3>
          <form onSubmit={handleCreateCycle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={s.field}>
                <label style={s.label}>Tên đợt *</label>
                <input style={s.input} placeholder="VD: Tăng lương Q1/2026"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Deadline *</label>
                <input style={s.input} type="date" value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })} required />
              </div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>📋 Chọn bộ phận áp dụng</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {flatDepts.map(dept => {
                  const assigned = deptAssignments.some(d => d.dept_id === dept.id)
                  const leader   = findLeader(dept.id)
                  const descIds  = getDescendants(dept.id)
                  const someChecked = descIds.some(id => deptAssignments.some(d => d.dept_id === id))
                  const allChecked  = descIds.length > 0 && descIds.every(id => deptAssignments.some(d => d.dept_id === id))
                  return (
                    <div key={dept.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 7,
                      border: `1px solid ${assigned ? '#bfdbfe' : '#e5e7eb'}`,
                      background: assigned ? '#eff6ff' : '#fff',
                      paddingLeft: 12 + dept.level * 16,
                    }}>
                      <input type="checkbox" checked={assigned}
                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked && !assigned }}
                        onChange={() => toggleDept(dept.id)} />
                      <span style={{ fontSize: dept.level === 0 ? 14 : 13, fontWeight: dept.level < 2 ? 600 : 400 }}>
                        {dept.level > 0 ? '└ ' : ''}{dept.name}
                      </span>
                      {leader && (
                        <span style={{ fontSize: 11, color: '#d97706', background: '#fffbeb', padding: '1px 6px', borderRadius: 10 }}>
                          👑 {leader.employees?.full_name}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            {formError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{formError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" style={s.cancelBtn} onClick={() => { setShowForm(false); setDeptAssignments([]) }}>Hủy</button>
              <button type="submit" style={s.submitBtn} disabled={creating}>{creating ? 'Đang tạo...' : 'Mở đợt'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Cycle list */}
      {loading
        ? <p style={{ color: '#6b7280' }}>Đang tải...</p>
        : cycles.length === 0
          ? (
            <div style={s.empty}>
              <p style={{ fontSize: 48, marginBottom: 12 }}>💰</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Chưa có đợt tăng lương nào</p>
              <p style={{ fontSize: 14, color: '#6b7280' }}>HR mở đợt tăng lương để bắt đầu quy trình</p>
            </div>
          )
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {cycles.map(cycle => (
                <div key={cycle.id} style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{cycle.title}</h3>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                      background: (CYCLE_STATUS_COLORS[cycle.status] || '#6b7280') + '15',
                      color: CYCLE_STATUS_COLORS[cycle.status] || '#6b7280',
                    }}>
                      {CYCLE_STATUS_LABELS[cycle.status] || cycle.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Deadline</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{cycle.deadline ? new Date(cycle.deadline).toLocaleDateString('vi-VN') : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Bộ phận</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{cycle.scope?.dept_assignments?.length || 0} bộ phận</span>
                    </div>
                    {cycle.effective_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#6b7280' }}>Ngày hiệu lực</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{new Date(cycle.effective_date).toLocaleDateString('vi-VN')}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {cycle.status === 'open' && (
                      <button style={s.evalBtn} onClick={() => handleOpenPropose(cycle)}>💰 Đề xuất</button>
                    )}
                    <button style={{ ...s.evalBtn, background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc' }}
                      onClick={async () => { await handleOpenPropose(cycle); setShowSummary(true) }}>
                      📊 Tổng hợp
                    </button>
                    <button style={{ background: 'none', border: 'none', color: '#1a56db', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setSelectedDetail(cycle)}>
                      Chi tiết →
                    </button>
                    {role === 'board_manager' && (
                      <button style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, cursor: 'pointer' }}
                        onClick={async () => {
                          if (!confirm(`Xóa đợt "${cycle.title}"? Tất cả đề xuất sẽ bị xóa!`)) return
                          await supabase.from('salary_proposals').delete().eq('cycle_id', cycle.id)
                          await supabase.from('salary_review_cycles').delete().eq('id', cycle.id)
                          fetchAll()
                        }}>🗑️ Xóa</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
      }

      {/* Propose modal */}
      {showPropose && selectedCycle && !showSummary && (
        <div style={s.overlay} onClick={() => { setShowPropose(false); setSelectedEmp(null) }}>
          <div style={{ ...s.modal, width: selectedEmp ? 700 : 460 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>💰 {selectedCycle.title}</h2>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {role === 'manager' ? 'Trưởng bộ phận đề xuất lương'
                    : role === 'hr' ? 'HR review đề xuất'
                    : 'Board Manager xem xét'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.evalBtn, fontSize: 12 }} onClick={() => setShowSummary(true)}>📊 Tổng hợp</button>
                <button style={s.closeBtn} onClick={() => { setShowPropose(false); setSelectedEmp(null) }}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', maxHeight: '72vh', overflow: 'hidden' }}>
              {/* Employee list */}
              <div style={{ width: 210, borderRight: '1px solid #f3f4f6', padding: '12px 8px', overflowY: 'auto', flexShrink: 0 }}>
                {/* Leaders (BLĐ only) */}
                {role === 'board_manager' && visibleEmployees.filter(e => e.is_leader).length > 0 && (
                  <>
                    <p style={s.groupLabel}>👔 Trưởng bộ phận</p>
                    {visibleEmployees.filter(e => e.is_leader).map(emp => {
                      const p = existingProposal(emp.id)
                      return (
                        <div key={emp.id} style={{ ...s.empItem, ...(selectedEmp?.id === emp.id ? s.empItemActive : {}) }}
                          onClick={() => handleSelectEmp(emp)}>
                          <div style={{ ...s.avatar, background: '#7c3aed' }}>{emp.full_name?.[0]}</div>
                          <div>
                            <div style={s.empName}>{emp.full_name}</div>
                            <div style={s.empMeta}>{p ? PROPOSAL_STATUS[p.status]?.label : '⬜ Chưa đề xuất'}</div>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ borderTop: '1px solid #f3f4f6', margin: '8px 0' }} />
                  </>
                )}
                <p style={s.groupLabel}>👥 Nhân viên</p>
                {visibleEmployees.filter(e => !e.is_leader).map(emp => {
                  const p = existingProposal(emp.id)
                  return (
                    <div key={emp.id} style={{ ...s.empItem, ...(selectedEmp?.id === emp.id ? s.empItemActive : {}) }}
                      onClick={() => handleSelectEmp(emp)}>
                      <div style={s.avatar}>{emp.full_name?.[0]}</div>
                      <div>
                        <div style={s.empName}>{emp.full_name}</div>
                        <div style={s.empMeta}>{p ? PROPOSAL_STATUS[p.status]?.label : '⬜ Chưa đề xuất'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Propose form */}
              {selectedEmp && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
                    <strong style={{ fontSize: 14 }}>{selectedEmp.full_name}</strong>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{selectedEmp.employee_code}</span>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {/* Current salary display */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>
                        💵 Lương hiện tại · Tổng: {fmt(currentTotal)}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {SALARY_FIELDS.map(f => (
                          <div key={f.key} style={{ fontSize: 12 }}>
                            <span style={{ color: '#6b7280' }}>{f.label}: </span>
                            <span style={{ fontWeight: 600 }}>{fmt(currentSal[f.key] || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Manager: only total */}
                    {role === 'manager' && (
                      <>
                        <div style={s.field}>
                          <label style={s.label}>Tổng lương đề xuất (VNĐ)</label>
                          <input style={s.input} type="number"
                            value={propSalary.proposed_total}
                            onChange={e => setPropSalary({ ...propSalary, proposed_total: e.target.value })} />
                          {num(propSalary.proposed_total) > 0 && (() => {
                            const diff = num(propSalary.proposed_total) - currentTotal
                            return (
                              <span style={{ fontSize: 12, marginTop: 4, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280' }}>
                                {diff > 0 ? `▲ Tăng ${fmt(diff)}` : diff < 0 ? `▼ Giảm ${fmt(Math.abs(diff))}` : '= Giữ nguyên'}
                                {diff > 0 && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6 }}>(cộng vào Hiệu suất)</span>}
                              </span>
                            )
                          })()}
                        </div>
                        <div style={{ ...s.field, marginTop: 12 }}>
                          <label style={s.label}>Lý do đề xuất</label>
                          <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                            value={propReason} onChange={e => setPropReason(e.target.value)} />
                        </div>
                      </>
                    )}

                    {/* HR / BLĐ: full breakdown */}
                    {(role === 'hr' || role === 'board_manager') && (
                      <>
                        {prop && (
                          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>
                              📋 TBP đề xuất tổng: {fmt(prop.proposed_salary)}
                              <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6 }}>(phần tăng gán vào Hiệu suất)</span>
                            </p>
                            {prop.manager_reason && <p style={{ fontSize: 11, color: '#92400e' }}>{prop.manager_reason}</p>}
                            {role === 'board_manager' && prop.hr_adjusted_salary && (
                              <p style={{ fontSize: 11, color: '#1a56db', marginTop: 4 }}>
                                🔵 HR đã điều chỉnh: {fmt(prop.hr_adjusted_salary)}
                                {prop.hr_note && <span style={{ marginLeft: 6 }}>· {prop.hr_note}</span>}
                              </p>
                            )}
                          </div>
                        )}

                        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, marginTop: 8 }}>
                          {role === 'hr' ? '🔵 HR điều chỉnh cơ cấu lương' : '👑 BLĐ điều chỉnh cơ cấu lương'}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          {SALARY_FIELDS.map(f => (
                            <div key={f.key} style={s.field}>
                              <label style={s.label}>{f.label}</label>
                              <input style={s.input} type="number" placeholder="0"
                                value={propSalary[f.key] || ''}
                                onChange={e => setPropSalary({ ...propSalary, [f.key]: e.target.value })} />
                            </div>
                          ))}
                          <div style={s.field}>
                            <label style={{ ...s.label, color: '#1a56db', fontWeight: 700 }}>Tổng lương</label>
                            <div style={{ padding: '9px 12px', borderRadius: 7, background: '#eff6ff', fontSize: 14, fontWeight: 700, color: '#1a56db' }}>
                              {fmt(calcTotal(propSalary))}
                            </div>
                          </div>
                        </div>

                        <div style={s.field}>
                          <label style={s.label}>{role === 'hr' ? 'Ghi chú HR' : 'Ghi chú BLĐ'}</label>
                          <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                            value={propReason} onChange={e => setPropReason(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
                    <button style={s.cancelBtn} onClick={() => setSelectedEmp(null)}>Hủy</button>
                    <button style={s.submitBtn} onClick={handleSave} disabled={saving}>
                      {saving ? 'Đang lưu...' : '💾 Lưu'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {showSummary && selectedCycle && <SummaryView />}

      {/* Approve modal */}
      {showApprove && (
        <div style={s.overlay} onClick={() => setShowApprove(false)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 420, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>✅ Phê duyệt tăng lương</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Chọn ngày hiệu lực áp dụng mức lương mới.</p>
            <div style={s.field}>
              <label style={s.label}>Ngày hiệu lực *</label>
              <input style={s.input} type="date" value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button style={s.cancelBtn} onClick={() => setShowApprove(false)}>Hủy</button>
              <button style={{ ...s.submitBtn, background: '#16a34a' }} onClick={handleApproveAll} disabled={approving}>
                {approving ? 'Đang xử lý...' : '✅ Xác nhận phê duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedDetail && (
        <div style={s.overlay} onClick={() => setSelectedDetail(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>{selectedDetail.title}</h2>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: (CYCLE_STATUS_COLORS[selectedDetail.status] || '#6b7280') + '15',
                  color: CYCLE_STATUS_COLORS[selectedDetail.status] || '#6b7280',
                }}>
                  {CYCLE_STATUS_LABELS[selectedDetail.status] || selectedDetail.status}
                </span>
              </div>
              <button style={s.closeBtn} onClick={() => setSelectedDetail(null)}>✕</button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {[
                  ['Deadline', selectedDetail.deadline ? new Date(selectedDetail.deadline).toLocaleDateString('vi-VN') : '—'],
                  ['Số bộ phận', `${selectedDetail.scope?.dept_assignments?.length || 0} bộ phận`],
                  ['Ngày hiệu lực', selectedDetail.effective_date ? new Date(selectedDetail.effective_date).toLocaleDateString('vi-VN') : '—'],
                  ['Ngày tạo', new Date(selectedDetail.created_at).toLocaleDateString('vi-VN')],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              {canCreate && selectedDetail.status === 'open' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button style={s.submitBtn} onClick={() => { setSelectedDetail(null); handleOpenPropose(selectedDetail) }}>
                    💰 Xem đề xuất
                  </button>
                  {role === 'board_manager' && (
                    <button style={{ padding: '10px 20px', background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                      onClick={async () => {
                        await supabase.from('salary_review_cycles').update({ status: 'closed' }).eq('id', selectedDetail.id)
                        fetchAll(); setSelectedDetail(null)
                      }}>
                      Đóng đợt
                    </button>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  addBtn:    { padding: '10px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  formCard:  { background: '#fff', borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '2px solid #bfdbfe' },
  formTitle: { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 20 },
  field:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:     { fontSize: 13, fontWeight: 500, color: '#374151' },
  input:     { padding: '9px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' },
  cancelBtn: { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  submitBtn: { padding: '9px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  empty:     { background: '#fff', borderRadius: 10, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  card:      { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  evalBtn:   { padding: '6px 14px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:     { background: '#fff', borderRadius: 12, width: 560, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  modalTitle:  { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 },
  closeBtn:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  groupLabel:  { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 },
  empItem:     { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 3 },
  empItemActive: { background: '#eff6ff' },
  avatar:    { width: 28, height: 28, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 },
  empName:   { fontSize: 12, fontWeight: 600, color: '#111827' },
  empMeta:   { fontSize: 10, color: '#6b7280' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  thead:     { background: '#f9fafb' },
  th:        { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  tr:        { borderTop: '1px solid #f3f4f6' },
  td:        { padding: '12px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  smallBtn:  { padding: '4px 10px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 500 },
}