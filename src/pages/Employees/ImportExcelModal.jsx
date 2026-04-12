import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ImportExcelModal({ onClose, onSuccess }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const reader = new FileReader()
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
        setRows(data)
        setError('')
      }
      reader.readAsBinaryString(file)
    } catch (err) {
      setError('Không thể đọc file: ' + err.message)
    }
  }

const handleImport = async () => {
  if (rows.length === 0) return
  setLoading(true)
  setError('')

  // Fetch tất cả departments để map tên → ID
  const { data: allDepts } = await supabase
    .from('departments')
    .select('*')
    .eq('is_active', true)

    // Tìm chi nhánh
 const findDeptId = (branchName, deptName, teamName) => {
  if (!allDepts || !branchName?.trim()) return null

  // Tìm chi nhánh (không có parent)
  const branch = allDepts.find(d =>
    !d.parent_id &&
    d.name?.toLowerCase().trim() === branchName?.toLowerCase().trim()
  )
  if (!branch) return null
  if (!deptName?.trim()) return branch.id

  // Tìm bộ phận (parent là chi nhánh)
  const dept = allDepts.find(d =>
    d.parent_id === branch.id &&
    d.name?.toLowerCase().trim() === deptName?.toLowerCase().trim()
  )
  if (!dept) return branch.id
  if (!teamName?.trim()) return dept.id

  // Tìm tổ (parent là bộ phận)
  const team = allDepts.find(d =>
    d.parent_id === dept.id &&
    d.name?.toLowerCase().trim() === teamName?.toLowerCase().trim()
  )
  return team?.id || dept.id
}

  const employees = rows.map(r => {
    const branchName = String(r['Chi nhánh'] || '')
    const deptName = String(r['Phòng ban'] || '')
    const teamName = String(r['Tổ'] || '')
    const deptId = findDeptId(branchName, deptName, teamName)

    return {
      employee_code: String(r['Mã nhân viên'] || ''),
      full_name: String(r['Họ tên'] || ''),
      branch: branchName,
      team: teamName,
      position: String(r['Chức vụ'] || 'Nhân viên'),
      phone: String(r['Số điện thoại'] || ''),
      personal_email: String(r['Email'] || ''),
      gender: r['Giới tính'] === 'Nữ' ? 'female' : 'male',
      national_id: String(r['CCCD'] || ''),
      tax_code: String(r['Mã số thuế'] || ''),
      bank_account: String(r['Số TK'] || ''),
      bank_name: String(r['Ngân hàng'] || ''),
      employment_type:
        r['Loại HĐ'] === 'Hợp đồng thử việc' ? 'thu_viec' :
        r['Loại HĐ'] === 'Hợp đồng thời vụ' ? 'thoi_vu' :
        r['Loại HĐ'] === 'Hợp đồng có thời hạn' ? 'co_thoi_han' : 'vo_thoi_han',
      status: r['Trạng thái'] === 'Đã nghỉ' ? 'inactive' : r['Trạng thái'] === 'Thử việc' ? 'probation' : 'active',
      start_date: r['Ngày vào'] || null,
      end_date: r['Ngày nghỉ'] || null,
      address: String(r['Địa chỉ'] || ''),
      department_id: deptId || null,
    }
  }).filter(e => e.employee_code && e.full_name)

  // Import nhân viên
  const { data: inserted, error } = await supabase
    .from('employees')
    .insert(employees)
    .select()

  if (error) {
    setError(error.message)
    setLoading(false)
    return
  }

  // Lưu salary_records cho nhân viên có mức lương
  const salaryRecords = inserted
    .filter(emp => {
      const row = rows.find(r => String(r['Mã nhân viên']) === emp.employee_code)
      return row && Number(row['Mức lương']) > 0
    })
    .map(emp => {
      const row = rows.find(r => String(r['Mã nhân viên']) === emp.employee_code)
      return {
        employee_id: emp.id,
        base_salary: Number(row['Mức lương']),
        salary_type: 'time_based',
        effective_date: emp.start_date || new Date().toISOString().split('T')[0],
        change_reason: 'Lương khởi điểm',
      }
    })

  if (salaryRecords.length > 0) {
    await supabase.from('salary_records').insert(salaryRecords)
  }

  // Tạo tài khoản cho từng nhân viên
  for (const emp of inserted) {
    try {
      await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${emp.employee_code.toLowerCase()}@tavhrm.internal`,
          password: 'tav@12345',
          role: 'employee',
          employeeId: emp.id,
        }),
      })
    } catch (err) {
      console.log('Lỗi tạo tài khoản:', emp.employee_code)
    }
  }

  setDone(true)
  setLoading(false)
}

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
  const template = [{
  'Mã nhân viên': 'NV006',
  'Họ tên': 'Nguyễn Văn A',
  'Chi nhánh': 'TAV BN',
  'Bộ phận': 'Sản xuất',
  'Tổ': 'Chuyền may 1',
  'Số điện thoại': '0901234567',
  'Email': 'a.nv@company.com',
  'Giới tính': 'Nam',
  'CCCD': '001234567890',
  'Mã số thuế': '1234567890',
  'Số TK': '9876543210',
  'Ngân hàng': 'Vietcombank',
  'Loại HĐ': 'Hợp đồng có thời hạn',
  'Trạng thái': 'Đang làm việc',
  'Ngày vào': '2024-01-01',
  'Ngày nghỉ': '',
  'Địa chỉ': '123 Đường ABC, Hà Nội',
  'Mức lương': 10000000,
}]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nhân viên')
    XLSX.writeFile(wb, 'mau_import_nhanvien.xlsx')
  }

  const COLUMNS = ['Mã nhân viên', 'Họ tên', 'Chi nhánh', 'Phòng ban', 'Tổ', 'Chức vụ', 'Số điện thoại', 'Email', 'Giới tính', 'CCCD', 'Mã số thuế', 'Số TK', 'Ngân hàng', 'Loại HĐ', 'Trạng thái', 'Ngày vào', 'Ngày nghỉ', 'Địa chỉ', 'Mức lương']

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>📥 Import nhân viên từ Excel</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {!done ? (
            <>
              <div style={styles.step}>
                <div style={styles.stepNum}>1</div>
                <div style={styles.stepContent}>
                  <p style={styles.stepTitle}>Tải file mẫu Excel</p>
                  <p style={styles.stepSub}>File mẫu gồm các cột: {COLUMNS.join(', ')}</p>
                  <button style={styles.templateBtn} onClick={downloadTemplate}>
                    ⬇ Tải file mẫu (.xlsx)
                  </button>
                </div>
              </div>

              <div style={styles.step}>
                <div style={styles.stepNum}>2</div>
                <div style={styles.stepContent}>
                  <p style={styles.stepTitle}>Upload file Excel đã điền</p>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ padding: '8px 0', fontSize: 14 }} />
                </div>
              </div>

              {rows.length > 0 && (
                <div style={styles.preview}>
                  <p style={styles.previewTitle}>
                    ✅ Đọc được <strong>{rows.length}</strong> nhân viên — xem trước:
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          {COLUMNS.map(k => <th key={k} style={styles.th}>{k}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                            {COLUMNS.map((k, j) => (
                              <td key={j} style={styles.td}>{String(r[k] || '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 5 && (
                      <p style={{ padding: '8px 12px', color: '#6b7280', fontSize: 12 }}>
                        ...và {rows.length - 5} nhân viên nữa
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.actions}>
                <button style={styles.cancelBtn} onClick={onClose}>Hủy</button>
                <button
                  style={{ ...styles.importBtn, opacity: rows.length === 0 ? 0.5 : 1 }}
                  onClick={handleImport}
                  disabled={rows.length === 0 || loading}
                >
                  {loading ? 'Đang import...' : `Import ${rows.length} nhân viên`}
                </button>
              </div>
            </>
          ) : (
            <div style={styles.success}>
              <p style={{ fontSize: 48, marginBottom: 12 }}>🎉</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 20 }}>
                Import thành công {rows.length} nhân viên!
              </p>
              <button style={styles.importBtn} onClick={() => { onSuccess(); onClose() }}>
                Xem danh sách
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, width: 700, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  title: { fontSize: 18, fontWeight: 700, color: '#111827' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  body: { padding: 24 },
  step: { display: 'flex', gap: 16, marginBottom: 24 },
  stepNum: { width: 32, height: 32, borderRadius: '50%', background: '#1a56db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  stepContent: { flex: 1 },
  stepTitle: { fontWeight: 600, color: '#111827', marginBottom: 4 },
  stepSub: { fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.5 },
  templateBtn: { padding: '8px 16px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  preview: { background: '#f9fafb', borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  previewTitle: { padding: '10px 12px', fontSize: 13, color: '#374151' },
  th: { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap', fontSize: 12 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  importBtn: { padding: '10px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  success: { textAlign: 'center', padding: '40px 0' },
}