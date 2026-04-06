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

/** One installation / intervention form row returned on tasks (e.g. `forms[]` on submitted tasks). */
export type TaskFormInstallation = {
  id: number
  taskId: string
  accountId?: number
  installationIndex?: number | null
  client?: string | null
  vehicleMakeModel?: string | null
  immatriculation?: string | null
  chassis?: string | null
  installerName?: string | null
  date?: string | null
  ficheUrl?: string | null
  createdAt?: string
  updatedAt?: string
  /** Prefer for filtering “my submissions” when present */
  submittedByTechnicianId?: number | null
  createdByTechnicianId?: number | null
  /** When the API sends review workflow fields (camelCase or snake_case). */
  reviewStatus?: string | null
  validationStatus?: string | null
  formStatus?: string | null
}

/** Backend may send snake_case keys; read camelCase or snake_case from a form JSON object. */
function camelKeyToSnakeKey(camelKey: string): string {
  return camelKey.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

export function readTaskFormField(raw: Record<string, unknown>, camelKey: string): unknown {
  if (Object.prototype.hasOwnProperty.call(raw, camelKey)) return raw[camelKey]
  const snake = camelKeyToSnakeKey(camelKey)
  if (Object.prototype.hasOwnProperty.call(raw, snake)) return raw[snake]
  return undefined
}

/** JSON numbers/booleans and empty strings → display string for readonly fiche fields. */
export function formatTaskFormText(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value.trim() || '—'
  return String(value).trim() || '—'
}

export function coerceTaskFormBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase()
    return t === 'true' || t === '1' || t === 'yes' || t === 'oui'
  }
  return false
}

export function filterFormsForViewer(
  forms: TaskFormInstallation[] | undefined,
  opts: {
    isAdmin: boolean
    technicianId: number | null
    fullname?: string | null
    username?: string | null
  },
): TaskFormInstallation[] {
  const list = forms ?? []
  if (opts.isAdmin) return list
  const tid = opts.technicianId
  if (tid == null) return []
  return list.filter((f) => {
    const byId = f.submittedByTechnicianId ?? f.createdByTechnicianId ?? (f as { technicianId?: number }).technicianId
    if (byId != null && typeof byId === 'number') return byId === tid
    const ins = (f.installerName || '').trim().toLowerCase()
    if (!ins) return false
    const fn = (opts.fullname || '').trim().toLowerCase()
    const un = (opts.username || '').trim().toLowerCase()
    return (
      (!!fn && ins === fn) ||
      (!!un && ins === un) ||
      (!!fn && (ins.includes(fn) || fn.includes(ins))) ||
      (!!un && (ins.includes(un) || un.includes(ins)))
    )
  })
}

/**
 * Technician list grouping.
 * - draft: local cached partial form (browser) — see `taskHasLocalFormDraft` in `taskFormDraftStorage`
 * - open: assigned work not finished on the server, no local draft (only listed under “All”)
 */
export type TechnicianTaskBucket = 'draft' | 'submitted' | 'rejected' | 'validated' | 'open'

function normalizeReviewToken(value: unknown): string {
  if (value == null || value === '') return ''
  return String(value).trim().toLowerCase()
}

/** Best-effort read of API review state on a form row. */
export function getFormReviewStatusToken(form: TaskFormInstallation): string {
  const raw = form as Record<string, unknown>
  const candidates = [
    readTaskFormField(raw, 'reviewStatus'),
    readTaskFormField(raw, 'validationStatus'),
    readTaskFormField(raw, 'formStatus'),
    readTaskFormField(raw, 'status'),
    form.reviewStatus,
    form.validationStatus,
    form.formStatus,
  ]
  for (const c of candidates) {
    const t = normalizeReviewToken(c)
    if (t) return t
  }
  return ''
}

export function formLooksRejected(form: TaskFormInstallation): boolean {
  const t = getFormReviewStatusToken(form)
  return (
    t.includes('reject') ||
    t.includes('refus') ||
    t === 'rejected' ||
    t === 'refused' ||
    t === 'declined'
  )
}

/**
 * Classifies a task for the technician dashboard sidebar.
 * - validated: task verified by office
 * - rejected: at least one of the technician’s fiches is marked rejected (when API sends status)
 * - draft: has a user-edited local draft (`hasLocalFormDraft` from caller)
 * - submitted: all planned fiches sent, still awaiting verification
 * - open: not all fiches on the server yet and no local draft (shown under “All” only)
 */
export function getTechnicianTaskBucket(
  task: TaskListItem,
  opts: {
    technicianId: number | null
    fullname?: string | null
    username?: string | null
    /** From `taskHasLocalFormDraft` — partial form cached in the browser for this task. */
    hasLocalFormDraft?: boolean
  },
): TechnicianTaskBucket {
  const visibleForms = filterFormsForViewer(task.forms, {
    isAdmin: false,
    technicianId: opts.technicianId,
    fullname: opts.fullname,
    username: opts.username,
  })
  const planned = Math.max(1, Number(task.numberOfInstallations) || 1)

  if (task.status === 'VERIFIED') return 'validated'

  if (visibleForms.some(formLooksRejected)) return 'rejected'

  if (opts.hasLocalFormDraft) return 'draft'

  if (visibleForms.length < planned) return 'open'

  return 'submitted'
}

export function isTaskAssignedToTechnician(task: TaskListItem, technicianId: number | null): boolean {
  if (technicianId == null) return false
  return (task.assignments ?? []).some((a) => a.technicianId === technicianId)
}

/** Create: POST `/tasks/installation-form` or `/tasks/intervention-form` with `taskId` in JSON (per API). */
export type InstallationFormSubmitPayload = InterventionForm & {
  taskId: string
  ficheUrl: string
  date: string
}

/** PATCH body must not repeat `taskId` in JSON when using `/tasks/:id/...`. */
export type InstallationFormPatchPayload = Partial<Omit<InstallationFormSubmitPayload, 'taskId'>>

export type TaskListItem = {
  id: string
  client: string
  numberOfInstallations?: number
  typeEquipment?: string
  equipmentMake?: string
  equipmentModel?: string
  equipmentVersion?: string
  type: TaskType
  status: TaskStatus
  scheduledDate?: string
  createdAt?: string
  updatedAt?: string
  assignments?: TaskAssignment[]
  form?: TaskFormRow & { ficheUrl?: string | null }
  /** Present on `GET /tasks/submitted` and when task detail includes `forms`. */
  forms?: TaskFormInstallation[]
}

export type TaskCreatePayload = {
  client: string
  numberOfInstallations: number
  typeEquipment: string
  equipmentMake: string
  equipmentModel: string
  equipmentVersion?: string
  type: TaskType
  scheduledDate?: string
}

export type TaskUpdatePayload = Partial<Omit<TaskCreatePayload, 'type'>>

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

  /** Tasks with submitted forms (includes `forms[]` per task when API returns them). */
  listTasksSubmitted: async (params: {
    page?: number
    limit?: number
    status?: TaskStatus
    type?: TaskType
    search?: string
    include?: string
  }): Promise<TaskListResponse<TaskListItem>> => {
    const resp = await apiClient.get<TaskListResponse<TaskListItem>>('/tasks/submitted', {
      params: {
        page: params.page,
        limit: params.limit,
        status: params.status,
        type: params.type,
        search: params.search,
        include: params.include ?? 'assignments,technicians,forms',
      },
    })
    return resp.data
  },

  getTask: async (taskId: string): Promise<{
    task: TaskListItem
    assignments: TaskAssignment[]
    form: TaskFormRow
    forms?: TaskFormInstallation[]
  }> => {
    const resp = await apiClient.get(`/tasks/${taskId}`, {
      params: { include: 'forms,assignments,technicians' },
    })
    return resp.data
  },

  submitInstallationForm: async (payload: InstallationFormSubmitPayload) => {
    const resp = await apiClient.post('/tasks/installation-form', payload)
    return resp.data as { task: TaskListItem; assignments: TaskAssignment[]; form: TaskFormRow }
  },

  submitInterventionForm: async (payload: InstallationFormSubmitPayload) => {
    const resp = await apiClient.post('/tasks/intervention-form', payload)
    return resp.data as { task: TaskListItem; assignments: TaskAssignment[]; form: TaskFormRow }
  },

  updateInstallationForm: async (taskId: string, payload: InstallationFormPatchPayload) => {
    const resp = await apiClient.patch(`/tasks/${taskId}/installation-form`, payload)
    return resp.data as { task: TaskListItem; assignments: TaskAssignment[]; form: TaskFormRow }
  },

  updateInterventionForm: async (taskId: string, payload: InstallationFormPatchPayload) => {
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

  createTask: async (payload: TaskCreatePayload) => {
    const resp = await apiClient.post('/tasks', payload)
    return resp.data as TaskListItem
  },

  updateTask: async (taskId: string, payload: TaskUpdatePayload) => {
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

