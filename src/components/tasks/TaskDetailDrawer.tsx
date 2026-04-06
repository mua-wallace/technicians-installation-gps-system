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
  clearTaskFormDraft,
  draftMatchesCurrentTask,
  loadTaskFormDraft,
  saveTaskFormDraft,
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
  const signedFicheInputId = useId()
  /** After clearing the draft, block a pending debounced save from re-writing localStorage. */
  const suppressDraftSaveUntilRef = useRef(0)
  /** Snapshot after server/draft load — we only persist when the user changes beyond this (no false “drafts”). */
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
    const nextForm = { ...DEFAULT_FORM, ...(backendForm ?? {}) } as InterventionForm
    // Ensure `date` is compatible with `<input type="date">`
    nextForm.date = formatInputDate(nextForm.date)
    if (!nextForm.client) nextForm.client = taskQuery.data.task?.client ?? ''
    if (!nextForm.year) nextForm.year = getLocalCurrentYearString()
    if (!nextForm.date) nextForm.date = getLocalTodayInputValue()
    if (!nextForm.installerName) nextForm.installerName = installerDefaultName

    let nextStep: Step = backendForm?.ficheUrl ? 'SIGNED_FICHE' : 'FORM'
    let nextFicheUrl: string | null = backendForm?.ficheUrl ?? null

    const uid = currentUserId
    const assigned = uid != null && initialAssignments.some((a) => a.technicianId === uid)
    if (!isAdmin && uid != null && assigned) {
      const draft = loadTaskFormDraft(uid, taskId)
      const taskUpdatedAt = taskQuery.data.task?.updatedAt
      if (draft) {
        if (draftMatchesCurrentTask(draft, taskUpdatedAt)) {
          Object.assign(nextForm, draft.form)
          nextForm.date = formatInputDate(nextForm.date)
          nextStep = draft.step
          nextFicheUrl = draft.ficheUrl != null && draft.ficheUrl !== '' ? draft.ficheUrl : nextFicheUrl
        } else {
          clearTaskFormDraft(uid, taskId)
        }
      }
    }

    if (!isAdmin && taskFormIntentNonce > 0) {
      nextStep = 'FORM'
    }

    formDraftBaselineRef.current = JSON.stringify({
      form: nextForm,
      step: nextStep,
      ficheUrl: nextFicheUrl,
    })

    setForm(nextForm)
    setSelectedClientId(null)
    setImmatSearch(nextForm.immatriculation ?? '')
    setImmatDropdownOpen(false)
    setVehicleManualMode(false)

    setFicheUrl(nextFicheUrl)
    setStep(nextStep)
    setSelectedFile(null)
    setPreviewError('')
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

  /** Local cache so technicians can leave and resume a partially filled fiche (same device / browser). */
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
      saveTaskFormDraft(currentUserId, taskId, {
        form,
        step,
        ficheUrl: ficheUrl ?? undefined,
        serverTaskUpdatedAt: taskUpdatedAt,
        userEdited: true,
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
      let nextFicheUrl = ficheUrl
      let didUploadSignedFiche = false
      if (selectedFile) {
        const uploadResp = await tasksApi.uploadSignedFiche(taskId, selectedFile, taskType)
        nextFicheUrl = uploadResp?.ficheUrl ?? nextFicheUrl
        didUploadSignedFiche = true
        if (nextFicheUrl) setFicheUrl(nextFicheUrl)
        setSelectedFile(null)
      }

      if (!nextFicheUrl) {
        setSubmitError('Veuillez ajouter la fiche signée avant de créer la fiche.')
        return
      }

      const payload: any = sanitizeFormPayload({
        ...form,
        // keep user input in state; we convert to ISO for API below.
        date: formatInputDate(form.date),
      })
      const submitPayload: InstallationFormSubmitPayload = {
        ...(payload as InterventionForm),
        taskId,
        client: taskQuery.data?.task?.client ?? form.client ?? '',
        // API sample uses YYYY-MM-DD on POST body
        date: formatInputDate(form.date) || getLocalTodayInputValue(),
        ficheUrl: nextFicheUrl,
      }

      const effectiveType = (taskQuery.data?.task?.type ?? taskType) as TaskType
      const { taskId: _omitTaskId, ...patchPayload } = submitPayload
      const patchBody = patchPayload as InstallationFormPatchPayload

      // Important: some backends create a (blank) form record when uploading the signed fiche snapshot.
      // If we uploaded a fiche and there was no form before, we refetch once and switch to PATCH to avoid
      // creating a duplicate empty form via POST.
      let shouldUpdate = hasExistingFiche
      if (!shouldUpdate && didUploadSignedFiche) {
        const refreshed = await taskQuery.refetch()
        const serverFormExists = Boolean(refreshed.data?.form)
        shouldUpdate = serverFormExists
      }

      const resp = shouldUpdate
        ? effectiveType === 'INTERVENTION'
          ? await tasksApi.updateInterventionForm(taskId, patchBody)
          : await tasksApi.updateInstallationForm(taskId, patchBody)
        : effectiveType === 'INTERVENTION'
          ? await tasksApi.submitInterventionForm(submitPayload)
          : await tasksApi.submitInstallationForm(submitPayload)

      const updatedForm = resp?.form
      setFicheUrl(updatedForm?.ficheUrl ?? nextFicheUrl ?? ficheUrl)
      setStep('SIGNED_FICHE')
      const nextStatus = resp?.task?.status ?? taskStatus
      // Backend handles status updates as part of form creation/submission.
      setTaskStatus(nextStatus)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      onTaskUpdated?.(taskId)
      if (currentUserId) clearTaskFormDraft(currentUserId, taskId)
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
      <button type="button" className="h-full w-full bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-7xl flex-col bg-slate-100 text-slate-900 shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-300 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-300 bg-white px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-900">
                {taskQuery.data?.task?.client ?? t('drawer.task')}
              </span>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-900">
                {Number.isFinite(taskQuery.data?.task?.numberOfInstallations as any)
                  ? `${taskQuery.data?.task?.numberOfInstallations} install${taskQuery.data?.task?.numberOfInstallations === 1 ? '' : 's'}`
                  : '— installs'}
              </span>
              <span className="rounded-full bg-slate-300/70 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-900">
                {taskType}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/30">
                {taskStatus}
              </span>
            </div>
            {!isAdmin ? (
              <div className="mt-3 flex max-w-md items-center gap-2">
                <div
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                    step === 'FORM'
                      ? 'border-sky-500 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step === 'FORM' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    1
                  </span>
                  <span className="truncate">{t('drawer.stepForm')}</span>
                </div>
                <div className="h-px w-6 shrink-0 bg-slate-300" aria-hidden />
                <div
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                    step === 'SIGNED_FICHE'
                      ? 'border-sky-500 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step === 'SIGNED_FICHE' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    2
                  </span>
                  <span className="truncate">{t('drawer.stepSigned')}</span>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-600">
                {t('drawer.adminStep')} {step === 'FORM' ? '1/2' : '2/2'}:{' '}
                {step === 'FORM' ? t('drawer.fillForm') : t('drawer.uploadSigned')}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
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
            <div className="rounded-xl border border-slate-300 bg-white/60 p-6 text-sm text-slate-700">
              {t('drawer.loading')}
            </div>
          )}

          {taskQuery.isError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-700">
              {t('drawer.loadError')}
            </div>
          )}

          {taskQuery.data && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                    {t('drawer.assignedTech')}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{assignedTechnicianNames}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">{t('drawer.actions')}</span>
                  {isAdmin && !isFinalizedTask ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => setReassignOpen((s) => !s)}
                    >
                      {reassignOpen ? 'Close re-assign' : 'Re-assign technicians'}
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={deletingTask}
                      className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      onClick={handleDeleteTask}
                    >
                      {deletingTask ? 'Deleting…' : 'Delete task'}
                    </button>
                  ) : null}
                  {canUpdateStatus ? (
                    <>
                      {isAdmin && taskStatus === 'ASSIGNED' ? (
                        <button
                          type="button"
                          className="rounded-md border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-500/25"
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
                          Start work
                        </button>
                      ) : null}
                      {isAdmin && taskStatus === 'COMPLETED' ? (
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                          onClick={() => {
                            handleUpdateStatus('VERIFIED')
                            onClose()
                          }}
                        >
                          Vérifier
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {deleteError ? <p className="mt-2 text-xs text-rose-700">{deleteError}</p> : null}
              </div>

              <TaskSubmittedFormsCollapsible
                forms={taskQuery.data?.forms}
                numberOfInstallations={taskQuery.data?.task?.numberOfInstallations ?? 1}
                isAdmin={isAdmin}
                technicianId={currentUserId}
                technicianFullname={installerDefaultName}
                technicianUsername={viewerUsername}
                taskClient={taskQuery.data?.task?.client}
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
                <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-slate-900">
                  <h3 className="text-base font-semibold text-sky-900">
                    {taskType === 'INSTALLATION' ? "Fiche d'installation" : "Fiche d'intervention"}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Renseignez les champs ci-dessous, puis appuyez sur <span className="font-medium text-slate-800">Continuer</span> pour joindre la fiche signée et finaliser.
                  </p>
                  {submitError ? <p className="mt-2 text-xs text-rose-700">{submitError}</p> : null}

                  <div className="mt-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Client dropdown (searchable) */}
                      <div className="relative">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Client
                        </label>
                        <div className="mt-1 flex items-stretch gap-2">
                          <input
                            className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none"
                            value={form.client ?? ''}
                            readOnly
                            disabled
                          />
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            disabled={!selectedClientId || vehiclesQuery.isLoading}
                            title="Refresh vehicles"
                            onClick={() => {
                              setVehicleManualMode(false)
                              vehiclesQuery.refetch()
                            }}
                          >
                            {vehiclesQuery.isLoading ? '…' : 'Refresh'}
                          </button>
                        </div>
                        {form.client ? (
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-600">
                              Client sélectionné: <span className="font-medium text-slate-800">{form.client}</span>
                            </span>
                          </div>
                        ) : null}
                        {!selectedClientId && clientsQuery.isLoading ? (
                          <p className="mt-1 text-[11px] text-slate-500">Loading client vehicles…</p>
                        ) : null}
                      </div>

                      {/* Chassis (swapped with immatriculation position) */}
                      <div className="relative sm:col-start-1 sm:row-start-2">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Chassis
                        </label>
                        <input
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={String(form.chassis ?? '')}
                          onChange={(e) => onFormChange('chassis', e.target.value)}
                        />
                      </div>

                      {(
                        [
                          ['vehicleMakeModel', 'Marque / modèle'],
                          ['year', 'Année'],
                          ['odometer', 'Odomètre'],
                          ['operatorCode', 'Code opérateur'],
                          ['country', 'Pays'],
                          ['simNumber', 'N° SIM'],
                          ['imsi', 'IMSI'],
                        ] as Array<[keyof InterventionForm, string]>
                      ).map(([key, label]) => {
                        const val = form[key]
                        if (typeof val === 'boolean') return null
                        const isDate = key === 'date'
                        return (
                          <div key={key}>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                              {label}
                            </label>
                            <input
                              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                              value={String(form[key] ?? '')}
                              type={isDate ? 'date' : 'text'}
                              onChange={(e) => onFormChange(key, e.target.value as any)}
                            />
                          </div>
                        )
                      })}

                      {/* Immatriculation dropdown (swapped with chassis position) */}
                      <div className="relative">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Immatriculation
                        </label>
                        <input
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
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
                                : 'Rechercher un tag véhicule'
                              : vehicleManualMode
                                ? 'Saisir manuellement (immat / tag)'
                                : isAdmin
                                  ? 'Sélectionnez d’abord un client'
                                  : 'Entrer immatriculation / tag'
                          }
                        />
                        {selectedClientId && vehicleOptions.length > 0 ? (
                          <p className="mt-1 text-xs text-slate-500">{vehicleOptions.length} véhicule(s) trouvé(s)</p>
                        ) : null}
                        {!selectedClientId && !vehicleManualMode ? (
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <p className="text-amber-700">
                              {isAdmin ? "Sélectionnez d’abord un client." : "Impossible de charger les véhicules pour ce client."}
                            </p>
                            {!isAdmin ? (
                              <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 border-slate-300 text-sky-700 focus:ring-sky-500"
                                  checked={vehicleManualMode}
                                  onChange={(e) => {
                                    const checked = e.target.checked
                                    setVehicleManualMode(checked)
                                    if (checked) setImmatDropdownOpen(false)
                                  }}
                                />
                                Enter manually
                              </label>
                            ) : null}
                          </div>
                        ) : vehiclesQuery.isLoading ? (
                          <p className="mt-1 text-xs text-slate-500">Chargement des véhicules…</p>
                        ) : vehicleOptions.length === 0 ? (
                          vehicleManualMode ? (
                            <p className="mt-1 text-xs text-slate-500">Manual entry enabled.</p>
                          ) : (
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <p className="text-rose-700">Aucun véhicule dans ce compte/client.</p>
                              <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 border-slate-300 text-sky-700 focus:ring-sky-500"
                                  checked={vehicleManualMode}
                                  onChange={(e) => {
                                    const checked = e.target.checked
                                    setVehicleManualMode(checked)
                                    if (checked) setImmatDropdownOpen(false)
                                  }}
                                />
                                Enter manually
                              </label>
                            </div>
                          )
                        ) : null}

                        {immatDropdownOpen && !vehicleManualMode && filteredVehicles.length > 0 ? (
                          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                            {filteredVehicles.map((v, idx) => {
                              const label = getVehicleTagLabel(v)
                              if (!label) return null
                              return (
                                <button
                                  key={`${v.id ?? 'v'}-${idx}-${label}`}
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
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
                          <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                            Aucun résultat pour cette recherche.
                          </div>
                        ) : null}
                      </div>

                    </div>

                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                          Options véhicule
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                          {(
                            [
                              ['antivol', 'Antivol'],
                              ['geolocation', 'Géolocalisation'],
                              ['fleetManagement', 'Gestion de flotte FMS'],
                              ['otherOption', 'Autre'],
                              ['camera', 'Camera'],
                              ['alarm', 'Alarm'],
                              ['buzzer', 'Buzzer'],
                              ['canClick', 'CAN Click'],
                              ['alimentationRed', 'Alimentation rouge'],
                              ['alimentationYellow', 'Alimentation jaune'],
                              ['acc', 'ACC'],
                              ['immobilisationCable', 'Immobilisation'],
                              ['fuelGauge', 'Fuel gauge'],
                              ['canH', 'CAN H'],
                              ['canL', 'CAN L'],
                            ] as Array<[keyof InterventionForm, string]>
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-slate-400 text-sky-600 focus:ring-2 focus:ring-sky-500/30"
                                checked={Boolean(form[key])}
                                onChange={(e) => onFormChange(key, e.target.checked as any)}
                              />
                              <span className="text-sm font-medium text-slate-900">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                          Checklist
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                          {(
                            [
                              ['battery12vOk', 'Batterie OK'],
                              ['kitGpsConnected', 'Kit GPS connecté'],
                              ['engineStartsWell', 'Moteur démarre bien'],
                              ['dashboardDefaults', 'Dashboard défauts'],
                              ['buttonsDefaults', 'Boutons défauts'],
                              ['climRadioDefaults', 'Clim / radio défauts'],
                            ] as Array<[keyof InterventionForm, string]>
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-slate-400 text-sky-600 focus:ring-2 focus:ring-sky-500/30"
                                checked={Boolean(form[key])}
                                onChange={(e) => onFormChange(key, e.target.checked as any)}
                              />
                              <span className="text-sm font-medium text-slate-900">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* moved Observations/Installateur/Date to SIGNED_FICHE step */}
                  </div>

                  <div className="mt-6 space-y-3 border-t border-slate-300 pt-4">
                    <p className="text-xs leading-relaxed text-slate-500">{t('draft.autosaveHint')}</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className="order-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:order-1"
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
                        if (currentUserId) clearTaskFormDraft(currentUserId, taskId)
                      }}
                    >
                      Effacer le brouillon
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      className="order-1 w-full rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 sm:order-2 sm:w-auto sm:min-w-[200px]"
                      onClick={() => setStep('SIGNED_FICHE')}
                    >
                      Continuer vers la fiche signée
                    </button>
                    </div>
                  </div>
                </div>
              )}

              {!isAdmin && step === 'SIGNED_FICHE' && (
                <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-slate-900 sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-start gap-3">
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        onClick={() => setStep('FORM')}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Retour au formulaire
                      </button>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-sky-900">Fiche signée</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          Joignez une photo ou un PDF de la fiche signée, complétez les informations puis validez.
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        hasExistingFiche
                          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                          : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200'
                      }`}
                    >
                      {hasExistingFiche ? 'Mise à jour' : 'Nouvelle fiche'}
                    </span>
                  </div>

                  {submitError ? (
                    <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {submitError}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Document</p>
                        <p className="mt-0.5 text-xs text-slate-500">Image ou PDF depuis l’appareil (galerie ou fichiers).</p>
                      </div>
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
                        className="flex min-h-[48px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-center text-sm font-medium text-sky-800 transition hover:border-sky-400 hover:bg-sky-50/50"
                      >
                        <span className="text-sky-700">Choisir un fichier</span>
                        <span className="mt-1 text-xs font-normal text-slate-500">PDF, JPG, PNG…</span>
                      </label>
                      {selectedFile ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                          <span className="min-w-0 truncate">
                            Fichier : <span className="font-semibold">{selectedFile.name}</span>
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={() => setSelectedFile(null)}
                          >
                            Retirer
                          </button>
                        </div>
                      ) : ficheUrl ? (
                        <p className="text-sm text-slate-600">
                          Fiche déjà enregistrée sur le serveur. Vous pouvez en choisir une nouvelle pour la remplacer.
                        </p>
                      ) : (
                        <p className="text-sm text-amber-800">Un document est requis pour valider.</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {localFilePreviewSrc || fichePreviewSrc ? (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                            onClick={() => setFullPreviewOpen(true)}
                          >
                            Plein écran
                          </button>
                        ) : null}
                        {ficheUrl ? (
                          <button
                            type="button"
                            disabled={taskQuery.isFetching}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                            onClick={() => taskQuery.refetch()}
                          >
                            {taskQuery.isFetching ? 'Actualisation…' : 'Actualiser depuis le serveur'}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Aperçu</p>
                      <div className="min-h-[12rem] rounded-lg border border-slate-100 bg-slate-50/50">
                        {localFilePreviewSrc ? (
                          selectedFile?.type === 'application/pdf' ? (
                            <iframe title="Aperçu fiche signée" src={localFilePreviewSrc} className="h-80 w-full rounded-md" />
                          ) : (
                            <img
                              src={localFilePreviewSrc}
                              alt="Aperçu fiche signée"
                              className="max-h-80 w-full rounded-md object-contain"
                            />
                          )
                        ) : !ficheUrl ? (
                          <p className="p-4 text-sm text-slate-500">Aucun aperçu — choisissez un fichier.</p>
                        ) : previewError ? (
                          <p className="p-4 text-sm text-rose-700">{previewError}</p>
                        ) : fichePreviewSrc ? (
                          ficheExt === 'pdf' ? (
                            <iframe title="Aperçu fiche signée" src={fichePreviewSrc} className="h-80 w-full rounded-md" />
                          ) : (
                            <img
                              src={fichePreviewSrc}
                              alt="Aperçu fiche signée"
                              className="max-h-80 w-full rounded-md object-contain"
                            />
                          )
                        ) : (
                          <p className="p-4 text-sm text-slate-500">Chargement de l’aperçu…</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {fullPreviewOpen ? (
                    <div className="fixed inset-0 z-50 flex">
                      <button
                        type="button"
                        className="h-full w-full bg-black/70"
                        onClick={() => setFullPreviewOpen(false)}
                        aria-label="Fermer l’aperçu plein écran"
                      />
                      <div className="absolute inset-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl md:inset-8">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800">Fiche signée</p>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={() => setFullPreviewOpen(false)}
                          >
                            Fermer
                          </button>
                        </div>
                        <div className="h-[calc(100%-52px)] bg-black/5">
                          {(() => {
                            const src = localFilePreviewSrc || fichePreviewSrc
                            if (!src) return <div className="p-4 text-sm text-slate-600">Aucun aperçu disponible.</div>
                            const isPdf =
                              (selectedFile?.type === 'application/pdf' && !!localFilePreviewSrc) || ficheExt === 'pdf'
                            return isPdf ? (
                              <iframe title="Fiche signée plein écran" src={src} className="h-full w-full" />
                            ) : (
                              <img src={src} alt="Fiche signée plein écran" className="h-full w-full object-contain" />
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Informations complémentaires</p>
                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Observations
                        </label>
                        <textarea
                          rows={4}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20"
                          value={form.observations ?? ''}
                          onChange={(e) => onFormChange('observations', e.target.value)}
                          placeholder="Notes éventuelles…"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Installateur
                        </label>
                        <input
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20"
                          value={form.installerName ?? ''}
                          onChange={(e) => onFormChange('installerName', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Date
                        </label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20"
                          value={form.date ?? ''}
                          onChange={(e) => onFormChange('date', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 z-10 mt-6 border-t border-slate-300 bg-slate-100/95 py-4 backdrop-blur-sm">
                    <button
                      type="button"
                      disabled={submittingForm || (!selectedFile && !ficheUrl)}
                      className="w-full rounded-lg bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 sm:text-sm"
                      onClick={handleSubmitForm}
                    >
                      {submittingForm
                        ? hasExistingFiche
                          ? 'Enregistrement…'
                          : 'Envoi…'
                        : hasExistingFiche
                          ? taskType === 'INSTALLATION'
                            ? 'Mettre à jour l’installation'
                            : 'Mettre à jour l’intervention'
                          : taskType === 'INSTALLATION'
                            ? 'Créer l’installation'
                            : 'Créer l’intervention'}
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

