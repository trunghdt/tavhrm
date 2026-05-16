import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

// Map cột Excel → field trong DB (dựa trên thứ tự cột bảng tính lương)
// Cột: No, Tổ, ?, ?, ID, Full Name, Dept, ?, Job, TỔNG LƯƠNG, TỔNG KHẤU TRỪ, THỰC LĨNH,
// TỔNG LƯƠNG(k OT), LƯƠNG CB THỰC TẾ, Lương CB BHXH, Lương HTKV, Phụ cấp đời sống,
// Phụ cấp ăn ca, Lương SP, Lương chuyên cần, Lương theo ngày, Lương theo giờ,
// Số giờ OT ngày thường, Lương OT ngày thường, Số giờ OT ngày nghỉ, Lương OT ngày nghỉ,
// Số giờ OT lễ, Lương OT lễ, Tổng OT, Thưởng tích lũy tết, Thưởng QL, Thưởng NS,
// Bù lương, Thưởng CC, Số ngày công, Nghỉ lễ, Số ngày nghỉ, Ngày phép, Trừ lương nghỉ,
// Số lần đi muộn, Số giờ đi muộn, Trừ lương đi muộn, Tham gia BHXH, BHXH, Công đoàn,
// Khấu trừ khác, Thuế TNCN, TỔNG KHẤU TRỪ (lặp), Cty đóng BHXH, No

const COL = {
  no: 0, to: 1, loai: 2, stt: 3,
  ma_nv: 4, full_name: 5, dept: 6, loai_nv: 7, job: 8,
  tong_luong: 9, tong_khau_tru: 10, thuc_linh: 11,
  tong_luong_no_ot: 12, luong_co_ban_san_pham: 13, luong_co_ban_bhxh: 14,
  luong_hoan_thanh: 15, phu_cap_doi_song: 16, phu_cap_an_ca: 17,
  luong_san_pham: 18, luong_chuyen_can: 19,
  luong_theo_ngay: 20, luong_theo_gio: 21,
  ot_thuong_gio: 22, ot_thuong_tien: 23,
  ot_nghi_gio: 24, ot_nghi_tien: 25,
  ot_le_gio: 26, ot_le_tien: 27, tong_ot: 28,
  thuong_tich_luy_tet: 29, thuong_quan_ly: 30, thuong_nang_suat: 31,
  bu_luong_thang_truoc: 32, thuong_chuyen_can: 33,
  ngay_cong: 34, ngay_le_huong_luong: 35, so_ngay_nghi: 36,
  ngay_phep: 37, tru_luong_nghi: 38,
  so_lan_di_muon: 39, so_gio_di_muon: 40, tru_luong_di_muon: 41,
  tham_gia_bhxh: 42, bhxh: 43, cong_doan: 44,
  khau_tru_khac: 45, thue_tncn: 46,
  tich_luy_hien_tai: 48,
}

const n = (v) => Number(v) || 0

export default function ImportPayrollModal({ onClose, onSuccess }) {
  const [step, setStep] = useState('upload') // upload | preview | saving
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [note, setNote] = useState('')
  const [rows, setRows] = useState([])
  const [missingEmps, setMissingEmps] = useState([])
  const [employees, setEmployees] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parseStats, setParseStats] = useState(null)
  const fileRef = useRef()

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')

    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Tìm dòng header (chứa "TỔNG LƯƠNG")
      let dataStartRow = 0
      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        const row = raw[i]
        if (row.some(cell => String(cell).includes('TỔNG LƯƠNG') || String(cell).includes('Full Name'))) {
          dataStartRow = i + 2 // bỏ qua 2 dòng header
          break
        }
      }

      // Lấy tháng/năm từ tên sheet hoặc header
      const sheetName = wb.SheetNames[0]
      const monthMatch = sheetName.match(/T(\d+)/i) || sheetName.match(/(\d+)\/(\d+)/)
      if (monthMatch && !month) {
        setMonth(monthMatch[1])
      }

      // Parse từng dòng
      const parsed = []
      for (let i = dataStartRow; i < raw.length; i++) {
        const row = raw[i]
        const ma_nv = String(row[COL.ma_nv] || '').trim()
        const full_name = String(row[COL.full_name] || '').trim()

        // Bỏ qua dòng trống, dòng tổng hợp (không có mã NV số)
        if (!ma_nv || !full_name) continue
        if (full_name.toUpperCase().includes('BỘ PHẬN') || full_name.toUpperCase().includes('BAN LÃNH ĐẠO')) continue

        parsed.push({
          ma_nv,
          full_name,
          to: String(row[COL.to] || '').trim(),
          gross_salary: n(row[COL.tong_luong]),
          tong_khau_tru: n(row[COL.tong_khau_tru]),
          thuc_linh: n(row[COL.thuc_linh]),
          tong_luong_no_ot: n(row[COL.tong_luong_no_ot]),
          base_salary: n(row[COL.luong_co_ban_san_pham]),
          luong_co_ban_bhxh: n(row[COL.luong_co_ban_bhxh]),
          luong_hoan_thanh: n(row[COL.luong_hoan_thanh]),
          phu_cap_doi_song: n(row[COL.phu_cap_doi_song]),
          phu_cap_an_ca: n(row[COL.phu_cap_an_ca]),
          luong_san_pham: n(row[COL.luong_san_pham]),
          luong_chuyen_can: n(row[COL.luong_chuyen_can]),
          ot_thuong_gio: n(row[COL.ot_thuong_gio]),
          ot_thuong_tien: n(row[COL.ot_thuong_tien]),
          ot_nghi_gio: n(row[COL.ot_nghi_gio]),
          ot_nghi_tien: n(row[COL.ot_nghi_tien]),
          ot_le_gio: n(row[COL.ot_le_gio]),
          ot_le_tien: n(row[COL.ot_le_tien]),
          tong_ot: n(row[COL.tong_ot]),
          thuong_tich_luy_tet: n(row[COL.thuong_tich_luy_tet]),
          thuong_quan_ly: n(row[COL.thuong_quan_ly]),
          thuong_nang_suat: n(row[COL.thuong_nang_suat]),
          bu_luong_thang_truoc: n(row[COL.bu_luong_thang_truoc]),
          thuong_chuyen_can: n(row[COL.thuong_chuyen_can]),
          ngay_cong: n(row[COL.ngay_cong]),
          ngay_le_huong_luong: n(row[COL.ngay_le_huong_luong]),
          so_ngay_nghi: n(row[COL.so_ngay_nghi]),
          ngay_phep: n(row[COL.ngay_phep]),
          tru_luong_nghi: n(row[COL.tru_luong_nghi]),
          so_lan_di_muon: n(row[COL.so_lan_di_muon]),
          so_gio_di_muon: n(row[COL.so_gio_di_muon]),
          tru_luong_di_muon: n(row[COL.tru_luong_di_muon]),
          bhxh: n(row[COL.bhxh]),
          cong_doan: n(row[COL.cong_doan]),
          khau_tru_khac: n(row[COL.khau_tru_khac]),
          thue_tncn: n(row[COL.thue_tncn]),
          tich_luy_hien_tai: n(row[COL.tich_luy_hien_tai]),
          net_salary: n(row[COL.thuc_linh]),
        })
      }

      if (parsed.length === 0) {
        setError('Không tìm thấy dữ liệu nhân viên trong file. Vui lòng kiểm tra lại format file.')
        return
      }

      // Fetch danh sách nhân viên từ DB để kiểm tra
      const { data: emps } = await supabase
        .from('employees')
        .select('id, employee_code, full_name, user_id')

      setEmployees(emps || [])

      // Kiểm tra ai chưa có trong hệ thống
      const empMap = {}
      ;(emps || []).forEach(e => { empMap[e.employee_code] = e })

      const missing = parsed.filter(p => !empMap[p.ma_nv])
      setMissingEmps(missing)
      setRows(parsed)
      setParseStats({ total: parsed.length, found: parsed.length - missing.length, missing: missing.length })
      setStep('preview')

    } catch (err) {
      setError('Lỗi đọc file: ' + err.message)
    }
  }

  const handleSave = async () => {
    if (!month || !year) { setError('Vui lòng chọn tháng/năm!'); return }
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Tạo hoặc lấy payroll_period
      const periodTitle = note ? `Tháng ${month}/${year} - ${note}` : `Tháng ${month}/${year}`
      let period
const { data: existingList } = await supabase
  .from('payroll_periods')
  .select('*')
  .eq('year', Number(year))
  .eq('month', Number(month))
  .eq('title', periodTitle)

const existing = existingList?.[0] || null

      if (existing) {
        period = existing
        // Xóa payslips cũ của period này để upload lại
        await supabase.from('payslips').delete().eq('period_id', period.id)
      } else {
        const { data: newPeriod, error: pErr } = await supabase
          .from('payroll_periods')
          .insert([{
            year: Number(year),
            month: Number(month),
            title: periodTitle,
            status: 'draft',
            created_by: user.id,
          }])
          .select().single()
        if (pErr) throw pErr
        period = newPeriod
      }

      // Map employee_code → employee_id
      const { data: emps } = await supabase.from('employees').select('id, employee_code')
      const empMap = {}
      emps?.forEach(e => { empMap[e.employee_code] = e.id })

      // Insert payslips
      const payslips = rows
        .filter(r => empMap[r.ma_nv]) // chỉ NV đã có trong hệ thống
        .map(r => ({
          period_id: period.id,
          employee_id: empMap[r.ma_nv],
          status: 'draft',
          // Lương cơ bản
          base_salary: r.base_salary,
          luong_co_ban_bhxh: r.luong_co_ban_bhxh,
          luong_hoan_thanh: r.luong_hoan_thanh,
          phu_cap_doi_song: r.phu_cap_doi_song,
          phu_cap_an_ca: r.phu_cap_an_ca,
          luong_san_pham: r.luong_san_pham,
          luong_chuyen_can: r.luong_chuyen_can,
          // OT
          ot_thuong_gio: r.ot_thuong_gio, ot_thuong_tien: r.ot_thuong_tien,
          ot_nghi_gio: r.ot_nghi_gio, ot_nghi_tien: r.ot_nghi_tien,
          ot_le_gio: r.ot_le_gio, ot_le_tien: r.ot_le_tien,
          tong_ot: r.tong_ot,
          // Thưởng
          thuong_tich_luy_tet: r.thuong_tich_luy_tet,
          thuong_quan_ly: r.thuong_quan_ly,
          thuong_nang_suat: r.thuong_nang_suat,
          bu_luong_thang_truoc: r.bu_luong_thang_truoc,
          thuong_chuyen_can: r.thuong_chuyen_can,
          // Ngày công & khấu trừ
          ngay_cong: r.ngay_cong,
          ngay_le_huong_luong: r.ngay_le_huong_luong,
          so_ngay_nghi: r.so_ngay_nghi,
          ngay_phep: r.ngay_phep,
          tru_luong_nghi: r.tru_luong_nghi,
          so_lan_di_muon: r.so_lan_di_muon,
          so_gio_di_muon: r.so_gio_di_muon,
          tru_luong_di_muon: r.tru_luong_di_muon,
          bhxh: r.bhxh,
          cong_doan: r.cong_doan,
          khau_tru_khac: r.khau_tru_khac,
          thue_tncn: r.thue_tncn,
          tich_luy_hien_tai: r.tich_luy_hien_tai,
          // Kết quả
          gross_salary: r.gross_salary,
          deductions: { tong_khau_tru: r.tong_khau_tru },
          net_salary: r.net_salary,
          thuc_linh: r.net_salary,
          tong_luong_no_ot: r.tong_luong_no_ot,
          working_days: r.ngay_cong,
        }))

      const { error: insertErr } = await supabase.from('payslips').insert(payslips)
      if (insertErr) throw insertErr

      setSaving(false)
      onSuccess(period)
    } catch (err) {
      setError('Lỗi khi lưu: ' + err.message)
      setSaving(false)
    }
  }

 const fmt = (v) => v ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(v))) : '0'

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, width: step === 'preview' ? 900 : 480 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>📥 Upload Bảng tính lương</h2>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {step === 'upload' ? 'Chọn file Excel bảng tính lương' : `${parseStats?.total} nhân viên · ${parseStats?.missing} chưa có tài khoản`}
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Chọn tháng/năm */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.field}>
                  <label style={s.label}>Tháng *</label>
                  <select style={s.input} value={month} onChange={e => setMonth(e.target.value)}>
                    <option value="">-- Chọn tháng --</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Năm *</label>
                  <input style={s.input} type="number" value={year}
                    onChange={e => setYear(e.target.value)} min="2020" max="2030" />
                </div>
                <div style={s.field}>
  <label style={s.label}>Ghi chú (tùy chọn)</label>
  <input style={s.input} placeholder="VD: Bộ phận May - TAV BN"
    value={note} onChange={e => setNote(e.target.value)} />
</div>
              </div>

              {/* Upload zone */}
              <div
                style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}
                onClick={() => fileRef.current?.click()}
              >
                <p style={{ fontSize: 36, marginBottom: 8 }}>📊</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Click để chọn file Excel</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Hỗ trợ .xlsx · Template Bảng tính lương TAV</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
              </div>

              {error && <p style={{ color: '#dc2626', fontSize: 13, background: '#fef2f2', padding: '10px 14px', borderRadius: 7 }}>{error}</p>}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Tổng nhân viên', value: parseStats?.total, color: '#1a56db' },
                  { label: 'Tìm thấy trong HT', value: parseStats?.found, color: '#16a34a' },
                  { label: 'Chưa có tài khoản', value: parseStats?.missing, color: parseStats?.missing > 0 ? '#dc2626' : '#6b7280' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Cảnh báo nhân viên chưa có tài khoản */}
              {missingEmps.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
                    ⚠️ {missingEmps.length} nhân viên chưa có tài khoản — sẽ bị bỏ qua khi lưu:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {missingEmps.map(e => (
                      <span key={e.ma_nv} style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 10 }}>
                        {e.ma_nv} · {e.full_name}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                    💡 Vào Danh sách nhân viên → Upload để tạo tài khoản cho các nhân viên này trước.
                  </p>
                </div>
              )}

              {/* Chọn tháng/năm (có thể sửa lại) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.field}>
                  <label style={s.label}>Tháng</label>
                  <select style={s.input} value={month} onChange={e => setMonth(e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Năm</label>
                  <input style={s.input} type="number" value={year} onChange={e => setYear(e.target.value)} />
                </div>
                <div style={s.field}>
  <label style={s.label}>Ghi chú (tùy chọn)</label>
  <input style={s.input} placeholder="VD: Bộ phận May - TAV BN"
    value={note} onChange={e => setNote(e.target.value)} />
</div>
              </div>

              {/* Preview bảng */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  Preview dữ liệu ({rows.filter(r => employees.some(e => e.employee_code === r.ma_nv)).length} nhân viên sẽ được lưu):
                </p>
                <div style={{ overflowX: 'auto', maxHeight: 320, border: '1px solid #f3f4f6', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                      <tr>
                        {['Mã NV', 'Họ tên', 'Tổ', 'Tổng lương', 'Tổng KT', 'Thực lĩnh', 'Ngày công', 'Trạng thái'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const found = employees.some(e => e.employee_code === r.ma_nv)
                        return (
                          <tr key={i} style={{ borderTop: '1px solid #f3f4f6', background: found ? '#fff' : '#fef2f2' }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{r.ma_nv}</td>
                            <td style={{ padding: '6px 10px' }}>{r.full_name}</td>
                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{r.to}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.gross_salary)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(r.tong_khau_tru)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{fmt(r.thuc_linh)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.ngay_cong}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {found
                                ? <span style={{ color: '#16a34a', fontSize: 11 }}>✅ OK</span>
                                : <span style={{ color: '#dc2626', fontSize: 11 }}>❌ Chưa có TK</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && <p style={{ color: '#dc2626', fontSize: 13, background: '#fef2f2', padding: '10px 14px', borderRadius: 7 }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          {step === 'preview' && (
            <button style={{ ...s.cancelBtn, marginRight: 'auto' }}
              onClick={() => { setStep('upload'); setRows([]); setMissingEmps([]); setError('') }}>
              ← Upload lại
            </button>
          )}
          <button style={s.cancelBtn} onClick={onClose}>Hủy</button>
          {step === 'preview' && (
            <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : `💾 Lưu ${rows.filter(r => employees.some(e => e.employee_code === r.ma_nv)).length} phiếu lương`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 700, color: '#111827' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' },
  footer: { padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 500, color: '#374151' },
  input: { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' },
  cancelBtn: { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  saveBtn: { padding: '9px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}