import { apiClient } from './client'

export type UserProfile = {
  id: number
  accountId: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  company: string | null
  username: string
  fullname: string | null
  role: string | null
  email: string | null
  accid: string
  subid: string
}

export const usersApi = {
  me: async (): Promise<UserProfile> => {
    const resp = await apiClient.get<UserProfile>('/users/me')
    return resp.data
  },
}

