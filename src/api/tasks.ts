import { apiClient } from './client'
import type { InterventionForm } from '../store/useAppStore'

export type TaskType = 'INSTALLATION' | 'INTERVENTION'
export type TaskStatus = 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED'

export type TaskAssignment = {
  id?: number
  taskId?: string
  technicianId: number
  accountId?: number
  isLead: boolean
  assignedAt?: string
  technician?: {
    id?: number
    username?: string
    fullname?: string | null
    role?: string | null
  }
}

export type TaskFormRow = InterventionForm & {
  ficheUrl?: string | null
}

export type TaskListItem = {
  id: string
  title: string
  type: TaskType
  status: TaskStatus
  scheduledDate?: string
  createdAt?: string
  updatedAt?: string
  assignments?: TaskAssignment[]
  form?: TaskFormRow & { ficheUrl?: string | null }
}

export type TaskListResponse<T> = {
  data: T[]
  meta?: any
}

function normalizeFicheUrlToRelativeApiPath(ficheUrl: string): string {
  // backend sometimes returns `/api/v1/uploads/...` or an absolute URL.
  const withoutApiPrefix = ficheUrl
    .replace(/^https?:\/\/[^/]+\/api\/v1\/?/, '/')
    .replace(/^\/api\/v1\/?/, '/')

  return withoutApiPrefix.startsWith('/') ? withoutApiPrefix : `/${withoutApiPrefix}`
}

export const tasksApi = {
  listTasks: async (params: {
    page?: number
    limit?: number
    status?: TaskStatus
    type?: TaskType
    search?: string
    include?: string
  }): Promise<TaskListResponse<TaskListItem>> => {
    const resp = await apiClient.get<TaskListResponse<TaskListItem>>('/tasks', {
      params: {
        page: params.page,
        limit: params.limit,
        status: params.status,
        type: params.type,
        search: params.search,
        include: params.include,
      },
    })
    return resp.data
  },

  getTask: async (taskId: string): Promise<{ task: TaskListItem; assignments: TaskAssignment[]; form: TaskFormRow }> => {
    const resp = await apiClient.get(`/tasks/${taskId}`)
    return resp.data
  },

  submitInstallationForm: async (taskId: string, payload: Partial<InterventionForm>) => {
    const resp = await apiClient.patch(`/tasks/${taskId}/installation-form`, payload)
    return resp.data as { task: TaskListItem; assignments: TaskAssignment[]; form: TaskFormRow }
  },

  submitInterventionForm: async (taskId: string, payload: Partial<InterventionForm>) => {
    const resp = await apiClient.patch(`/tasks/${taskId}/intervention-form`, payload)
    return resp.data as { task: TaskListItem; assignments: TaskAssignment[]; form: TaskFormRow }
  },

  uploadSignedFiche: async (taskId: string, file: File, type?: TaskType) => {
    const form = new FormData()
    form.append('file', file)

    const resp = await apiClient.post(`/tasks/${taskId}/forms/signed-snapshot`, form, {
      params: { type },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return resp.data as { taskId: string; type: TaskType; ficheUrl?: string | null }
  },

  fetchSignedFicheBlob: async (ficheUrl: string, config?: any) => {
    const relativePath = normalizeFicheUrlToRelativeApiPath(ficheUrl)

    const r = await apiClient.get(relativePath, {
      responseType: 'blob',
      ...(config ?? {}),
    })
    return r.data as Blob
  },

  updateTaskStatus: async (taskId: string, status: TaskStatus) => {
    const resp = await apiClient.patch(`/tasks/${taskId}/status`, { status })
    return resp.data as { task: TaskListItem; assignments: TaskAssignment[]; form?: TaskFormRow }
  },

  createTask: async (payload: { title: string; type: TaskType; scheduledDate?: string }) => {
    const resp = await apiClient.post('/tasks', payload)
    return resp.data as TaskListItem
  },

  updateTask: async (
    taskId: string,
    payload: Partial<{
      title: string
      type: TaskType
      scheduledDate: string
    }>,
  ) => {
    const resp = await apiClient.patch(`/tasks/${taskId}`, payload)
    return resp.data
  },

  assignTaskTechnicians: async (
    taskId: string,
    technicians: Array<{ technicianId: number; isLead: boolean }>,
  ) => {
    const resp = await apiClient.post(`/tasks/${taskId}/assign`, { technicians })
    return resp.data
  },

  deleteTask: async (taskId: string) => {
    const resp = await apiClient.delete(`/tasks/${taskId}`)
    return resp.data
  },
}

