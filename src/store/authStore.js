import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  permissions: null,
  loading: true,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setPermissions: (permissions) => set({ permissions }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId) => {
    const { data: employee } = await supabase
      .from('employees')
      .select('*, departments(*)')
      .eq('user_id', userId)
      .single()

    const { data: perms } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    set({ profile: employee, permissions: perms })
    return { employee, perms }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, permissions: null })
  },
}))