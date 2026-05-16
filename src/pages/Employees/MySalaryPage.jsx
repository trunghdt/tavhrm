import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PayslipCard } from '../Payroll/PayrollPage'

const fmt = (v) => v ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(v))) + ' đ' : '—'

const SALARY_FIELDS = [
  { key: 'base_salary',  label: 'Lương cơ bản (BHXH)' },
  { key: 'hieu_suat',    label: 'Hiệu suất' },
  { key: 'chuyen_can',   label: 'Chuyên cần' },
  { key: 'doi_song',     label: 'Đời sống' },
  { key: 'tich_luy',     label: 'Tích lũy' },
]

export default function MySalaryPage() {
  const [tab, setTab] = useState('salary') // 'salary' | 'payslip'
  const [loading, setLoading] = useState(true)
  const [salaryRecord, setSalaryRecord] = useState(null)
  const [payslips, setPayslips] = useState([])
  const [selected, setSelected] = useState(null)
  const [empInfo, setEmpInfo] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: emp } = await supabase
      .from('employees')
      .select('id, full_name, employee_code, position, departments(name)')
      .eq('user_id', user.id)
      .single()

    if (!emp) { setLoading(false); return }
    setEmpInfo(emp)

    // Lấy cơ cấu lương mới nhất
    const { data: salaryData } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setSalaryRecord(salaryData || null)

    // Lấy 3 phiếu lương gần nhất đã approved
// Lấy các period đã approved
const { data: approvedPeriods } = await supabase
  .from('payroll_periods')
  .select('id, year, month, title, status')
  .eq('status', 'approved')
  .order('year', { ascending: false })
  .order('month', { ascending: false })
  .limit(3)

const periodIds = (approvedPeriods || []).map(p => p.id)
let slips = []
if (periodIds.length > 0) {
  const { data: slipData } = await supabase
    .from('payslips')
    .select('*, employees(full_name, employee_code)')
    .eq('employee_id', emp.id)
    .in('period_id', periodIds)
    .order('created_at', { ascending: false })

  slips = (slipData || []).map(s => ({
    ...s,
    payroll_periods: approvedPeriods.find(p => p.id === s.period_id)
  }))
}

setPayslips(slips)
if (slips.length > 0) setSelected(slips[0])
setLoading(false)

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Đang tải...</div>

  const total = salaryRecord ? SALARY_FIELDS.reduce((s, f) => s + (Number(salaryRecord[f.key]) || 0), 0) : 0

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'salary',  label: '💵 Cơ cấu lương' },
          { key: 'payslip', label: '📄 Phiếu lương'  },
        ].map(t => (
          <button key={t.key}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#1a56db' : '#6b7280',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Cơ cấu lương */}
      {tab === 'salary' && (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Thông tin nhân viên */}
          <div style={{ width: 240, background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0, alignSelf: 'flex-start' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, margin: '0 auto 10px' }}>
                {empInfo?.full_name?.[0]}
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{empInfo?.full_name}</p>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{empInfo?.employee_code}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ['Chức vụ', empInfo?.position || '—'],
                ['Bộ phận', empInfo?.departments?.name || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cơ cấu lương */}
          <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {!salaryRecord ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>💵</p>
                <p style={{ fontSize: 14 }}>Chưa có thông tin cơ cấu lương</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Cơ cấu lương hiện tại</h3>
                    {salaryRecord.effective_date && (
                      <p style={{ fontSize: 12, color: '#6b7280' }}>
                        Hiệu lực từ: {new Date(salaryRecord.effective_date).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 20px' }}>
                    <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>TỔNG LƯƠNG</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{fmt(total)}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SALARY_FIELDS.map(f => (
                    <div key={f.key} style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>{f.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{fmt(salaryRecord[f.key] || 0)}</span>
                    </div>
                  ))}
                </div>

                {salaryRecord.change_reason && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Lý do điều chỉnh: </span>
                    <span style={{ fontSize: 12, color: '#92400e' }}>{salaryRecord.change_reason}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Phiếu lương */}
      {tab === 'payslip' && (
        payslips.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 10, padding: '80px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>📄</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Chưa có phiếu lương nào</p>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Phiếu lương sẽ hiển thị sau khi được Ban lãnh đạo phê duyệt</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Left: danh sách kỳ */}
            <div style={{ width: 200, background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0, alignSelf: 'flex-start' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 12 }}>Phiếu lương của tôi</p>
              {payslips.map(slip => {
                const isActive = selected?.id === slip.id
                return (
                  <div key={slip.id}
                    style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, border: `1px solid ${isActive ? '#bfdbfe' : '#f3f4f6'}`, background: isActive ? '#eff6ff' : '#fff' }}
                    onClick={() => setSelected(slip)}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      Tháng {slip.payroll_periods?.month}/{slip.payroll_periods?.year}
                    </p>
                    <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                      {fmt(slip.net_salary)}
                    </p>
                  </div>
                )
              })}
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10, textAlign: 'center' }}>3 tháng gần nhất</p>
            </div>

            {/* Right: chi tiết phiếu lương */}
            <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowY: 'auto' }}>
              {selected && <PayslipCard slip={selected} period={selected.payroll_periods} />}
            </div>
          </div>
        )
      )}
    </div>
  )
}