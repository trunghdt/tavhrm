import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const pageTitles = {
  '/': 'Dashboard',
  '/employees': 'Quản lý nhân viên',
  '/evaluations': 'Đánh giá năng lực',
  '/salary-review': 'Đợt tăng lương',
  '/permissions': 'Phân quyền hệ thống',
}

export default function AppLayout({ user }) {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'TavHRM'

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1 }}>
        <Topbar title={title} user={user} />
        <main style={{ marginTop: 60, padding: 28, minHeight: 'calc(100vh - 60px)', background: '#f5f7fa' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}