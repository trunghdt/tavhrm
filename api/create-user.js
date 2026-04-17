export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password, role, employeeId } = req.body

  // Tạo user qua Supabase Admin API
  const response = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    return res.status(400).json({ error: data.message })
  }

  const userId = data.id

  // Gán quyền
  const supabaseRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/user_permissions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        role: role || 'employee',
        permissions: getDefaultPermissions(role || 'employee'),
        is_active: true,
        granted_at: new Date().toISOString(),
      }),
    }
  )

// Liên kết employee với user_id
  if (employeeId) {
    const patchRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/employees?id=eq.${employeeId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    )
    const patchData = await patchRes.json()
    console.log('PATCH employees result:', patchRes.status, JSON.stringify(patchData))
    if (!patchRes.ok) {
      console.error('PATCH employees failed:', patchData)
    }
  }

  return res.status(200).json({ success: true, userId })
}

function getDefaultPermissions(role) {
  if (role === 'board_manager') return {
    view_all_employees: true, add_remove_employees: true, edit_employee_profile: true,
    open_evaluation: true, fill_evaluation: true, view_evaluation_results: true,
    approve_evaluation: true, open_salary_review: true, propose_salary: true,
    approve_salary: true, view_payroll: true, view_payslip: true,
    view_salary_history: true, manage_permissions: true,
  }
  if (role === 'hr') return {
    view_all_employees: true, add_remove_employees: true, edit_employee_profile: true,
    open_evaluation: true, view_evaluation_results: true, approve_evaluation: true,
    open_salary_review: true, view_payroll: true, view_payslip: true,
    view_salary_history: true,
  }
  if (role === 'manager') return {
    view_department_employees: true, fill_evaluation: true,
    view_evaluation_results: true, propose_salary: true, view_payslip: true,
  }
  return { view_own_profile: true, view_payslip: true }
}