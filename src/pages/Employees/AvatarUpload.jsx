import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AvatarUpload({ employee, onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(employee.avatar_url || null)
  const [error, setError] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Preview
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    setUploading(true)
    setError('')

    try {
      const ext = file.name.split('.').pop()
      const path = `${employee.id}.${ext}`

      // Upload lên Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      // Lấy public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = data.publicUrl

      // Cập nhật vào bảng employees
      const { error: updateError } = await supabase
        .from('employees')
        .update({ avatar_url: avatarUrl })
        .eq('id', employee.id)

      if (updateError) throw updateError

      onSuccess(avatarUrl)
    } catch (err) {
      setError(err.message)
    }

    setUploading(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.avatarWrapper}>
        {preview ? (
          <img src={preview} alt="avatar" style={styles.avatarImg} />
        ) : (
          <div style={styles.avatarPlaceholder}>
            {employee.full_name?.[0] || '?'}
          </div>
        )}
        <label style={styles.uploadBtn} title="Đổi ảnh">
          📷
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={uploading}
          />
        </label>
      </div>
      {uploading && <p style={styles.uploading}>Đang tải ảnh...</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  avatarWrapper: { position: 'relative', width: 80, height: 80 },
  avatarImg: { width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e5e7eb' },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: '50%', background: '#1a56db',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 28, border: '3px solid #e5e7eb',
  },
  uploadBtn: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26,
    borderRadius: '50%', background: '#fff', border: '2px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  uploading: { fontSize: 12, color: '#6b7280' },
  error: { fontSize: 12, color: '#dc2626' },
}