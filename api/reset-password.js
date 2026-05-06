export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId, newEmail, newPassword } = req.body
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' })

  const body = { password: newPassword || 'tav@12345' }
  if (newEmail) body.email = newEmail

  const response = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    }
  )

  const data = await response.json()
  if (!response.ok) return res.status(400).json({ error: data.message })

  return res.status(200).json({ success: true })
}