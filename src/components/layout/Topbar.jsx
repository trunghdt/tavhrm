export default function Topbar({ title, user }) {
  return (
    <div style={styles.topbar}>
      <h1 style={styles.title}>{title}</h1>
      <div style={styles.userInfo}>
        <div style={styles.avatar}>
          {user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <span style={styles.email}>{user?.email}</span>
      </div>
    </div>
  )
}

const styles = {
  topbar: {
    height: 60, background: '#fff', borderBottom: '1px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', position: 'fixed', top: 0, left: 220, right: 0, zIndex: 10,
  },
  title: { fontSize: 18, fontWeight: 600, color: '#111827' },
  userInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', background: '#1a56db',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 14,
  },
  email: { fontSize: 13, color: '#6b7280' },
}