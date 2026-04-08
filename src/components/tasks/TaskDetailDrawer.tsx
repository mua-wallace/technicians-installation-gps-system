import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { TaskAssignment, TaskFormRow, TaskStatus, TaskType } from '../../api/tasks'
import { tasksApi, type InstallationFormPatchPayload, type InstallationFormSubmitPayload } from '../../api/tasks'
import type { InterventionForm } from '../../store/useAppStore'
import { usersApi } from '../../api/users'
import type { ClientRow } from '../../api/users'
import type { ClientVehicleRow } from '../../api/users'
import { useI18n } from '../../i18n/I18nContext'
import {
  createNewDraftId,
  deleteDraftAsync,
  draftMatchesCurrentTask,
  loadAllDraftsAsync,
  saveDraftAsync,
  type TaskFormDraft,
} from '../../lib/taskFormDraftStorage'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TaskSubmittedFormsCollapsible } from './TaskSubmittedFormsCollapsible'

const DEFAULT_FORM: InterventionForm = {
  client: '',
  vehicleMakeModel: '',
  immatriculation: '',
  year: '',
  odometer: '',
  chassis: '',
  operatorCode: '',
  country: '',
  simNumber: '',
  imsi: '',
  antivol: false,
  geolocation: false,
  fleetManagement: false,
  otherOption: false,
  camera: false,
  alarm: false,
  buzzer: false,
  canClick: false,
  alimentationRed: false,
  alimentationYellow: false,
  acc: false,
  immobilisationCable: false,
  fuelGauge: false,
  canH: false,
  canL: false,
  observations: '',
  battery12vOk: false,
  kitGpsConnected: false,
  engineStartsWell: false,
  dashboardDefaults: false,
  buttonsDefaults: false,
  climRadioDefaults: false,
  installerName: '',
  date: '',
}

type Props = {
  taskId: string
  open: boolean
  currentUserId: number | null
  installerDefaultName: string
  onClose: () => void
  onTaskDeleted?: (taskId: string) => void
  onTaskUpdated?: (taskId: string) => void
  isAdmin: boolean
  /** Used with “my submissions” filter (matches `installerName` when API has no technician id on form). */
  viewerUsername?: string
  /** Incremented when opening from “Ajouter une fiche” in the task list — forces step 1 (formulaire). */
  taskFormIntentNonce?: number
}

type Step = 'FORM' | 'SIGNED_FICHE'

function formatInputDate(dateValue: string | undefined | null) {
  if (!dateValue) return ''
  // Keep YYYY-MM-DD if already formatted.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isoToDatetimeLocalInput(value?: string | null): string {
  if (!value) return ''
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const min = String(dt.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function datetimeLocalToIso(value: string): string | undefined {
  if (!value) return undefined
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return undefined

  const [y, m, d] = datePart.split('-').map((n) => Number(n))
  const timePieces = timePart.split(':').map((n) => Number(n))
  const [hh, mm, ss = 0] = [timePieces[0] ?? 0, timePieces[1] ?? 0, timePieces[2] ?? 0]

  if (![y, m, d, hh, mm, ss].every((n) => Number.isFinite(n))) return undefined

  const localDt = new Date(y, m - 1, d, hh, mm, ss, 0)
  return Number.isNaN(localDt.getTime()) ? undefined : localDt.toISOString()
}

function getLocalCurrentYearString(): string {
  return String(new Date().getFullYear())
}

function getLocalTodayInputValue(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getVehicleTagLabel(v: ClientVehicleRow): string {
  return String(v.tag ?? v.immatriculation ?? v.plateNumber ?? v.licensePlate ?? '').trim()
}

function getClientLabel(c: ClientRow): string {
  return String(c.name ?? c.fullname ?? c.company ?? c.username ?? '').trim()
}

function getVehicleModelLabel(v: ClientVehicleRow): string {
  return String(v.model ?? v.vehicleModel ?? '').trim()
}

function getVehicleCarrierLabel(v: ClientVehicleRow): string {
  return String(v.carrier ?? '').trim()
}

function getVehicleImsiLabel(v: ClientVehicleRow): string {
  return String(v.imsi ?? '').trim()
}

function getVehicleCountryLabel(v: ClientVehicleRow): string {
  return String(v.country ?? '').trim()
}

function sanitizeFormPayload(input: Partial<InterventionForm>): Partial<InterventionForm> {
  const result: Partial<InterventionForm> = {}
  const allowedKeys = Object.keys(DEFAULT_FORM) as Array<keyof InterventionForm>
  for (const key of allowedKeys) {
    const rawValue = (input as any)[key]
    if (rawValue === null || rawValue === undefined) continue
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim()
      if (!trimmed) continue
      ;(result as any)[key] = trimmed
      continue
    }
    ;(result as any)[key] = rawValue
  }
  return result
}

export function TaskDetailDrawer({
  taskId,
  open,
  currentUserId,
  installerDefaultName,
  onClose,
  onTaskDeleted,
  onTaskUpdated,
  isAdmin,
  viewerUsername = '',
  taskFormIntentNonce = 0,
}: Props) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('FORM')
  const [taskType, setTaskType] = useState<TaskType>('INSTALLATION')
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('ASSIGNED')

  const [form, setForm] = useState<InterventionForm>(DEFAULT_FORM)
  const [ficheUrl, setFicheUrl] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  /** Blob URL from API, or direct https URL (e.g. Cloudinary) for the signed fiche preview */
  const [fichePreviewSrc, setFichePreviewSrc] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string>('')
  const [localFilePreviewSrc, setLocalFilePreviewSrc] = useState<string | null>(null)
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')
  const [submittingForm, setSubmittingForm] = useState(false)
  const [deleteError, setDeleteError] = useState<string>('')
  const [deletingTask, setDeletingTask] = useState(false)
  const [editClient, setEditClient] = useState('')
  const [editNumberOfInstallations, setEditNumberOfInstallations] = useState<number>(1)
  const [editTypeEquipment, setEditTypeEquipment] = useState('')
  const [editEquipmentMake, setEditEquipmentMake] = useState('')
  const [editEquipmentModel, setEditEquipmentModel] = useState('')
  const [editEquipmentVersion, setEditEquipmentVersion] = useState('')
  const [editType, setEditType] = useState<TaskType>('INSTALLATION')
  const [editScheduled, setEditScheduled] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [taskSaveError, setTaskSaveError] = useState('')
  const [editClientSearch, setEditClientSearch] = useState('')
  const [editClientDropdownOpen, setEditClientDropdownOpen] = useState(false)
  const [editClientTouched, setEditClientTouched] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignLeadId, setReassignLeadId] = useState<number | null>(null)
  const [reassignAssistantIds, setReassignAssistantIds] = useState<number[]>([])
  const [techSearch, setTechSearch] = useState('')
  const [reassignBusy, setReassignBusy] = useState(false)
  const [reassignError, setReassignError] = useState('')
  const [reassignTechniciansOpen, setReassignTechniciansOpen] = useState(false)
  const [startConfirmOpen, setStartConfirmOpen] = useState(false)
  const [startAnchorRect, setStartAnchorRect] = useState<{
    top: number
    left: number
    right: number
    bottom: number
    width: number
    height: number
  } | null>(null)

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [immatSearch, setImmatSearch] = useState('')
  const [immatDropdownOpen, setImmatDropdownOpen] = useState(false)
  const [vehicleManualMode, setVehicleManualMode] = useState(false)
  /** All saved drafts for this task (loaded from async storage). */
  const [allDrafts, setAllDrafts] = useState<TaskFormDraft[]>([])
  /** The draft currently being edited. null = fresh form (not yet saved as draft). */
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const signedFicheInputId = useId()
  const suppressDraftSaveUntilRef = useRef(0)
  const formDraftBaselineRef = useRef<string | null>(null)
  /** Prevent accidental double-submit (fast double click / re-render). */
  const submitInFlightRef = useRef(false)

  const taskQuery = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getTask(taskId),
    enabled: open && !!taskId,
  })

  const assignments: TaskAssignment[] = useMemo(() => taskQuery.data?.assignments ?? [], [taskQuery.data])
  const hasExistingFiche = Boolean(taskQuery.data?.form?.ficheUrl || ficheUrl)
  const assignedTechnicianNames = useMemo(() => {
    if (!assignments.length) return '—'
    const sorted = [...assignments].sort((a, b) => Number(b.isLead) - Number(a.isLead))
    const names = sorted
      .map((a) => a.technician?.fullname || a.technician?.username || (a.technicianId ? `#${a.technicianId}` : ''))
      .filter(Boolean)
    return names.length ? names.join(', ') : '—'
  }, [assignments])

  const isTechnicianAssigned = useMemo(() => {
    if (!currentUserId) return false
    return assignments.some((a) => a.technicianId === currentUserId)
  }, [assignments, currentUserId])

  const isFinalizedTask = useMemo(() => {
    return isAdmin && (taskStatus === 'COMPLETED' || taskStatus === 'VERIFIED')
  }, [isAdmin, taskStatus])

  useEffect(() => {
    if (!taskQuery.data) return
    if (taskQuery.data.task?.id !== taskId) return

    const tType = taskQuery.data.task?.type ?? 'INSTALLATION'
    setTaskType(tType)
    setTaskStatus(taskQuery.data.task?.status ?? 'ASSIGNED')
    setEditClient(taskQuery.data.task?.client ?? '')
    setEditNumberOfInstallations(Number(taskQuery.data.task?.numberOfInstallations ?? 1))
    setEditTypeEquipment(taskQuery.data.task?.typeEquipment ?? '')
    setEditEquipmentMake(taskQuery.data.task?.equipmentMake ?? '')
    setEditEquipmentModel(taskQuery.data.task?.equipmentModel ?? '')
    setEditEquipmentVersion(taskQuery.data.task?.equipmentVersion ?? '')
    setEditType(tType)
    setEditScheduled(isoToDatetimeLocalInput(taskQuery.data.task?.scheduledDate))
    setTaskSaveError('')
    setEditClientSearch(taskQuery.data.task?.client ?? '')
    setEditClientTouched(false)
    setEditClientDropdownOpen(false)

    const initialAssignments = taskQuery.data.assignments ?? []
    const lead = initialAssignments.find((a) => a.isLead)?.technicianId ?? null
    const assistants = initialAssignments.filter((a) => !a.isLead).map((a) => a.technicianId)
    setReassignLeadId(lead)
    setReassignAssistantIds(assistants)
    setTechSearch('')
    setReassignError('')
    setReassignTechniciansOpen(false)

    const backendForm = taskQuery.data.form as TaskFormRow | undefined
    const baseForm = { ...DEFAULT_FORM, ...(backendForm ?? {}) } as InterventionForm
    baseForm.date = formatInputDate(baseForm.date)
    if (!baseForm.client) baseForm.client = taskQuery.data.task?.client ?? ''
    if (!baseForm.year) baseForm.year = getLocalCurrentYearString()
    if (!baseForm.date) baseForm.date = getLocalTodayInputValue()
    if (!baseForm.installerName) baseForm.installerName = installerDefaultName

    const baseStep: Step = backendForm?.ficheUrl ? 'SIGNED_FICHE' : 'FORM'
    const baseFicheUrl: string | null = backendForm?.ficheUrl ?? null

    // Apply form state to the UI
    const applyFormState = (nextForm: InterventionForm, nextStep: Step, nextFicheUrl: string | null) => {
      const finalStep = !isAdmin && taskFormIntentNonce > 0 ? 'FORM' : nextStep
      formDraftBaselineRef.current = JSON.stringify({ form: nextForm, step: finalStep, ficheUrl: nextFicheUrl })
      setForm(nextForm)
      setSelectedClientId(null)
      setImmatSearch(nextForm.immatriculation ?? '')
      setImmatDropdownOpen(false)
      setVehicleManualMode(false)
      setFicheUrl(nextFicheUrl)
      setStep(finalStep)
      setSelectedFile(null)
      setPreviewError('')
    }

    // Set server/blank state first
    applyFormState(baseForm, baseStep, baseFicheUrl)
    setActiveDraftId(null)

    // When "Add Fiche" is clicked (nonce > 0), create a fresh draft id immediately
    if (!isAdmin && taskFormIntentNonce > 0) {
      setActiveDraftId(createNewDraftId())
    }

    // Load all drafts from async storage
    const uid = currentUserId
    const assigned = uid != null && initialAssignments.some((a) => a.technicianId === uid)
    let cancelled = false
    if (!isAdmin && uid != null && assigned) {
      loadAllDraftsAsync(uid, taskId).then((drafts) => {
        if (cancelled) return
        const taskUpdatedAt = taskQuery.data?.task?.updatedAt
        // Filter out stale drafts
        const valid = drafts.filter((d) => draftMatchesCurrentTask(d, taskUpdatedAt))
        setAllDrafts(valid)
      })
    } else {
      setAllDrafts([])
    }

    return () => { cancelled = true }
  }, [taskQuery.data, taskId, isAdmin, currentUserId, installerDefaultName, taskFormIntentNonce])

  const initialEdit = useMemo(() => {
    const t = taskQuery.data?.task
    return {
      client: (t?.client ?? '').trim(),
      numberOfInstallations: Number(t?.numberOfInstallations ?? 1),
      typeEquipment: (t?.typeEquipment ?? '').trim(),
      equipmentMake: (t?.equipmentMake ?? '').trim(),
      equipmentModel: (t?.equipmentModel ?? '').trim(),
      equipmentVersion: (t?.equipmentVersion ?? '').trim(),
      type: (t?.type ?? 'INSTALLATION') as TaskType,
      scheduled: isoToDatetimeLocalInput(t?.scheduledDate),
    }
  }, [
    taskQuery.data?.task?.client,
    taskQuery.data?.task?.numberOfInstallations,
    taskQuery.data?.task?.typeEquipment,
    taskQuery.data?.task?.equipmentMake,
    taskQuery.data?.task?.equipmentModel,
    taskQuery.data?.task?.equipmentVersion,
    taskQuery.data?.task?.type,
    taskQuery.data?.task?.scheduledDate,
  ])

  const isTaskDirty = useMemo(() => {
    return (
      editClient.trim() !== initialEdit.client ||
      Number(editNumberOfInstallations || 0) !== initialEdit.numberOfInstallations ||
      editTypeEquipment.trim() !== initialEdit.typeEquipment ||
      editEquipmentMake.trim() !== initialEdit.equipmentMake ||
      editEquipmentModel.trim() !== initialEdit.equipmentModel ||
      editEquipmentVersion.trim() !== initialEdit.equipmentVersion ||
      editType !== initialEdit.type ||
      editScheduled !== initialEdit.scheduled
    )
  }, [
    editClient,
    editNumberOfInstallations,
    editTypeEquipment,
    editEquipmentMake,
    editEquipmentModel,
    editEquipmentVersion,
    editType,
    editScheduled,
    initialEdit,
  ])

  const techniciansQuery = useQuery({
    queryKey: ['users', 'list', 'techniciens'],
    queryFn: () => usersApi.list({ role: 'technicien', page: 1, limit: 200 }),
    enabled: open && isAdmin,
    staleTime: 60_000,
  })

  const technicianOptions = techniciansQuery.data ?? []

  const filteredTechnicians = useMemo(() => {
    const q = techSearch.trim().toLowerCase()
    if (!q) return technicianOptions
    return technicianOptions.filter((t) => {
      const fullname = (t.fullname ?? '').toLowerCase()
      const username = (t.username ?? '').toLowerCase()
      const id = String(t.id)
      return fullname.includes(q) || username.includes(q) || id.includes(q)
    })
  }, [technicianOptions, techSearch])

  const clientsQuery = useQuery({
    queryKey: ['clients', 1, 2000],
    queryFn: () => usersApi.listClients({ page: 1, limit: 2000 }),
    enabled: open && (step === 'FORM' || isAdmin),
    staleTime: 10 * 60_000,
  })

  const clientOptions: ClientRow[] = clientsQuery.data ?? []

  // Technician UX: client must come from the task and cannot be changed.
  // We still need a clientId to load vehicles, so we resolve it from the clients list when possible.
  useEffect(() => {
    if (isAdmin) return
    if (!open || step !== 'FORM') return
    if (selectedClientId) return
    const label = String(taskQuery.data?.task?.client ?? form.client ?? '').trim()
    if (!label) return
    const match =
      clientOptions.find((c) => getClientLabel(c).trim().toLowerCase() === label.toLowerCase()) ??
      clientOptions.find((c) => getClientLabel(c).trim().toLowerCase().includes(label.toLowerCase()))
    if (!match) return
    setSelectedClientId(match.id)
  }, [isAdmin, open, step, selectedClientId, taskQuery.data?.task?.client, form.client, clientOptions])

  const filteredEditClients = useMemo(() => {
    const q = (editClientSearch ?? '').trim().toLowerCase()
    const base = clientOptions.filter((c) => getClientLabel(c))
    if (!q) return base.slice(0, 30)
    return base.filter((c) => getClientLabel(c).toLowerCase().includes(q)).slice(0, 30)
  }, [clientOptions, editClientSearch])

  const vehiclesQuery = useQuery({
    queryKey: ['client-vehicles', selectedClientId],
    queryFn: () => usersApi.listClientVehicles(selectedClientId as number, { page: 1, limit: 2000 }),
    enabled: open && step === 'FORM' && !!selectedClientId,
    staleTime: 5 * 60_000,
  })

  const vehicleOptions: ClientVehicleRow[] = vehiclesQuery.data ?? []

  const filteredVehicles = useMemo(() => {
    const q = (immatSearch ?? '').trim().toLowerCase()
    if (!q) return vehicleOptions.slice(0, 30)
    return vehicleOptions.filter((v) => getVehicleTagLabel(v).toLowerCase().includes(q)).slice(0, 30)
  }, [vehicleOptions, immatSearch])

  useEffect(() => {
    if (!ficheUrl) {
      setFichePreviewSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    let cancelled = false
    setPreviewError('')

    // Cloudinary and other CDNs: use the URL as-is (no blob fetch via our API).
    const isHttpUrl = /^https?:\/\//i.test(ficheUrl.trim())
    if (isHttpUrl) {
      setFichePreviewSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return ficheUrl.trim()
      })
      return () => {
        cancelled = true
      }
    }

    tasksApi
      .fetchSignedFicheBlob(ficheUrl)
      .then((blob) => {
        if (cancelled) return
        const objectUrl = URL.createObjectURL(blob)
        setFichePreviewSrc((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
          return objectUrl
        })
      })
      .catch((e) => {
        if (cancelled) return
        setFichePreviewSrc(null)
        setPreviewError(e?.message ?? 'Failed to load preview')
      })

    return () => {
      cancelled = true
    }
  }, [ficheUrl])

  useEffect(() => {
    setLocalFilePreviewSrc((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    if (!selectedFile) return
    const objectUrl = URL.createObjectURL(selectedFile)
    setLocalFilePreviewSrc(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile])

  const isBusy = taskQuery.isFetching

  const onFormChange = <K extends keyof InterventionForm>(key: K, value: InterventionForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /** Auto-save active draft to async storage on changes. */
  useEffect(() => {
    if (!open || isAdmin || !currentUserId) return
    if (!taskQuery.data?.task || taskQuery.data.task.id !== taskId) return
    const assignments = taskQuery.data.assignments ?? []
    if (!assignments.some((a) => a.technicianId === currentUserId)) return

    const taskUpdatedAt = taskQuery.data.task.updatedAt
    const t = window.setTimeout(() => {
      if (Date.now() < suppressDraftSaveUntilRef.current) return
      const snap = JSON.stringify({ form, step, ficheUrl: ficheUrl ?? null })
      if (snap === formDraftBaselineRef.current) return
      // Ensure we have a draft id
      const draftId = activeDraftId ?? createNewDraftId()
      if (!activeDraftId) setActiveDraftId(draftId)
      const draft: TaskFormDraft = {
        draftId,
        form,
        step,
        ficheUrl: ficheUrl ?? undefined,
        serverTaskUpdatedAt: taskUpdatedAt,
        userEdited: true,
        createdAt: allDrafts.find((d) => d.draftId === draftId)?.createdAt ?? new Date().toISOString(),
      }
      saveDraftAsync(currentUserId, taskId, draft).then(() => {
        // Keep allDrafts in sync
        setAllDrafts((prev) => {
          const idx = prev.findIndex((d) => d.draftId === draftId)
          if (idx >= 0) { const next = [...prev]; next[idx] = draft; return next }
          return [...prev, draft]
        })
      })
    }, 500)
    return () => window.clearTimeout(t)
  }, [
    open,
    isAdmin,
    currentUserId,
    taskId,
    form,
    step,
    ficheUrl,
    activeDraftId,
    taskQuery.data?.task?.id,
    taskQuery.data?.task?.updatedAt,
    taskQuery.data?.assignments,
  ])

  const handleSubmitForm = async () => {
    if (!taskQuery.data) return
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true
    setSubmitError('')
    try {
      setSubmittingForm(true)

      // We need either an already-uploaded ficheUrl or a file to upload.
      if (!ficheUrl && !selectedFile) {
        setSubmitError('Veuillez ajouter la fiche signée avant de créer la fiche.')
        return
      }

      const payload: any = sanitizeFormPayload({
        ...form,
        date: formatInputDate(form.date),
      })

      const effectiveType = (taskQuery.data?.task?.type ?? taskType) as TaskType

      console.log('[SUBMIT] === Form submission started ===')
      console.log('[SUBMIT] taskId:', taskId)
      console.log('[SUBMIT] effectiveType:', effectiveType)
      console.log('[SUBMIT] hasExistingFiche:', hasExistingFiche)
      console.log('[SUBMIT] ficheUrl (state):', ficheUrl)
      console.log('[SUBMIT] selectedFile:', selectedFile?.name ?? null)

      // Step 1: Upload the signed fiche to Cloudinary FIRST.
      // If the upload fails, abort — do not create/update the form.
      let resolvedFicheUrl = ficheUrl
      if (selectedFile) {
        console.log('[SUBMIT] Step 1: Uploading file to Cloudinary...')
        const uploadResp = await tasksApi.uploadSignedFiche(taskId, selectedFile, effectiveType)
        console.log('[SUBMIT] Step 1: Upload response:', JSON.stringify(uploadResp))
        resolvedFicheUrl = uploadResp?.ficheUrl ?? null
        if (!resolvedFicheUrl) {
          console.error('[SUBMIT] Step 1: Upload failed — no ficheUrl returned. Aborting.')
          setSubmitError('Échec du téléversement de la fiche signée. Veuillez réessayer.')
          return
        }
        setSelectedFile(null)
        setFicheUrl(resolvedFicheUrl)
      }
      console.log('[SUBMIT] resolvedFicheUrl:', resolvedFicheUrl)

      // Step 2: Submit the form with the Cloudinary ficheUrl.
      const submitPayload: InstallationFormSubmitPayload = {
        ...(payload as InterventionForm),
        taskId,
        client: taskQuery.data?.task?.client ?? form.client ?? '',
        date: formatInputDate(form.date) || getLocalTodayInputValue(),
        ficheUrl: resolvedFicheUrl ?? '',
      }

      const { taskId: _omitTaskId, ...patchPayload } = submitPayload
      const patchBody = patchPayload as InstallationFormPatchPayload

      const shouldUpdate = hasExistingFiche
      console.log('[SUBMIT] Step 2: shouldUpdate:', shouldUpdate)
      console.log('[SUBMIT] Step 2: submitPayload:', JSON.stringify(submitPayload, null, 2))

      const resp = shouldUpdate
        ? effectiveType === 'INTERVENTION'
          ? await tasksApi.updateInterventionForm(taskId, patchBody)
          : await tasksApi.updateInstallationForm(taskId, patchBody)
        : effectiveType === 'INTERVENTION'
          ? await tasksApi.submitInterventionForm(submitPayload)
          : await tasksApi.submitInstallationForm(submitPayload)

      console.log('[SUBMIT] Step 2: Form response:', JSON.stringify(resp, null, 2))

      const nextFicheUrl = resp?.form?.ficheUrl ?? resolvedFicheUrl
      if (nextFicheUrl) setFicheUrl(nextFicheUrl)
      console.log('[SUBMIT] === Form submission completed ===')
      setStep('SIGNED_FICHE')
      const nextStatus = resp?.task?.status ?? taskStatus
      // Backend handles status updates as part of form creation/submission.
      setTaskStatus(nextStatus)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      onTaskUpdated?.(taskId)
      if (currentUserId && activeDraftId) {
        deleteDraftAsync(currentUserId, taskId, activeDraftId).then(() => {
          setAllDrafts((prev) => prev.filter((d) => d.draftId !== activeDraftId))
        })
        setActiveDraftId(null)
      }
      onClose()
    } catch (e: any) {
      const backendMsg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.message ??
        "Échec d'enregistrement de la fiche."
      const formatted = Array.isArray(backendMsg) ? backendMsg.join(', ') : String(backendMsg)
      setSubmitError(formatted)
    } finally {
      setSubmittingForm(false)
      submitInFlightRef.current = false
    }
  }

  const ficheExt = useMemo(() => {
    if (!ficheUrl) return ''
    const last = ficheUrl.split('/').pop() ?? ''
    const dot = last.lastIndexOf('.')
    if (dot === -1) return ''
    return last.slice(dot + 1).toLowerCase()
  }, [ficheUrl])

  const canUpdateStatus = isAdmin || isTechnicianAssigned // optional step for assigned technicians

  const handleUpdateStatus = async (next: TaskStatus) => {
    const resp = await tasksApi.updateTaskStatus(taskId, next)
    setTaskStatus(resp?.task?.status ?? next)
    if (resp?.form?.ficheUrl) setFicheUrl(resp.form.ficheUrl ?? null)
    onTaskUpdated?.(taskId)
  }

  const startTypeLabel = taskType === 'INSTALLATION' ? 'Installation' : 'Intervention'

  const handleSaveTaskEdits = async () => {
    if (!taskQuery.data) return
    try {
      setTaskSaveError('')
      setSavingTask(true)
      const payload: Record<string, any> = {}
      if (editClient.trim() !== initialEdit.client) payload.client = editClient.trim()
      if (Number(editNumberOfInstallations || 0) !== initialEdit.numberOfInstallations) {
        payload.numberOfInstallations = Math.max(1, Number(editNumberOfInstallations || 1))
      }
      if (editTypeEquipment.trim() !== initialEdit.typeEquipment) payload.typeEquipment = editTypeEquipment.trim()
      if (editEquipmentMake.trim() !== initialEdit.equipmentMake) payload.equipmentMake = editEquipmentMake.trim()
      if (editEquipmentModel.trim() !== initialEdit.equipmentModel) payload.equipmentModel = editEquipmentModel.trim()
      if (editEquipmentVersion.trim() !== initialEdit.equipmentVersion) {
        payload.equipmentVersion = editEquipmentVersion.trim() || undefined
      }
      // Backend rejects `type` on PATCH /tasks/:id (it returns: "property type should not exist")
      // so we intentionally never send it from the UI.
      if (editScheduled !== initialEdit.scheduled) payload.scheduledDate = datetimeLocalToIso(editScheduled) || undefined

      await tasksApi.updateTask(taskId, payload)
      await taskQuery.refetch()
      onTaskUpdated?.(taskId)
      onClose()
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Failed to update task.'
      setTaskSaveError(Array.isArray(msg) ? msg.join(', ') : String(msg))
    } finally {
      setSavingTask(false)
    }
  }

  const handleSaveReassign = async () => {
    if (!isAdmin) return
    try {
      setReassignError('')
      setReassignBusy(true)
      const technicians = reassignLeadId
        ? [
            { technicianId: reassignLeadId, isLead: true },
            ...reassignAssistantIds
              .filter((id) => id !== reassignLeadId)
              .map((id) => ({ technicianId: id, isLead: false })),
          ]
        : []

      // If backend supports "unassign all", sending [] will clear. If not, backend will return 4xx and we surface it.
      await tasksApi.assignTaskTechnicians(taskId, technicians)
      await taskQuery.refetch()
      onTaskUpdated?.(taskId)
      setReassignOpen(false)
      onClose()
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Failed to re-assign technicians.'
      setReassignError(Array.isArray(msg) ? msg.join(', ') : String(msg))
    } finally {
      setReassignBusy(false)
    }
  }

  const handleDeleteTask = async () => {
    const label = taskQuery.data?.task?.client ?? 'this task'
    const ok = window.confirm(`Delete "${label}"? This action cannot be undone.`)
    if (!ok) return
    try {
      setDeleteError('')
      setDeletingTask(true)
      await tasksApi.deleteTask(taskId)
      onTaskDeleted?.(taskId)
      onClose()
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Failed to delete task.'
      setDeleteError(Array.isArray(msg) ? msg.join(', ') : String(msg))
    } finally {
      setDeletingTask(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-30 flex">
      <button type="button" className="animate-fade-in h-full w-full bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-slide-in-right flex h-full w-full max-w-7xl flex-col bg-slate-50 text-slate-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {taskQuery.data?.task?.client ?? t('drawer.task')}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {Number.isFinite(taskQuery.data?.task?.numberOfInstallations as any)
                  ? `${taskQuery.data?.task?.numberOfInstallations} install${taskQuery.data?.task?.numberOfInstallations === 1 ? '' : 's'}`
                  : '— installs'}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                taskType === 'INSTALLATION'
                  ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'
                  : 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200'
              }`}>
                {taskType === 'INSTALLATION' ? 'Installation' : 'Intervention'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                taskStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                  : taskStatus === 'VERIFIED' ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-200'
                  : taskStatus === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                  : taskStatus === 'ASSIGNED' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                  : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  taskStatus === 'COMPLETED' ? 'bg-emerald-400'
                    : taskStatus === 'VERIFIED' ? 'bg-sky-400'
                    : taskStatus === 'IN_PROGRESS' ? 'bg-amber-400'
                    : taskStatus === 'ASSIGNED' ? 'bg-blue-400'
                    : 'bg-slate-400'
                }`} />
                {taskStatus === 'IN_PROGRESS' ? 'In Progress'
                  : taskStatus === 'COMPLETED' ? 'Completed'
                  : taskStatus === 'VERIFIED' ? 'Verified'
                  : taskStatus === 'ASSIGNED' ? 'Assigned'
                  : taskStatus === 'CREATED' ? 'Created'
                  : taskStatus}
              </span>
            </div>
            {!isAdmin ? (
              <div className="mt-3 flex max-w-md items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStep('FORM')}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    step === 'FORM'
                      ? 'border-sky-500/60 bg-sky-50 text-sky-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                      step === 'FORM' ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    1
                  </span>
                  <span className="truncate">{t('drawer.stepForm')}</span>
                </button>
                <div className="flex w-8 shrink-0 items-center justify-center" aria-hidden>
                  <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('SIGNED_FICHE')}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    step === 'SIGNED_FICHE'
                      ? 'border-sky-500/60 bg-sky-50 text-sky-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                      step === 'SIGNED_FICHE' ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    2
                  </span>
                  <span className="truncate">{t('drawer.stepSigned')}</span>
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                {t('drawer.adminStep')} {step === 'FORM' ? '1/2' : '2/2'}:{' '}
                {step === 'FORM' ? t('drawer.fillForm') : t('drawer.uploadSigned')}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            <span className="sr-only">{t('drawer.close')}</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {taskQuery.isLoading && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8">
              <svg className="h-5 w-5 animate-spin-smooth text-sky-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-slate-500">{t('drawer.loading')}</span>
            </div>
          )}

          {taskQuery.isError && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-6">
              <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-rose-700">{t('drawer.loadError')}</span>
            </div>
          )}

          {taskQuery.data && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-500">
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {t('drawer.assignedTech')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">{assignedTechnicianNames}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && !isFinalizedTask ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                        onClick={() => setReassignOpen((s) => !s)}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        {reassignOpen ? 'Close' : 'Re-assign'}
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        disabled={deletingTask}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                        onClick={handleDeleteTask}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {deletingTask ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : null}
                    {canUpdateStatus ? (
                      <>
                        {isAdmin && taskStatus === 'ASSIGNED' ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
                            onClick={(e) => {
                              const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                              setStartAnchorRect({
                                top: r.top,
                                left: r.left,
                                right: r.right,
                                bottom: r.bottom,
                                width: r.width,
                                height: r.height,
                              })
                              setStartConfirmOpen(true)
                            }}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Start work
                          </button>
                        ) : null}
                        {isAdmin && taskStatus === 'COMPLETED' ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
                            onClick={() => {
                              handleUpdateStatus('VERIFIED')
                              onClose()
                            }}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Verify
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                {deleteError ? <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{deleteError}</p> : null}
              </div>

              <TaskSubmittedFormsCollapsible
                forms={taskQuery.data?.forms}
                numberOfInstallations={taskQuery.data?.task?.numberOfInstallations ?? 1}
                isAdmin={isAdmin}
                technicianId={currentUserId}
                technicianFullname={installerDefaultName}
                technicianUsername={viewerUsername}
                taskClient={taskQuery.data?.task?.client}
                drafts={allDrafts}
                activeDraftId={activeDraftId}
                onResumeDraft={(draft) => {
                  setActiveDraftId(draft.draftId)
                  setForm(draft.form)
                  setFicheUrl(draft.ficheUrl ?? null)
                  setStep(draft.step)
                  setImmatSearch(draft.form.immatriculation ?? '')
                  formDraftBaselineRef.current = JSON.stringify({ form: draft.form, step: draft.step, ficheUrl: draft.ficheUrl ?? null })
                }}
              />

              <ConfirmDialog
                open={startConfirmOpen}
                title={`Start this ${startTypeLabel}?`}
                description={`By clicking OK, you confirm this ${startTypeLabel.toLowerCase()} is now in progress (status: IN_PROGRESS).`}
                confirmLabel="OK"
                cancelLabel="Annuler"
                anchorRect={startAnchorRect}
                onClose={() => setStartConfirmOpen(false)}
                onConfirm={() => {
                  setStartConfirmOpen(false)
                  handleUpdateStatus('IN_PROGRESS')
                  onClose()
                }}
              />

              {isFinalizedTask ? (
                <div className="rounded-xl border border-slate-300 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Completed task</p>
                  <p className="mt-1 text-xs text-slate-500">
                    This task is finalized. Editing is disabled. Review the filled form and signed fiche below.
                  </p>
                </div>
              ) : null}

              {isAdmin && !isFinalizedTask && reassignOpen ? (
                <div className="rounded-xl border border-slate-300 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Re-assign technicians</p>
                      <p className="mt-1 text-xs text-slate-500">
                        This will update assignments for this task (lead + assistants).
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={reassignBusy}
                      className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                      onClick={handleSaveReassign}
                    >
                      {reassignBusy ? 'Saving…' : 'Save assignment'}
                    </button>
                  </div>

                  {reassignError ? <p className="mt-2 text-xs text-rose-700">{reassignError}</p> : null}

                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                    onClick={() => setReassignTechniciansOpen((s) => !s)}
                  >
                    <span className="min-w-0 truncate">
                      {reassignLeadId ? (
                        <>
                          <span className="font-semibold">Lead:</span>{' '}
                          {technicianOptions.find((t) => t.id === reassignLeadId)?.fullname ||
                            technicianOptions.find((t) => t.id === reassignLeadId)?.username ||
                            `#${reassignLeadId}`}
                        </>
                      ) : (
                        <span className="text-slate-600">Select technicians…</span>
                      )}
                      <span className="text-slate-500">
                        {reassignAssistantIds.length > 0 ? ` · Assistants: ${reassignAssistantIds.length}` : ''}
                      </span>
                    </span>
                    <svg
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${reassignTechniciansOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {reassignTechniciansOpen ? (
                    <>
                      <div className="mt-3">
                        <input
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          placeholder="Search technician (name / username / ID)"
                          value={techSearch}
                          onChange={(e) => setTechSearch(e.target.value)}
                        />
                      </div>

                      <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                        {techniciansQuery.isLoading ? (
                          <p className="text-sm text-slate-500">Loading technicians…</p>
                        ) : technicianOptions.length === 0 ? (
                          <p className="text-sm text-slate-500">No technicians available.</p>
                        ) : filteredTechnicians.length === 0 ? (
                          <p className="text-sm text-slate-500">No technicians match your search.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {filteredTechnicians.map((tech) => {
                              const isLead = reassignLeadId === tech.id
                              const isAssistant = reassignAssistantIds.includes(tech.id)
                              const display = tech.fullname || tech.username
                              return (
                                <div
                                  key={tech.id}
                                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-900">{display}</p>
                                    <p className="text-xs text-slate-500">#{tech.id} · {tech.username}</p>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-xs text-slate-700">
                                      <input
                                        type="radio"
                                        name="reassign-lead-technician"
                                        checked={isLead}
                                        onChange={() => {
                                          setReassignLeadId(tech.id)
                                          setReassignAssistantIds((prev) => prev.filter((id) => id !== tech.id))
                                        }}
                                        className="h-4 w-4 border-slate-300 text-sky-700 focus:ring-sky-500"
                                      />
                                      Lead
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={isAssistant}
                                        disabled={isLead}
                                        onChange={(e) => {
                                          const checked = e.target.checked
                                          setReassignAssistantIds((prev) => {
                                            if (checked) {
                                              if (prev.includes(tech.id)) return prev
                                              return [...prev, tech.id]
                                            }
                                            return prev.filter((id) => id !== tech.id)
                                          })
                                        }}
                                        className="h-4 w-4 border-slate-300 text-sky-700 focus:ring-sky-500"
                                      />
                                      Assistant
                                    </label>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <p>
                      Lead:{' '}
                      <span className="font-semibold text-slate-900">
                        {reassignLeadId
                          ? technicianOptions.find((t) => t.id === reassignLeadId)?.fullname ||
                            technicianOptions.find((t) => t.id === reassignLeadId)?.username ||
                            `#${reassignLeadId}`
                          : '—'}
                      </span>
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setReassignLeadId(null)
                        setReassignAssistantIds([])
                      }}
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
              ) : null}

              {isAdmin && !isFinalizedTask ? (
                <div className="rounded-xl border border-slate-300 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Edit task</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Update client, device and scheduling details. The Update button is enabled only when something changes.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!isTaskDirty || savingTask}
                        className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        onClick={() => {
                          setEditClient(initialEdit.client)
                          setEditClientSearch(initialEdit.client)
                          setEditClientTouched(false)
                          setEditClientDropdownOpen(false)
                          setEditNumberOfInstallations(initialEdit.numberOfInstallations)
                          setEditTypeEquipment(initialEdit.typeEquipment)
                          setEditEquipmentMake(initialEdit.equipmentMake)
                          setEditEquipmentModel(initialEdit.equipmentModel)
                          setEditEquipmentVersion(initialEdit.equipmentVersion)
                          setEditType(initialEdit.type)
                          setEditScheduled(initialEdit.scheduled)
                          setTaskSaveError('')
                        }}
                      >
                        Reset changes
                      </button>
                      <button
                        type="button"
                        disabled={!isTaskDirty || savingTask}
                        className="rounded-md bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                        onClick={handleSaveTaskEdits}
                      >
                        {savingTask ? 'Updating…' : 'Update task'}
                      </button>
                    </div>
                  </div>

                  {taskSaveError ? <p className="mt-2 text-xs text-rose-700">{taskSaveError}</p> : null}

                  <datalist id="edit-equipment-make-options">
                    <option value="Teltonika" />
                    <option value="Queclink" />
                    <option value="Ruptela" />
                    <option value="Concox" />
                  </datalist>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Task details</p>
                      <p className="mt-1 text-[11px] text-slate-500">Who and when.</p>

                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Client</label>
                          <div className="relative">
                            <input
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-0"
                              value={editClientTouched ? editClientSearch : editClient}
                              onChange={(e) => {
                                const v = e.target.value
                                setEditClient(v)
                                setEditClientSearch(v)
                                setEditClientTouched(true)
                                setEditClientDropdownOpen(true)
                              }}
                              onFocus={() => {
                                setEditClientTouched(true)
                                setEditClientDropdownOpen(true)
                                if (!editClientSearch) setEditClientSearch(editClient)
                              }}
                              onBlur={() => {
                                setTimeout(() => setEditClientDropdownOpen(false), 120)
                              }}
                              placeholder={clientsQuery.isLoading ? 'Loading clients…' : 'Select a client or type a new name'}
                            />
                            {editClientDropdownOpen ? (
                              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                                {clientsQuery.isLoading ? (
                                  <div className="px-3 py-2 text-sm text-slate-500">Loading clients…</div>
                                ) : filteredEditClients.length > 0 ? (
                                  <div className="max-h-56 overflow-y-auto">
                                    {filteredEditClients.map((c) => {
                                      const label = getClientLabel(c)
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          className="w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            setEditClient(label)
                                            setEditClientSearch(label)
                                            setEditClientTouched(true)
                                            setEditClientDropdownOpen(false)
                                          }}
                                        >
                                          {label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="px-3 py-2 text-sm text-slate-500">
                                    No match. You can keep typing to set a custom client name.
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Type</label>
                            <select
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                              value={editType}
                              onChange={(e) => setEditType(e.target.value as TaskType)}
                              disabled
                            >
                              <option value="INSTALLATION">INSTALLATION</option>
                              <option value="INTERVENTION">INTERVENTION</option>
                            </select>
                            <p className="mt-1 text-[11px] text-slate-500">Task type cannot be changed.</p>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Scheduled date-time (optional)
                            </label>
                            <input
                              type="datetime-local"
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                              value={editScheduled}
                              onChange={(e) => setEditScheduled(e.target.value)}
                            />
                            <p className="mt-1 text-[11px] text-slate-500">Local time is converted to UTC for the API.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Equipment</p>
                      <p className="mt-1 text-[11px] text-slate-500">Device details used by the technician.</p>

                      <div className="mt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Number of installations
                            </label>
                            <div className="mt-1 flex items-stretch gap-2">
                              <button
                                type="button"
                                className="w-10 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => setEditNumberOfInstallations((n) => Math.max(1, n - 1))}
                                aria-label="Decrease installations"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                                value={editNumberOfInstallations}
                                onChange={(e) => setEditNumberOfInstallations(Math.max(1, Number(e.target.value || 1)))}
                              />
                              <button
                                type="button"
                                className="w-10 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => setEditNumberOfInstallations((n) => Math.max(1, n + 1))}
                                aria-label="Increase installations"
                              >
                                +
                              </button>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">Set quantity for bulk installs.</p>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Type equipment</label>
                            <select
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                              value={editTypeEquipment}
                              onChange={(e) => setEditTypeEquipment(e.target.value)}
                            >
                              <option value="DashCam">DashCam</option>
                              <option value="GPS">GPS</option>
                              <option value="Camera Secondaire">Camera Secondaire</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Equipment make</label>
                            <input
                              list="edit-equipment-make-options"
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                              value={editEquipmentMake}
                              onChange={(e) => setEditEquipmentMake(e.target.value)}
                              placeholder="e.g. Teltonika"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Equipment model</label>
                            <input
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                              value={editEquipmentModel}
                              onChange={(e) => setEditEquipmentModel(e.target.value)}
                              placeholder="e.g. FMC650"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Equipment version (optional)
                          </label>
                          <input
                            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                            value={editEquipmentVersion}
                            onChange={(e) => setEditEquipmentVersion(e.target.value)}
                            placeholder="e.g. v2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {isFinalizedTask ? (
                <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
                  <div className="max-h-[calc(100vh-240px)] overflow-y-auto rounded-xl border border-slate-300 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fiche (remplie)</p>
                    <div className="mt-3 space-y-3 text-sm text-slate-900">
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="col-span-full">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Client</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.client || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Immatriculation</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.immatriculation || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Marque / modèle</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.vehicleMakeModel || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Année</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.year || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Odomètre</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.odometer || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Châssis</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.chassis || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Code opérateur</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.operatorCode || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Pays</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.country || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">N° SIM</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.simNumber || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">IMSI</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.imsi || '—'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Options véhicule</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {(
                            [
                              ['antivol', 'Antivol'],
                              ['geolocation', 'Géolocalisation'],
                              ['fleetManagement', 'Gestion de flotte FMS'],
                              ['otherOption', 'Autre option'],
                              ['camera', 'Caméra'],
                              ['alarm', 'Alarme'],
                              ['buzzer', 'Buzzer'],
                              ['canClick', 'CAN Click'],
                              ['alimentationRed', 'Alimentation rouge'],
                              ['alimentationYellow', 'Alimentation jaune'],
                              ['acc', 'ACC'],
                              ['immobilisationCable', 'Immobilisation'],
                              ['fuelGauge', 'Jauge carburant'],
                              ['canH', 'CAN H'],
                              ['canL', 'CAN L'],
                            ] as Array<[keyof InterventionForm, string]>
                          ).map(([key, label]) => {
                            const checked = Boolean(form[key])
                            return (
                              <div
                                key={key}
                                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                              >
                                <span className="text-xs font-medium text-slate-900">{label}</span>
                                <span
                                  className={
                                    checked
                                      ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-500/30'
                                      : 'rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-500/20'
                                  }
                                >
                                  {checked ? 'Oui' : 'Non'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Checklist</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {(
                            [
                              ['battery12vOk', 'Batterie OK'],
                              ['kitGpsConnected', 'Kit GPS connecté'],
                              ['engineStartsWell', 'Moteur démarre bien'],
                              ['dashboardDefaults', 'Défauts tableau de bord'],
                              ['buttonsDefaults', 'Boutons défauts'],
                              ['climRadioDefaults', 'Clim / radio défauts'],
                            ] as Array<[keyof InterventionForm, string]>
                          ).map(([key, label]) => {
                            const checked = Boolean(form[key])
                            return (
                              <div
                                key={key}
                                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                              >
                                <span className="text-xs font-medium text-slate-900">{label}</span>
                                <span
                                  className={
                                    checked
                                      ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-500/30'
                                      : 'rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-500/20'
                                  }
                                >
                                  {checked ? 'Oui' : 'Non'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Observations</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2">
                          {form.observations || '—'}
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Installateur</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.installerName || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Date</p>
                          <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                            {form.date || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[calc(100vh-240px)] overflow-y-auto rounded-xl border border-slate-300 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fiche signée (A4)</p>
                    <div className="mt-3">
                      {!ficheUrl ? (
                        <p className="text-sm text-slate-500">Aucune fiche signée.</p>
                      ) : previewError ? (
                        <p className="text-sm text-rose-700">{previewError}</p>
                      ) : fichePreviewSrc ? (
                        <div className="mx-auto w-full max-w-[520px] rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                          <div className="aspect-[210/297] w-full overflow-hidden rounded-md bg-white">
                            {ficheExt === 'pdf' ? (
                              <iframe title="Signed fiche preview" src={fichePreviewSrc} className="h-full w-full" />
                            ) : (
                              <img src={fichePreviewSrc} alt="Signed fiche preview" className="h-full w-full object-contain" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Chargement…</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {!isAdmin && step === 'FORM' && (
                <div className="space-y-5">
                  {/* Header card */}
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50/60 p-6 shadow-sm">
                    <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sky-500/5" />
                    <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-sky-500/10" />
                    <div className="relative flex items-start gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/25">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {taskType === 'INSTALLATION' ? "Fiche d'installation" : "Fiche d'intervention"}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                          Renseignez les champs ci-dessous, puis appuyez sur <span className="font-semibold text-sky-600">Continuer</span> pour joindre la fiche signee et finaliser.
                        </p>
                      </div>
                    </div>
                    {submitError ? (
                      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {submitError}
                      </div>
                    ) : null}
                  </div>

                  {/* Vehicle Information Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Informations vehicule</h4>
                        <p className="text-xs text-slate-500">Details du vehicule et du client</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* Client field */}
                        <div className="relative sm:col-span-2">
                          <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Client
                          </label>
                          <div className="flex items-stretch gap-2">
                            <input
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none"
                              value={form.client ?? ''}
                              readOnly
                              disabled
                            />
                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
                              disabled={!selectedClientId || vehiclesQuery.isLoading}
                              title="Refresh vehicles"
                              onClick={() => {
                                setVehicleManualMode(false)
                                vehiclesQuery.refetch()
                              }}
                            >
                              {vehiclesQuery.isLoading ? (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              )}
                            </button>
                          </div>
                          {!selectedClientId && clientsQuery.isLoading ? (
                            <p className="mt-1.5 text-xs text-slate-400">Loading client vehicles...</p>
                          ) : null}
                        </div>

                        {/* Chassis */}
                        <div className="relative sm:col-start-1">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Chassis
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                            value={String(form.chassis ?? '')}
                            onChange={(e) => onFormChange('chassis', e.target.value)}
                          />
                        </div>

                        {(
                          [
                            ['vehicleMakeModel', 'Marque / modele'],
                            ['year', 'Annee'],
                            ['odometer', 'Odometre'],
                            ['operatorCode', 'Code operateur'],
                            ['country', 'Pays'],
                            ['simNumber', 'N SIM'],
                            ['imsi', 'IMSI'],
                          ] as Array<[keyof InterventionForm, string]>
                        ).map(([key, label]) => {
                          const val = form[key]
                          if (typeof val === 'boolean') return null
                          const isDate = key === 'date'
                          return (
                            <div key={key}>
                              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {label}
                              </label>
                              <input
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                                value={String(form[key] ?? '')}
                                type={isDate ? 'date' : 'text'}
                                onChange={(e) => onFormChange(key, e.target.value as any)}
                              />
                            </div>
                          )
                        })}

                        {/* Immatriculation dropdown */}
                        <div className="relative">
                          <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Immatriculation
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 disabled:bg-slate-50 disabled:text-slate-400"
                            value={immatSearch || form.immatriculation || ''}
                            disabled={!selectedClientId && !vehicleManualMode && !isAdmin}
                            onChange={(e) => {
                              setImmatSearch(e.target.value)
                              if (!vehicleManualMode && vehicleOptions.length > 0) setImmatDropdownOpen(true)
                              onFormChange('immatriculation', e.target.value)
                            }}
                            onFocus={() => {
                              if (!vehicleManualMode && vehicleOptions.length > 0) setImmatDropdownOpen(true)
                              if (!immatSearch) setImmatSearch(form.immatriculation ?? '')
                            }}
                            onBlur={() => {
                              setTimeout(() => setImmatDropdownOpen(false), 120)
                            }}
                            placeholder={
                              selectedClientId
                                ? vehicleManualMode
                                  ? 'Saisir manuellement (immat / tag)'
                                  : 'Rechercher un tag vehicule'
                                : vehicleManualMode
                                  ? 'Saisir manuellement (immat / tag)'
                                  : isAdmin
                                    ? "Selectionnez d'abord un client"
                                    : 'Entrer immatriculation / tag'
                            }
                          />
                          {selectedClientId && vehicleOptions.length > 0 ? (
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              {vehicleOptions.length} vehicule(s) trouve(s)
                            </p>
                          ) : null}
                          {!selectedClientId && !vehicleManualMode ? (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <p className="flex items-center gap-1.5 text-amber-600">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {isAdmin ? "Selectionnez d'abord un client." : "Impossible de charger les vehicules pour ce client."}
                              </p>
                              {!isAdmin ? (
                                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                    checked={vehicleManualMode}
                                    onChange={(e) => {
                                      const checked = e.target.checked
                                      setVehicleManualMode(checked)
                                      if (checked) setImmatDropdownOpen(false)
                                    }}
                                  />
                                  Saisie manuelle
                                </label>
                              ) : null}
                            </div>
                          ) : vehiclesQuery.isLoading ? (
                            <p className="mt-1.5 text-xs text-slate-400">Chargement des vehicules...</p>
                          ) : vehicleOptions.length === 0 ? (
                            vehicleManualMode ? (
                              <p className="mt-1.5 text-xs text-slate-400">Saisie manuelle activee.</p>
                            ) : (
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <p className="text-rose-600">Aucun vehicule dans ce compte/client.</p>
                                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                    checked={vehicleManualMode}
                                    onChange={(e) => {
                                      const checked = e.target.checked
                                      setVehicleManualMode(checked)
                                      if (checked) setImmatDropdownOpen(false)
                                    }}
                                  />
                                  Saisie manuelle
                                </label>
                              </div>
                            )
                          ) : null}

                          {immatDropdownOpen && !vehicleManualMode && filteredVehicles.length > 0 ? (
                            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
                              {filteredVehicles.map((v, idx) => {
                                const label = getVehicleTagLabel(v)
                                if (!label) return null
                                return (
                                  <button
                                    key={`${v.id ?? 'v'}-${idx}-${label}`}
                                    type="button"
                                    className="w-full px-4 py-2.5 text-left text-sm text-slate-900 transition hover:bg-sky-50 hover:text-sky-900"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setImmatSearch(label)
                                      setImmatDropdownOpen(false)
                                      onFormChange('immatriculation', label as any)
                                      const selectedModel = getVehicleModelLabel(v)
                                      if (selectedModel) onFormChange('vehicleMakeModel', selectedModel as any)
                                      const selectedCarrier = getVehicleCarrierLabel(v)
                                      if (selectedCarrier) onFormChange('operatorCode', selectedCarrier as any)
                                      const selectedImsi = getVehicleImsiLabel(v)
                                      if (selectedImsi) onFormChange('imsi', selectedImsi as any)
                                      const selectedCountry = getVehicleCountryLabel(v)
                                      if (selectedCountry) onFormChange('country', selectedCountry as any)
                                    }}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          ) : immatDropdownOpen && selectedClientId && !vehiclesQuery.isLoading && vehicleOptions.length > 0 ? (
                            <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                              Aucun resultat pour cette recherche.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Options Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Options vehicule</h4>
                        <p className="text-xs text-slate-500">Equipements et fonctionnalites installes</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {(
                          [
                            ['antivol', 'Antivol'],
                            ['geolocation', 'Geolocalisation'],
                            ['fleetManagement', 'Gestion de flotte FMS'],
                            ['otherOption', 'Autre'],
                            ['camera', 'Camera'],
                            ['alarm', 'Alarme'],
                            ['buzzer', 'Buzzer'],
                            ['canClick', 'CAN Click'],
                            ['alimentationRed', 'Alimentation rouge'],
                            ['alimentationYellow', 'Alimentation jaune'],
                            ['acc', 'ACC'],
                            ['immobilisationCable', 'Immobilisation'],
                            ['fuelGauge', 'Jauge carburant'],
                            ['canH', 'CAN H'],
                            ['canL', 'CAN L'],
                          ] as Array<[keyof InterventionForm, string]>
                        ).map(([key, label]) => {
                          const checked = Boolean(form[key])
                          return (
                            <label
                              key={key}
                              className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                checked
                                  ? 'border-sky-200 bg-sky-50/80 shadow-sm shadow-sky-100'
                                  : 'border-slate-150 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                                checked
                                  ? 'border-sky-500 bg-sky-500 text-white'
                                  : 'border-slate-300 bg-white group-hover:border-slate-400'
                              }`}>
                                {checked ? (
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : null}
                              </div>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={(e) => onFormChange(key, e.target.checked as any)}
                              />
                              <span className={`text-sm font-medium transition ${checked ? 'text-sky-900' : 'text-slate-700'}`}>{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Checklist Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Checklist</h4>
                        <p className="text-xs text-slate-500">Verifications obligatoires avant finalisation</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {(
                          [
                            ['battery12vOk', 'Batterie 12V OK'],
                            ['kitGpsConnected', 'Kit GPS connecte'],
                            ['engineStartsWell', 'Moteur demarre bien'],
                            ['dashboardDefaults', 'Dashboard defauts'],
                            ['buttonsDefaults', 'Boutons defauts'],
                            ['climRadioDefaults', 'Clim / radio defauts'],
                          ] as Array<[keyof InterventionForm, string]>
                        ).map(([key, label]) => {
                          const checked = Boolean(form[key])
                          return (
                            <label
                              key={key}
                              className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                checked
                                  ? 'border-emerald-200 bg-emerald-50/80 shadow-sm shadow-emerald-100'
                                  : 'border-slate-150 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                                checked
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-slate-300 bg-white group-hover:border-slate-400'
                              }`}>
                                {checked ? (
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : null}
                              </div>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={(e) => onFormChange(key, e.target.checked as any)}
                              />
                              <span className={`text-sm font-medium transition ${checked ? 'text-emerald-900' : 'text-slate-700'}`}>{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('draft.autosaveHint')}
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        className="order-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 sm:order-1"
                        onClick={() => {
                          const taskClient = taskQuery.data?.task?.client ?? ''
                          const cleared: InterventionForm = {
                            ...DEFAULT_FORM,
                            client: taskClient,
                            year: getLocalCurrentYearString(),
                            date: getLocalTodayInputValue(),
                            installerName: installerDefaultName,
                          }
                          setForm(cleared)
                          setStep('FORM')
                          formDraftBaselineRef.current = JSON.stringify({
                            form: cleared,
                            step: 'FORM' as Step,
                            ficheUrl: null,
                          })
                          setSelectedClientId(null)
                          setImmatSearch('')
                          setImmatDropdownOpen(false)
                          setSelectedFile(null)
                          suppressDraftSaveUntilRef.current = Date.now() + 900
                          if (currentUserId && activeDraftId) {
                            deleteDraftAsync(currentUserId, taskId, activeDraftId).then(() => {
                              setAllDrafts((prev) => prev.filter((d) => d.draftId !== activeDraftId))
                            })
                          }
                          setActiveDraftId(createNewDraftId())
                        }}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Effacer le brouillon
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        className="order-1 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:from-sky-600 hover:to-sky-700 hover:shadow-sky-600/30 disabled:opacity-60 active:scale-[0.98] sm:order-2 sm:w-auto sm:min-w-[240px]"
                        onClick={() => setStep('SIGNED_FICHE')}
                      >
                        Continuer vers la fiche signee
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!isAdmin && step === 'SIGNED_FICHE' && (
                <div className="space-y-5">
                  {/* Header with back button */}
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/60 p-6 shadow-sm">
                    <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/5" />
                    <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-emerald-500/10" />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                          onClick={() => setStep('FORM')}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-slate-900">Fiche signee</h3>
                          <p className="mt-1 text-sm leading-relaxed text-slate-500">
                            Joignez une photo ou un PDF de la fiche signee, completez les informations puis validez.
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                          hasExistingFiche
                            ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                            : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${hasExistingFiche ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {hasExistingFiche ? 'Mise a jour' : 'Nouvelle fiche'}
                      </span>
                    </div>

                    {submitError ? (
                      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {submitError}
                      </div>
                    ) : null}
                  </div>

                  {/* Upload & Preview section */}
                  <div className="grid gap-5 lg:grid-cols-2">
                    {/* Upload card */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-500">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Document</h4>
                          <p className="text-xs text-slate-500">Image ou PDF depuis l'appareil</p>
                        </div>
                      </div>

                      <div className="space-y-4 p-6">
                        <input
                          id={signedFicheInputId}
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null
                            setSelectedFile(f)
                          }}
                        />
                        <label
                          htmlFor={signedFicheInputId}
                          className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-6 text-center transition hover:border-sky-400 hover:bg-sky-50/50"
                        >
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 text-sky-600">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-sky-700">Choisir un fichier</span>
                          <span className="text-xs text-slate-400">PDF, JPG, PNG...</span>
                        </label>

                        {selectedFile ? (
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/50 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-600">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <span className="min-w-0 truncate text-sm font-medium text-slate-800">{selectedFile.name}</span>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => setSelectedFile(null)}
                            >
                              Retirer
                            </button>
                          </div>
                        ) : ficheUrl ? (
                          <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-700">
                            Fiche deja enregistree sur le serveur. Vous pouvez en choisir une nouvelle pour la remplacer.
                          </p>
                        ) : (
                          <p className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm text-amber-700">
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Un document est requis pour valider.
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {localFilePreviewSrc || fichePreviewSrc ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              onClick={() => setFullPreviewOpen(true)}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                              Plein ecran
                            </button>
                          ) : null}
                          {ficheUrl ? (
                            <button
                              type="button"
                              disabled={taskQuery.isFetching}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                              onClick={() => taskQuery.refetch()}
                            >
                              {taskQuery.isFetching ? 'Actualisation...' : 'Actualiser'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Preview card */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-500">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Apercu</h4>
                          <p className="text-xs text-slate-500">Visualisation du document</p>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="min-h-[14rem] overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50">
                          {localFilePreviewSrc ? (
                            selectedFile?.type === 'application/pdf' ? (
                              <iframe title="Apercu fiche signee" src={localFilePreviewSrc} className="h-80 w-full rounded-lg" />
                            ) : (
                              <img
                                src={localFilePreviewSrc}
                                alt="Apercu fiche signee"
                                className="max-h-80 w-full rounded-lg object-contain"
                              />
                            )
                          ) : !ficheUrl ? (
                            <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-400">
                              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm">Aucun apercu</p>
                              <p className="text-xs">Choisissez un fichier pour le visualiser</p>
                            </div>
                          ) : previewError ? (
                            <p className="p-4 text-sm text-rose-700">{previewError}</p>
                          ) : fichePreviewSrc ? (
                            ficheExt === 'pdf' ? (
                              <iframe title="Apercu fiche signee" src={fichePreviewSrc} className="h-80 w-full rounded-lg" />
                            ) : (
                              <img
                                src={fichePreviewSrc}
                                alt="Apercu fiche signee"
                                className="max-h-80 w-full rounded-lg object-contain"
                              />
                            )
                          ) : (
                            <div className="flex h-56 items-center justify-center">
                              <svg className="h-5 w-5 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {fullPreviewOpen ? (
                    <div className="fixed inset-0 z-50 flex">
                      <button
                        type="button"
                        className="h-full w-full bg-black/70 backdrop-blur-sm"
                        onClick={() => setFullPreviewOpen(false)}
                        aria-label="Fermer l'apercu plein ecran"
                      />
                      <div className="absolute inset-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:inset-8">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
                          <p className="text-sm font-bold text-slate-800">Fiche signee</p>
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            onClick={() => setFullPreviewOpen(false)}
                          >
                            Fermer
                          </button>
                        </div>
                        <div className="h-[calc(100%-52px)] bg-black/5">
                          {(() => {
                            const src = localFilePreviewSrc || fichePreviewSrc
                            if (!src) return <div className="p-4 text-sm text-slate-600">Aucun apercu disponible.</div>
                            const isPdf =
                              (selectedFile?.type === 'application/pdf' && !!localFilePreviewSrc) || ficheExt === 'pdf'
                            return isPdf ? (
                              <iframe title="Fiche signee plein ecran" src={src} className="h-full w-full" />
                            ) : (
                              <img src={src} alt="Fiche signee plein ecran" className="h-full w-full object-contain" />
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Additional info section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Informations complementaires</h4>
                        <p className="text-xs text-slate-500">Observations, installateur et date</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="lg:col-span-2">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Observations
                          </label>
                          <textarea
                            rows={4}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                            value={form.observations ?? ''}
                            onChange={(e) => onFormChange('observations', e.target.value)}
                            placeholder="Notes eventuelles..."
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Installateur
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                            value={form.installerName ?? ''}
                            onChange={(e) => onFormChange('installerName', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Date
                          </label>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10"
                            value={form.date ?? ''}
                            onChange={(e) => onFormChange('date', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit button */}
                  <div className="sticky bottom-0 z-10 flex justify-end rounded-2xl border border-slate-200 bg-white/95 px-6 py-5 shadow-lg backdrop-blur-sm">
                    <button
                      type="button"
                      disabled={submittingForm || (!selectedFile && !ficheUrl) || taskStatus === 'COMPLETED'}
                      className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
                      onClick={handleSubmitForm}
                    >
                      {submittingForm ? (
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {submittingForm
                        ? hasExistingFiche
                          ? "Enregistrement\u2026"
                          : "Envoi\u2026"
                        : hasExistingFiche
                          ? taskType === "INSTALLATION"
                            ? "Mettre \u00e0 jour l\u2019installation"
                            : "Mettre \u00e0 jour l\u2019intervention"
                          : taskType === "INSTALLATION"
                            ? "Cr\u00e9er l\u2019installation"
                            : "Cr\u00e9er l\u2019intervention"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

