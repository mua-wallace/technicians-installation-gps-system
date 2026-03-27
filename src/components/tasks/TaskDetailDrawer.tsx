import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TaskAssignment, TaskFormRow, TaskStatus, TaskType } from '../../api/tasks'
import { tasksApi } from '../../api/tasks'
import type { InterventionForm } from '../../store/useAppStore'
import { usersApi } from '../../api/users'
import type { ClientRow } from '../../api/users'
import type { ClientVehicleRow } from '../../api/users'
import { ConfirmDialog } from '../ui/ConfirmDialog'

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

function isoToDateInput(value?: string | null): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
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
}: Props) {
  const [step, setStep] = useState<Step>('FORM')
  const [taskType, setTaskType] = useState<TaskType>('INSTALLATION')
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('ASSIGNED')

  const [form, setForm] = useState<InterventionForm>(DEFAULT_FORM)
  const [ficheUrl, setFicheUrl] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  /** Blob URL from API, or direct https URL (e.g. Cloudinary) for the signed fiche preview */
  const [fichePreviewSrc, setFichePreviewSrc] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string>('')
  const [submitError, setSubmitError] = useState<string>('')
  const [submittingForm, setSubmittingForm] = useState(false)
  const [deleteError, setDeleteError] = useState<string>('')
  const [deletingTask, setDeletingTask] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState<TaskType>('INSTALLATION')
  const [editScheduled, setEditScheduled] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [taskSaveError, setTaskSaveError] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignLeadId, setReassignLeadId] = useState<number | null>(null)
  const [reassignAssistantIds, setReassignAssistantIds] = useState<number[]>([])
  const [techSearch, setTechSearch] = useState('')
  const [reassignBusy, setReassignBusy] = useState(false)
  const [reassignError, setReassignError] = useState('')
  const [startConfirmOpen, setStartConfirmOpen] = useState(false)
  const [startAnchorRect, setStartAnchorRect] = useState<{
    top: number
    left: number
    right: number
    bottom: number
    width: number
    height: number
  } | null>(null)

  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [clientTouched, setClientTouched] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [immatSearch, setImmatSearch] = useState('')
  const [immatDropdownOpen, setImmatDropdownOpen] = useState(false)

  const taskQuery = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getTask(taskId),
    enabled: open && !!taskId,
  })

  const assignments: TaskAssignment[] = useMemo(() => taskQuery.data?.assignments ?? [], [taskQuery.data])
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

    const tType = taskQuery.data.task?.type ?? 'INSTALLATION'
    setTaskType(tType)
    setTaskStatus(taskQuery.data.task?.status ?? 'ASSIGNED')
    setEditTitle(taskQuery.data.task?.title ?? '')
    setEditType(tType)
    setEditScheduled(isoToDateInput(taskQuery.data.task?.scheduledDate))
    setTaskSaveError('')

    const initialAssignments = taskQuery.data.assignments ?? []
    const lead = initialAssignments.find((a) => a.isLead)?.technicianId ?? null
    const assistants = initialAssignments.filter((a) => !a.isLead).map((a) => a.technicianId)
    setReassignLeadId(lead)
    setReassignAssistantIds(assistants)
    setTechSearch('')
    setReassignError('')

    const backendForm = taskQuery.data.form as TaskFormRow | undefined
    const nextForm = { ...DEFAULT_FORM, ...(backendForm ?? {}) } as InterventionForm
    // Ensure `date` is compatible with `<input type="date">`
    nextForm.date = formatInputDate(nextForm.date)
    if (!nextForm.year) nextForm.year = getLocalCurrentYearString()
    if (!nextForm.date) nextForm.date = getLocalTodayInputValue()
    if (!nextForm.installerName) nextForm.installerName = installerDefaultName
    setForm(nextForm)
    setClientSearch(nextForm.client ?? '')
    setClientTouched(false)
    setSelectedClientId(null)
    setImmatSearch(nextForm.immatriculation ?? '')
    setImmatDropdownOpen(false)

    setFicheUrl(backendForm?.ficheUrl ?? null)
    setStep(backendForm?.ficheUrl ? 'SIGNED_FICHE' : 'FORM')
    setSelectedFile(null)
    setPreviewError('')
  }, [taskQuery.data])

  const initialEdit = useMemo(() => {
    const t = taskQuery.data?.task
    return {
      title: (t?.title ?? '').trim(),
      type: (t?.type ?? 'INSTALLATION') as TaskType,
      scheduled: isoToDateInput(t?.scheduledDate),
    }
  }, [taskQuery.data?.task?.title, taskQuery.data?.task?.type, taskQuery.data?.task?.scheduledDate])

  const isTaskDirty = useMemo(() => {
    return (
      editTitle.trim() !== initialEdit.title ||
      editType !== initialEdit.type ||
      editScheduled !== initialEdit.scheduled
    )
  }, [editTitle, editType, editScheduled, initialEdit])

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
    enabled: open && step === 'FORM',
    staleTime: 10 * 60_000,
  })

  const clientOptions: ClientRow[] = clientsQuery.data ?? []

  const filteredClients = useMemo(() => {
    const q = (clientSearch ?? '').trim().toLowerCase()
    if (!q) return clientOptions.filter((c) => getClientLabel(c)).slice(0, 30)
    return clientOptions
      .filter((c) => getClientLabel(c).toLowerCase().includes(q))
      .slice(0, 30)
  }, [clientOptions, clientSearch])

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

  const isBusy = taskQuery.isFetching

  const onFormChange = <K extends keyof InterventionForm>(key: K, value: InterventionForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmitForm = async () => {
    if (!taskQuery.data) return
    setSubmitError('')
    try {
      setSubmittingForm(true)
      let nextFicheUrl = ficheUrl
      if (selectedFile) {
        const uploadResp = await tasksApi.uploadSignedFiche(taskId, selectedFile, taskType)
        nextFicheUrl = uploadResp?.ficheUrl ?? nextFicheUrl
        setSelectedFile(null)
      }

      if (!nextFicheUrl) {
        setSubmitError('Veuillez ajouter la fiche signée avant de mettre à jour.')
        return
      }

      const payload: any = sanitizeFormPayload({
        ...form,
        // Match DTO: date should be YYYY-MM-DD string.
        date: formatInputDate(form.date),
      })
      payload.ficheUrl = nextFicheUrl

      const resp =
        taskType === 'INSTALLATION'
          ? await tasksApi.submitInstallationForm(taskId, payload)
          : await tasksApi.submitInterventionForm(taskId, payload)

      const updatedForm = resp?.form
      setFicheUrl(updatedForm?.ficheUrl ?? nextFicheUrl ?? ficheUrl)
      setStep('SIGNED_FICHE')
      const nextStatus = resp?.task?.status ?? taskStatus

      // Desired workflow: when a technician submits the form, the task should become COMPLETED.
      if (!isAdmin && isTechnicianAssigned) {
        try {
          await tasksApi.updateTaskStatus(taskId, 'COMPLETED')
          setTaskStatus('COMPLETED')
        } catch {
          // If backend already updates status (or rejects), fallback to response status.
          setTaskStatus(nextStatus)
        }
      } else {
        setTaskStatus(nextStatus)
      }
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
      if (editTitle.trim() !== initialEdit.title) payload.title = editTitle.trim()
      // Backend rejects `type` on PATCH /tasks/:id (it returns: "property type should not exist")
      // so we intentionally never send it from the UI.
      if (editScheduled !== initialEdit.scheduled) payload.scheduledDate = editScheduled || undefined

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
    const title = taskQuery.data?.task?.title ?? 'this task'
    const ok = window.confirm(`Delete "${title}"? This action cannot be undone.`)
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
                {taskQuery.data?.task?.title ?? 'Task'}
              </span>
              <span className="rounded-full bg-slate-300/70 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-900">
                {taskType}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/30">
                {taskStatus}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Step {step === 'FORM' ? '1/2' : '2/2'}: {step === 'FORM' ? 'Fill the correct form' : 'Upload signed fiche'}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            onClick={onClose}
          >
            <span className="sr-only">Fermer</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {taskQuery.isLoading && (
            <div className="rounded-xl border border-slate-300 bg-white/60 p-6 text-sm text-slate-700">
              Loading task…
            </div>
          )}

          {taskQuery.isError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-700">
              Failed to load task.
            </div>
          )}

          {taskQuery.data && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                    Assigned technicians
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{assignedTechnicianNames}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Actions</span>
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

                  <div className="mt-3">
                    <input
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                      placeholder="Search technician (name / username / ID)"
                      value={techSearch}
                      onChange={(e) => setTechSearch(e.target.value)}
                    />
                  </div>

                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {techniciansQuery.isLoading ? (
                      <p className="text-sm text-slate-500">Loading technicians…</p>
                    ) : technicianOptions.length === 0 ? (
                      <p className="text-sm text-slate-500">No technicians available.</p>
                    ) : filteredTechnicians.length === 0 ? (
                      <p className="text-sm text-slate-500">No technicians match your search.</p>
                    ) : (
                      filteredTechnicians.map((tech) => {
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
                      })
                    )}
                  </div>

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
                      <p className="mt-1 text-xs text-slate-500">Prefilled from the existing task. Update is disabled until changes.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!isTaskDirty || savingTask}
                        className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        onClick={() => {
                          setEditTitle(initialEdit.title)
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

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Title</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="e.g. Installation GPS - Toyota Hilux"
                      />
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
                        <p className="mt-1 text-[11px] text-slate-500">Le type ne peut pas être modifié.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Scheduled date (optional)
                        </label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={editScheduled}
                          onChange={(e) => setEditScheduled(e.target.value)}
                        />
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
                        <div>
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
                              ['battery12vOk', 'Batterie 12V OK'],
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
                  <h3 className="text-sm font-semibold text-sky-900">
                    {taskType === 'INSTALLATION' ? "Fiche d'installation" : "Fiche d'intervention"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Remplissez et enregistrez la fiche, puis chargez la fiche signée à l'étape suivante.
                  </p>
                  {submitError ? <p className="mt-2 text-xs text-rose-700">{submitError}</p> : null}

                  <div className="mt-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Client dropdown (searchable) */}
                      <div className="relative">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Client
                        </label>
                        <input
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={clientTouched ? clientSearch : form.client ?? ''}
                          onChange={(e) => {
                            setClientSearch(e.target.value)
                            setClientTouched(true)
                            setClientDropdownOpen(true)
                            setSelectedClientId(null)
                            setImmatSearch('')
                            setImmatDropdownOpen(false)
                            onFormChange('immatriculation', '' as any)
                            onFormChange('client', e.target.value)
                          }}
                          onFocus={() => {
                            setClientDropdownOpen(true)
                            setClientTouched(true)
                            if (!clientSearch) setClientSearch(form.client ?? '')
                          }}
                          onBlur={() => {
                            // keep option click workable
                            setTimeout(() => setClientDropdownOpen(false), 120)
                          }}
                          placeholder="Rechercher un client…"
                        />
                        {form.client ? (
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-600">
                              Client sélectionné: <span className="font-medium text-slate-800">{form.client}</span>
                            </span>
                            <button
                              type="button"
                              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600 hover:bg-slate-50"
                              onClick={() => {
                                setForm((prev) => ({ ...prev, client: '' }))
                                setClientSearch('')
                                setClientTouched(false)
                                setClientDropdownOpen(false)
                                setSelectedClientId(null)
                                setImmatSearch('')
                                setImmatDropdownOpen(false)
                                onFormChange('client', '' as any)
                                onFormChange('immatriculation', '' as any)
                              }}
                            >
                              Changer
                            </button>
                          </div>
                        ) : null}
                        {clientDropdownOpen && filteredClients.length > 0 ? (
                          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                            {filteredClients.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  const clientLabel = getClientLabel(c)
                                  setForm((prev) => ({ ...prev, client: clientLabel }))
                                  setClientSearch(clientLabel)
                                  setClientTouched(true)
                                  setClientDropdownOpen(false)
                                  setSelectedClientId(c.id)
                                  setImmatSearch('')
                                  setImmatDropdownOpen(true)
                                  onFormChange('immatriculation', '' as any)
                                  onFormChange('client', clientLabel as any)
                                }}
                              >
                                {getClientLabel(c)}
                              </button>
                            ))}
                          </div>
                        ) : clientDropdownOpen ? (
                          <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                            {clientsQuery.isLoading
                              ? 'Chargement des clients…'
                              : clientOptions.length === 0
                                ? 'Aucun client disponible.'
                                : 'Aucun résultat pour cette recherche.'}
                          </div>
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
                          disabled={!selectedClientId}
                          onChange={(e) => {
                            setImmatSearch(e.target.value)
                            setImmatDropdownOpen(true)
                            onFormChange('immatriculation', e.target.value)
                          }}
                          onFocus={() => {
                            setImmatDropdownOpen(true)
                            if (!immatSearch) setImmatSearch(form.immatriculation ?? '')
                          }}
                          onBlur={() => {
                            setTimeout(() => setImmatDropdownOpen(false), 120)
                          }}
                          placeholder={selectedClientId ? 'Rechercher un tag véhicule' : 'Sélectionnez d’abord un client'}
                        />
                        {selectedClientId && vehicleOptions.length > 0 ? (
                          <p className="mt-1 text-xs text-slate-500">{vehicleOptions.length} véhicule(s) trouvé(s)</p>
                        ) : null}
                        {!selectedClientId ? (
                          <p className="mt-1 text-xs text-amber-700">Sélectionnez d’abord un client.</p>
                        ) : vehiclesQuery.isLoading ? (
                          <p className="mt-1 text-xs text-slate-500">Chargement des véhicules…</p>
                        ) : vehicleOptions.length === 0 ? (
                          <p className="mt-1 text-xs text-rose-700">Aucun véhicule dans ce compte/client.</p>
                        ) : null}

                        {immatDropdownOpen && filteredVehicles.length > 0 ? (
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
                              ['battery12vOk', 'Batterie 12V OK'],
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

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Observations
                        </label>
                        <textarea
                          rows={4}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={form.observations ?? ''}
                          onChange={(e) => onFormChange('observations', e.target.value)}
                        />
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Installateur
                          </label>
                          <input
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
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
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                            value={form.date ?? ''}
                            onChange={(e) => onFormChange('date', e.target.value)}
                          />
                        </div>
                      </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 pt-4">
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          ...DEFAULT_FORM,
                          year: getLocalCurrentYearString(),
                          date: getLocalTodayInputValue(),
                          installerName: installerDefaultName,
                        }))
                        setClientSearch('')
                        setClientTouched(false)
                        setClientDropdownOpen(false)
                        setSelectedClientId(null)
                        setImmatSearch('')
                        setImmatDropdownOpen(false)
                        setSelectedFile(null)
                      }}
                    >
                      Effacer
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      className="rounded-md bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                      onClick={() => setStep('SIGNED_FICHE')}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {!isAdmin && step === 'SIGNED_FICHE' && (
                <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-slate-900">
                  <h3 className="text-sm font-semibold text-sky-900">Fiche signée</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Étape 2/2: Ajoutez la fiche signée (obligatoire), puis cliquez sur Update.
                  </p>
                  {submitError ? <p className="mt-2 text-xs text-rose-700">{submitError}</p> : null}

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-4">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Fichier (image ou PDF)
                      </label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="w-full text-sm text-slate-700"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          setSelectedFile(f)
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={submittingForm || (!selectedFile && !ficheUrl)}
                          className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                          onClick={handleSubmitForm}
                        >
                          {submittingForm ? 'Updating…' : 'Update'}
                        </button>
                        {ficheUrl ? (
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={() => setStep('SIGNED_FICHE')}
                          >
                            Actualiser l'aperçu
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-300 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Aperçu
                      </p>
                      {!ficheUrl ? (
                        <p className="text-sm text-slate-500">Aucune fiche signée chargée.</p>
                      ) : previewError ? (
                        <p className="text-sm text-rose-300">{previewError}</p>
                      ) : fichePreviewSrc ? (
                        ficheExt === 'pdf' ? (
                          <iframe title="Signed fiche preview" src={fichePreviewSrc} className="h-80 w-full rounded-md" />
                        ) : (
                          <img src={fichePreviewSrc} alt="Signed fiche preview" className="max-h-80 w-full rounded-md object-contain" />
                        )
                      ) : (
                        <p className="text-sm text-slate-500">Chargement de l'aperçu…</p>
                      )}
                    </div>
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

