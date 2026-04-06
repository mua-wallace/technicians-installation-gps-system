import type { InterventionForm } from '../store/useAppStore'

const PREFIX = 'malambi:task-form-draft:v1'

export type TaskFormDraftStep = 'FORM' | 'SIGNED_FICHE'

export type TaskFormDraftPayload = {
  form: InterventionForm
  step: TaskFormDraftStep
  /** Persisted signed-doc URL when already uploaded (not File). */
  ficheUrl?: string | null
  /** Last `task.updatedAt` when this draft was saved — invalidates draft if the task changed on the server. */
  serverTaskUpdatedAt?: string
  /** Set when the user changed the form vs. the loaded baseline (avoids counting autosaved server mirrors). */
  userEdited?: boolean
}

function legacyDraftLooksUserEdited(d: TaskFormDraftPayload): boolean {
  if (d.step === 'SIGNED_FICHE') return true
  if (d.ficheUrl) return true
  const f = d.form
  const textFields = [
    f.immatriculation,
    f.chassis,
    f.observations,
    f.vehicleMakeModel,
    f.odometer,
    f.simNumber,
    f.imsi,
    f.operatorCode,
    f.country,
  ]
  if (textFields.some((s) => typeof s === 'string' && s.trim().length > 0)) return true
  for (const k of Object.keys(f) as Array<keyof InterventionForm>) {
    const v = f[k]
    if (typeof v === 'boolean' && v === true) return true
  }
  return false
}

function storageKey(userId: number, taskId: string): string {
  return `${PREFIX}:${userId}:${taskId}`
}

export function loadTaskFormDraft(userId: number, taskId: string): TaskFormDraftPayload | null {
  try {
    const raw = localStorage.getItem(storageKey(userId, taskId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TaskFormDraftPayload
    if (!parsed || typeof parsed !== 'object' || !parsed.form || typeof parsed.form !== 'object') return null
    if (parsed.step !== 'FORM' && parsed.step !== 'SIGNED_FICHE') return null
    return parsed
  } catch {
    return null
  }
}

export function saveTaskFormDraft(userId: number, taskId: string, payload: TaskFormDraftPayload): void {
  try {
    localStorage.setItem(storageKey(userId, taskId), JSON.stringify(payload))
  } catch {
    /* quota or private mode — ignore */
  }
}

export function clearTaskFormDraft(userId: number, taskId: string): void {
  try {
    localStorage.removeItem(storageKey(userId, taskId))
  } catch {
    /* ignore */
  }
}

/**
 * Restore cached draft only if the task was not updated on the server since we saved
 * (avoids overwriting newer server data after another device/session submitted).
 */
export function draftMatchesCurrentTask(
  draft: TaskFormDraftPayload,
  currentTaskUpdatedAt: string | undefined,
): boolean {
  if (!draft.serverTaskUpdatedAt || !currentTaskUpdatedAt) return true
  return draft.serverTaskUpdatedAt === currentTaskUpdatedAt
}

/** True if there is a local draft that should appear under “Drafts” (user-edited or legacy heuristic). */
export function taskHasLocalFormDraft(userId: number, taskId: string): boolean {
  const d = loadTaskFormDraft(userId, taskId)
  if (!d) return false
  if (d.userEdited === true) return true
  return legacyDraftLooksUserEdited(d)
}
