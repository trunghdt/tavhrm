import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  permissions: null,
  role: null,
  loading: true,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId) => {
    const { data: perms } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    const { data: employee } = await supabase
      .from('employees')
      .select('*, departments(*)')
      .eq('user_id', userId)
      .single()

    set({
      profile: employee,
      permissions: perms?.permissions || {},
      role: perms?.role || 'employee',
    })
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, permissions: null, role: null })
  },
}))