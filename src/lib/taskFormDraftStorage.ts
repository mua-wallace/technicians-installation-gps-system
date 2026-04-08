import localforage from 'localforage'
import type { InterventionForm } from '../store/useAppStore'

const PREFIX = 'malambi:task-form-drafts:v2'

const draftStore = localforage.createInstance({
  name: 'malambi-technician-app',
  storeName: 'task_form_drafts_v2',
})

export type TaskFormDraftStep = 'FORM' | 'SIGNED_FICHE'

export type TaskFormDraft = {
  draftId: string
  form: InterventionForm
  step: TaskFormDraftStep
  ficheUrl?: string | null
  serverTaskUpdatedAt?: string
  userEdited?: boolean
  createdAt: string
}

function storageKey(userId: number, taskId: string): string {
  return `${PREFIX}:${userId}:${taskId}`
}

// ---------------------------------------------------------------------------
// Async API — stores an array of drafts per (user, task)
// ---------------------------------------------------------------------------

export async function loadAllDraftsAsync(
  userId: number,
  taskId: string,
): Promise<TaskFormDraft[]> {
  try {
    const arr = await draftStore.getItem<TaskFormDraft[]>(storageKey(userId, taskId))
    if (!Array.isArray(arr)) return []
    return arr.filter((d) => d && d.draftId && d.form && (d.step === 'FORM' || d.step === 'SIGNED_FICHE'))
  } catch {
    return []
  }
}

export async function loadDraftByIdAsync(
  userId: number,
  taskId: string,
  draftId: string,
): Promise<TaskFormDraft | null> {
  const all = await loadAllDraftsAsync(userId, taskId)
  return all.find((d) => d.draftId === draftId) ?? null
}

export async function saveDraftAsync(
  userId: number,
  taskId: string,
  draft: TaskFormDraft,
): Promise<void> {
  try {
    const all = await loadAllDraftsAsync(userId, taskId)
    const idx = all.findIndex((d) => d.draftId === draft.draftId)
    if (idx >= 0) {
      all[idx] = draft
    } else {
      all.push(draft)
    }
    await draftStore.setItem(storageKey(userId, taskId), all)
    // Mirror count to localStorage for the sync bucket check
    try {
      localStorage.setItem(storageKey(userId, taskId), String(all.length))
    } catch { /* ignore */ }
  } catch {
    /* quota or private mode */
  }
}

export async function deleteDraftAsync(
  userId: number,
  taskId: string,
  draftId: string,
): Promise<void> {
  try {
    const all = await loadAllDraftsAsync(userId, taskId)
    const filtered = all.filter((d) => d.draftId !== draftId)
    if (filtered.length > 0) {
      await draftStore.setItem(storageKey(userId, taskId), filtered)
      try { localStorage.setItem(storageKey(userId, taskId), String(filtered.length)) } catch { /* ignore */ }
    } else {
      await draftStore.removeItem(storageKey(userId, taskId))
      try { localStorage.removeItem(storageKey(userId, taskId)) } catch { /* ignore */ }
    }
  } catch {
    /* ignore */
  }
}

export async function clearAllDraftsAsync(
  userId: number,
  taskId: string,
): Promise<void> {
  try {
    await draftStore.removeItem(storageKey(userId, taskId))
    try { localStorage.removeItem(storageKey(userId, taskId)) } catch { /* ignore */ }
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Sync helper for TaskApp bucket filter
// ---------------------------------------------------------------------------

export function taskHasLocalFormDraft(userId: number, taskId: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(userId, taskId))
    if (!raw) return false
    const n = Number(raw)
    return Number.isFinite(n) && n > 0
  } catch {
    return false
  }
}

export function draftMatchesCurrentTask(
  draft: TaskFormDraft,
  currentTaskUpdatedAt: string | undefined,
): boolean {
  if (!draft.serverTaskUpdatedAt || !currentTaskUpdatedAt) return true
  return draft.serverTaskUpdatedAt === currentTaskUpdatedAt
}

export function createNewDraftId(): string {
  return crypto.randomUUID()
}
