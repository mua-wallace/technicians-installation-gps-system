import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../api/auth'
import type { UserProfile } from '../api/users'

interface AuthState {
  user: AuthUser | null
  profile: UserProfile | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setProfile: (profile: UserProfile) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },

      setProfile: (profile) => {
        set({ profile })
      },

      clearAuth: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({
          user: null,
          profile: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
    }),
    { name: 'auth-storage' },
  ),
)

