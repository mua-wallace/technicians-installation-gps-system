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

export type ClientRow = {
  id: number
  accountId: number
  name: string
  createdAt: string
  updatedAt: string
}

export type ClientVehicleRow = {
  id?: number
  tag?: string | null
  model?: string | null
  vehicleModel?: string | null
  immatriculation?: string | null
  plateNumber?: string | null
  licensePlate?: string | null
  [key: string]: unknown
}

export const usersApi = {
  me: async (): Promise<UserProfile> => {
    const resp = await apiClient.get<UserProfile>('/users/me')
    return resp.data
  },

  list: async (params?: { page?: number; limit?: number; role?: string }): Promise<UserProfile[]> => {
    const resp = await apiClient.get('/users', {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 100,
        role: params?.role,
      },
    })

    const payload = resp.data as UserProfile[] | { data?: UserProfile[] }
    if (Array.isArray(payload)) return payload
    return payload?.data ?? []
  },

  listClients: async (params?: { page?: number; limit?: number }): Promise<ClientRow[]> => {
    const resp = await apiClient.get('/users/clients', {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 2000,
      },
    })

    const payload = resp.data as { data?: ClientRow[] } | { data: ClientRow[] }
    return payload?.data ?? []
  },

  listClientVehicles: async (
    clientId: number,
    params?: { page?: number; limit?: number },
  ): Promise<ClientVehicleRow[]> => {
    const resp = await apiClient.get(`/users/clients/${clientId}/vehicles`, {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 500,
      },
    })

    const payload = resp.data as
      | ClientVehicleRow[]
      | { data?: ClientVehicleRow[]; rows?: ClientVehicleRow[]; success?: boolean; totalCount?: number }

    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.rows)) return payload.rows
    return payload?.data ?? []
  },
}

