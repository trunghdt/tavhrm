import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PayslipCard } from '../Payroll/PayrollPage'

export default function MySalaryPage() {
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchMyPayslips() }, [])

  const fetchMyPayslips = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Lấy employee_id
    const { data: emp } = await supabase
      .from('employees').select('id, full_name, employee_code')
      .eq('user_id', user.id).single()

    if (!emp) { setLoading(false); return }

    // Lấy 3 kỳ lương gần nhất đã approved
    const { data } = await supabase
      .from('payslips')
      .select('*, payroll_periods(year, month, status, title), employees(full_name, employee_code)')
      .eq('employee_id', emp.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(3)

    setPayslips(data || [])
    if (data?.length > 0) setSelected(data[0])
    setLoading(false)
  }

  const fmt = (v) => v ? new Intl.NumberFormat('vi-VN').format(Number(v)) : '0'

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Đang tải...</div>

  if (payslips.length === 0) return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '80px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: 48, marginBottom: 12 }}>💵</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Chưa có phiếu lương nào</p>
      <p style={{ fontSize: 13, color: '#6b7280' }}>Phiếu lương sẽ hiển thị sau khi được Ban lãnh đạo phê duyệt</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 88px)' }}>
      {/* Left: danh sách kỳ */}
      <div style={{ width: 220, background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 12 }}>Phiếu lương của tôi</p>
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
                {fmt(slip.net_salary)} đ
              </p>
            </div>
          )
        })}
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12, textAlign: 'center' }}>Hiển thị 3 tháng gần nhất</p>
      </div>

      {/* Right: chi tiết phiếu lương */}
      <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowY: 'auto' }}>
        {selected && <PayslipCard slip={selected} period={selected.payroll_periods} />}
      </div>
    </div>
  )
}