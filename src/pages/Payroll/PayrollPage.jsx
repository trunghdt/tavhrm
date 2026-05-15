import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import ImportPayrollModal from './ImportPayrollModal'

const fmt = (v) => v ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(v))) + ' đ' : '—'
const fmtNum = (v) => v ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(v))) : '0'

const STATUS = {
  draft:     { label: '📝 Nháp',         color: '#6b7280', bg: '#f3f4f6' },
  submitted: { label: '🟡 Chờ duyệt',    color: '#d97706', bg: '#fffbeb' },
  approved:  { label: '✅ Đã duyệt',      color: '#16a34a', bg: '#f0fdf4' },
  paid:      { label: '💰 Đã thanh toán', color: '#1a56db', bg: '#eff6ff' },
}

export default function PayrollPage() {
  const { role } = useAuthStore()
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [payslips, setPayslips] = useState([])
  const [loadingPayslips, setLoadingPayslips] = useState(false)
  const [search, setSearch] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)

  const canManage = role === 'board_manager' || role === 'hr'

  useEffect(() => {
    fetchPeriods()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id))
  }, [])

  const fetchPeriods = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payroll_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    setPeriods(data || [])
    setLoading(false)
  }

  const fetchPayslips = async (period) => {
    setSelectedPeriod(period)
    setLoadingPayslips(true)
    const { data } = await supabase
      .from('payslips')
      .select('*, employees(employee_code, full_name, departments(name))')
      .eq('period_id', period.id)
      .order('created_at')
    setPayslips(data || [])
    setLoadingPayslips(false)
  }

  const handleSubmit = async (period) => {
    if (!confirm(`Submit bảng lương tháng ${period.month}/${period.year} lên Ban lãnh đạo phê duyệt?`)) return
    await supabase.from('payroll_periods').update({
      status: 'submitted',
      submitted_by: currentUserId,
      submitted_at: new Date().toISOString(),
    }).eq('id', period.id)
    fetchPeriods()
    if (selectedPeriod?.id === period.id) setSelectedPeriod({ ...period, status: 'submitted' })
  }

  const handleApprove = async (period) => {
    if (!confirm(`Phê duyệt bảng lương tháng ${period.month}/${period.year}? Nhân viên sẽ thấy phiếu lương của mình.`)) return
    // Update period status
    await supabase.from('payroll_periods').update({
      status: 'approved',
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    }).eq('id', period.id)
    // Update tất cả payslips trong period
    await supabase.from('payslips').update({ status: 'approved' }).eq('period_id', period.id)
    fetchPeriods()
    if (selectedPeriod?.id === period.id) {
      setSelectedPeriod({ ...period, status: 'approved' })
      fetchPayslips({ ...period, status: 'approved' })
    }
    alert('✅ Đã phê duyệt! Nhân viên có thể xem phiếu lương.')
  }

  const handleDelete = async (period) => {
    if (!confirm(`Xóa bảng lương tháng ${period.month}/${period.year}? Tất cả phiếu lương sẽ bị xóa!`)) return
    await supabase.from('payslips').delete().eq('period_id', period.id)
    await supabase.from('payroll_periods').delete().eq('id', period.id)
    if (selectedPeriod?.id === period.id) { setSelectedPeriod(null); setPayslips([]) }
    fetchPeriods()
  }

  const filteredPayslips = payslips.filter(p =>
    !search || p.employees?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.employees?.employee_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 88px)' }}>
      {/* Left: danh sách kỳ lương */}
      <div style={{ width: 280, background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Kỳ lương</span>
          {canManage && (
            <button style={{ padding: '5px 12px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setShowImport(true)}>
              + Upload
            </button>
          )}
        </div>

        {loading ? <p style={{ color: '#6b7280', fontSize: 13 }}>Đang tải...</p> :
          periods.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>💰</p>
              <p style={{ fontSize: 13 }}>Chưa có kỳ lương nào</p>
            </div>
          ) : (
            periods.map(period => {
              const st = STATUS[period.status] || STATUS.draft
              const isActive = selectedPeriod?.id === period.id
              return (
                <div key={period.id}
                  style={{ padding: '12px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, border: `1px solid ${isActive ? '#bfdbfe' : '#f3f4f6'}`, background: isActive ? '#eff6ff' : '#fff' }}
                  onClick={() => fetchPayslips(period)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Tháng {period.month}/{period.year}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  {period.title && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{period.title}</p>}
                </div>
              )
            })
          )
        }
      </div>

      {/* Right: chi tiết kỳ lương */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        {!selectedPeriod ? (
          <div style={{ background: '#fff', borderRadius: 10, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>💰</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Chọn kỳ lương để xem chi tiết</p>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Hoặc upload bảng tính lương mới</p>
          </div>
        ) : (
          <>
            {/* Header kỳ lương */}
            <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                    Bảng lương Tháng {selectedPeriod.month}/{selectedPeriod.year}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    {(() => {
                      const st = STATUS[selectedPeriod.status] || STATUS.draft
                      return <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, fontWeight: 500, background: st.bg, color: st.color }}>{st.label}</span>
                    })()}
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{payslips.length} nhân viên</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* HR: upload lại hoặc submit */}
                  {role === 'hr' && selectedPeriod.status === 'draft' && (
                    <>
                      <button style={{ padding: '8px 16px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setShowImport(true)}>
                        📥 Upload lại
                      </button>
                      <button style={{ padding: '8px 16px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => handleSubmit(selectedPeriod)}>
                        🚀 Submit lên BLĐ
                      </button>
                    </>
                  )}
                  {/* BLĐ: approve */}
                  {role === 'board_manager' && selectedPeriod.status === 'submitted' && (
                    <button style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => handleApprove(selectedPeriod)}>
                      ✅ Phê duyệt
                    </button>
                  )}
                  {/* BLĐ: xóa */}
                  {role === 'board_manager' && selectedPeriod.status !== 'approved' && (
                    <button style={{ padding: '8px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}
                      onClick={() => handleDelete(selectedPeriod)}>
                      🗑️ Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tổng hợp nhanh */}
            {payslips.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
                {[
                  { label: 'Tổng quỹ lương', value: fmtNum(payslips.reduce((s, p) => s + (p.gross_salary || 0), 0)) + ' đ', color: '#1a56db' },
                  { label: 'Tổng thực lĩnh', value: fmtNum(payslips.reduce((s, p) => s + (p.net_salary || 0), 0)) + ' đ', color: '#16a34a' },
                  { label: 'Tổng khấu trừ', value: fmtNum(payslips.reduce((s, p) => s + ((p.deductions?.tong_khau_tru) || 0), 0)) + ' đ', color: '#dc2626' },
                  { label: 'Số nhân viên', value: payslips.length, color: '#374151' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: 8, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Bảng phiếu lương */}
            <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                <input style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', width: 220 }}
                  placeholder="🔍 Tìm theo tên, mã NV..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {loadingPayslips ? <p style={{ padding: 24, color: '#6b7280' }}>Đang tải...</p> :
                  filteredPayslips.length === 0 ? <p style={{ padding: 24, color: '#6b7280' }}>Không có dữ liệu</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                        <tr>
                          {['Mã NV', 'Họ tên', 'Bộ phận', 'Tổng lương', 'Tổng KT', 'Thực lĩnh', 'Ngày công', 'Trạng thái', ''].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayslips.map(slip => {
                          const khauTru = slip.deductions?.tong_khau_tru || 0
                          return (
                            <tr key={slip.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                                  {slip.employees?.employee_code}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 500 }}>{slip.employees?.full_name}</td>
                              <td style={{ padding: '10px 12px', color: '#6b7280' }}>{slip.employees?.departments?.name || '—'}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(slip.gross_salary)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626' }}>{fmt(khauTru)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(slip.net_salary)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280' }}>{slip.ngay_cong || slip.working_days || '—'}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, ...({ approved: { color: '#16a34a', background: '#f0fdf4' }, draft: { color: '#6b7280', background: '#f3f4f6' } }[slip.status] || { color: '#6b7280', background: '#f3f4f6' }) }}>
                                  {slip.status === 'approved' ? '✅ Duyệt' : '📝 Nháp'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <PayslipDetail slip={slip} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                }
              </div>
            </div>
          </>
        )}
      </div>

      {showImport && (
        <ImportPayrollModal
          onClose={() => setShowImport(false)}
          onSuccess={(period) => {
            setShowImport(false)
            fetchPeriods()
            fetchPayslips(period)
          }}
        />
      )}
    </div>
  )
}

// Component xem chi tiết 1 phiếu lương (inline modal)
function PayslipDetail({ slip }) {
  const [show, setShow] = useState(false)
  if (!show) return (
    <button style={{ padding: '3px 10px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}
      onClick={() => setShow(true)}>Xem</button>
  )
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={() => setShow(false)}>
      <div style={{ background: '#fff', borderRadius: 12, width: 620, maxHeight: '85vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <PayslipCard slip={slip} onClose={() => setShow(false)} />
      </div>
    </div>
  )
}

export function PayslipCard({ slip, onClose, period }) {
  const fmt = (v) => v ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(v))) : '0'
  const emp = slip.employees || slip

  const sections = [
    {
      title: '💵 LƯƠNG',
      rows: [
        ['Lương cơ bản / Sản phẩm', slip.base_salary, 'Lương chuyên cần', slip.thuong_chuyen_can],
        ['Lương hoàn thành công việc', slip.luong_hoan_thanh, 'Phụ cấp đời sống', slip.phu_cap_doi_song],
        ['Lương sản phẩm', slip.luong_san_pham, 'Phụ cấp ăn ca', slip.phu_cap_an_ca],
      ],
      total: ['Tổng lương (1)', (slip.base_salary||0)+ (slip.thuong_chuyen_can||0) + (slip.luong_hoan_thanh||0) + (slip.phu_cap_doi_song||0) + (slip.phu_cap_an_ca||0) ],
    },
    {
      title: '⏰ TRỢ CẤP LÀM THÊM',
      rows: [
        ['Số giờ OT ngày thường', slip.ot_thuong_gio, 'Lương OT ngày thường', slip.ot_thuong_tien],
        ['Số giờ OT ngày nghỉ', slip.ot_nghi_gio, 'Lương OT ngày nghỉ', slip.ot_nghi_tien],
        ['Số giờ OT ngày lễ/tết', slip.ot_le_gio, 'Lương OT ngày lễ/tết', slip.ot_le_tien],
      ],
      total: ['Tổng làm thêm (2)', slip.tong_ot],
    },
    {
      title: '🎁 THƯỞNG',
      rows: [
        ['Thưởng năng suất', slip.thuong_nang_suat, 'Bù lương tháng trước', slip.bu_luong_thang_truoc],
        ['Thưởng quản lý', slip.thuong_quan_ly],
      
      ],
      total: ['Tổng thưởng (3)', (slip.thuong_nang_suat||0) + (slip.bu_luong_thang_truoc||0) + (slip.thuong_quan_ly||0)],
    },
    {
      title: '📋 KHẤU TRỪ',
      rows: [
        ['Ngày công trong tháng', slip.ngay_cong, 'Nghỉ lễ/việc riêng có hưởng lương', slip.ngay_le_huong_luong],
        ['Số ngày nghỉ', slip.so_ngay_nghi, 'Trừ lương ngày nghỉ', slip.tru_luong_nghi],
        ['Ngày phép sử dụng', slip.ngay_phep, 'Số lần đi muộn', slip.so_lan_di_muon],
        ['Số giờ đi muộn', slip.so_gio_di_muon, 'Trừ lương đi muộn', slip.tru_luong_di_muon],
        ['BHXH', slip.bhxh, 'Thuế TNCN', slip.thue_tncn],
        ['Phí công đoàn', slip.cong_doan, 'Khấu trừ khác', slip.khau_tru_khac],
      ],
      total: ['Tổng khấu trừ (4)', slip.deductions?.tong_khau_tru],
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid #1a56db', paddingBottom: 16 }}>
        <p style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>BẢNG LƯƠNG NHÂN VIÊN</p>
        <p style={{ fontSize: 11, color: '#6b7280' }}>
          {slip.payroll_periods ? `Tháng ${slip.payroll_periods.month}/${slip.payroll_periods.year}` : period ? `Tháng ${period.month}/${period.year}` : ''}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 11, color: '#6b7280' }}>Mã NV</p>
            <p style={{ fontSize: 14, fontWeight: 700 }}>{emp.employee_code}</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 11, color: '#6b7280' }}>Họ tên</p>
            <p style={{ fontSize: 14, fontWeight: 700 }}>{emp.full_name}</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      {sections.map(sec => (
        <div key={sec.title} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#1a56db', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>{sec.title}</p>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {sec.rows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderRight: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 12, color: '#374151' }}>{row[0]}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{row[1] !== '' && row[1] !== undefined ? (typeof row[1] === 'number' && row[1] > 100 ? fmt(row[1]) + ' đ' : row[1]) : '—'}</span>
                </div>
                {row[2] !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px' }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>{row[2]}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{row[3] !== '' && row[3] !== undefined ? (typeof row[3] === 'number' && row[3] > 100 ? fmt(row[3]) + ' đ' : row[3]) : '—'}</span>
                  </div>
                )}
              </div>
            ))}
            {sec.total && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontWeight: 700 }}>
                <span style={{ fontSize: 12, color: '#111827' }}>{sec.total[0]}</span>
                <span style={{ fontSize: 13, color: '#1a56db' }}>{fmt(sec.total[1])} đ</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Kết quả */}
<div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 10, padding: '16px 20px', marginTop: 8 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>THỰC LĨNH = (1) + (2) + (3) - (4)</p>
    <p style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{fmt(slip.net_salary)} đ</p>
  </div>
</div>
{slip.tich_luy_hien_tai > 0 && (
  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '14px 20px', marginTop: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <p style={{ fontSize: 12, color: '#d97706', fontWeight: 700 }}>🎄 Tổng tích lũy Tết đến hiện tại</p>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{fmt(slip.tich_luy_hien_tai)} đ</p>
    </div>
  </div>
)}

      {onClose && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={{ padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }} onClick={onClose}>Đóng</button>
        </div>
      )}
    </div>
  )
}