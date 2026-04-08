export const ROLES = {
  BOARD_MANAGER: 'board_manager',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
}

export const ROLE_LABELS = {
  board_manager: 'Board Manager',
  hr: 'HR Manager',
  manager: 'Trưởng bộ phận',
  employee: 'Nhân viên',
}

export function hasPermission(permissions, key) {
  if (!permissions) return false
  if (permissions.role === ROLES.BOARD_MANAGER) return true
  return permissions.permissions?.[key] === true
}

export function formatCurrency(amount) {
  if (!amount) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('vi-VN')
}