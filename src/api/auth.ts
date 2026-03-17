import { apiClient } from './client'

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthUser {
  accid: string
  subid: string
  username: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials)
    return response.data
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string }> => {
    const response = await apiClient.post<{ accessToken: string }>('/auth/refresh-token', {
      refreshToken,
    })
    return response.data
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  },
}

