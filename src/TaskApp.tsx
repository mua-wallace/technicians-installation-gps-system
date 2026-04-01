import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type TaskListItem, type TaskStatus, type TaskType } from './api/tasks'
import { usersApi } from './api/users'
import type { ClientRow } from './api/users'
import { useAuthStore } from './store/auth.store'
import { TaskDetailDrawer } from './components/tasks/TaskDetailDrawer'
import { TaskList } from './components/tasks/TaskList'

function getClientLabel(c: ClientRow): string {
  return String(c.name ?? c.fullname ?? c.company ?? c.username ?? '').trim()
}

function getNowLocalDatetimeInputValue(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function datetimeLocalToIso(value: string): string | undefined {
  // `datetime-local` yields `YYYY-MM-DDTHH:mm` (sometimes seconds), without timezone.
  // We interpret it as local time and convert to an absolute ISO string.
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

export function TaskApp() {
  const queryClient = useQueryClient()

  const authUser = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const meQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: usersApi.me,
    enabled: true,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (meQuery.data) setProfile(meQuery.data)
  }, [meQuery.data, setProfile])

  const displayName = profile?.fullname || profile?.username || authUser?.username || '—'
  const roleLower = (profile?.role ?? '').toLowerCase()
  const isAdmin = roleLower.includes('admin') || roleLower.includes('supervisor')
  const roleLabel = useMemo(() => {
    if (roleLower.includes('admin')) return 'Admin'
    if (roleLower.includes('supervisor')) return 'Supervisor'
    return 'Technician'
  }, [roleLower])

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')

  const tasksQuery = useQuery({
    // Search is applied client-side so it matches all visible columns (incl. technicians).
    queryKey: ['tasks', { typeFilter, statusFilter }],
    queryFn: () =>
      tasksApi.listTasks({
        page: 1,
        limit: 200,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: undefined,
        include: 'assignments,technicians,form',
      }),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })

  const myUserId = profile?.id

  const tasksForUI = useMemo(() => {
    const tasks: TaskListItem[] = tasksQuery.data?.data ?? []
    const scoped = isAdmin
      ? tasks
      : !myUserId
        ? []
        : tasks.filter((t) => t.assignments?.some((a) => a.technicianId === myUserId))

    const q = search.trim().toLowerCase()
    const filtered = !q
      ? scoped
      : scoped.filter((t) => {
          const scheduled = t.scheduledDate ? new Date(t.scheduledDate).toLocaleDateString() : ''
          const technicians =
            (t.assignments ?? [])
              .map((a) => a.technician?.fullname || a.technician?.username || String(a.technicianId ?? ''))
              .filter(Boolean)
              .join(' ') ?? ''
          const haystack = [
            t.client ?? '',
            t.type ?? '',
            t.status ?? '',
            t.typeEquipment ?? '',
            t.equipmentMake ?? '',
            t.equipmentModel ?? '',
            t.equipmentVersion ?? '',
            scheduled,
            technicians,
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(q)
        })

    // Latest first (fallback order: updatedAt -> createdAt -> scheduledDate)
    return [...filtered].sort((a, b) => {
      const aKey = a.updatedAt || a.createdAt || a.scheduledDate || ''
      const bKey = b.updatedAt || b.createdAt || b.scheduledDate || ''
      const aMs = aKey ? new Date(aKey).getTime() : 0
      const bMs = bKey ? new Date(bKey).getTime() : 0
      return bMs - aMs
    })
  }, [tasksQuery.data, isAdmin, myUserId, search])

  // Admin create/assign (minimal wiring; technicians must be entered by ID)
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [adminClient, setAdminClient] = useState('')
  const [adminNumberOfInstallations, setAdminNumberOfInstallations] = useState<number>(1)
  const [adminTypeEquipment, setAdminTypeEquipment] = useState('DashCam')
  const [adminEquipmentMake, setAdminEquipmentMake] = useState('Teltonika')
  const [adminEquipmentModel, setAdminEquipmentModel] = useState('FMC650')
  const [adminEquipmentVersion, setAdminEquipmentVersion] = useState('v2')
  const [adminType, setAdminType] = useState<TaskType>('INSTALLATION')
  const [adminScheduledDate, setAdminScheduledDate] = useState(getNowLocalDatetimeInputValue())
  const [adminLeadId, setAdminLeadId] = useState<number | null>(null)
  const [adminAssistantIds, setAdminAssistantIds] = useState<number[]>([])
  const [adminCreatedTaskId, setAdminCreatedTaskId] = useState<string | null>(null)
  const [adminTechSearch, setAdminTechSearch] = useState('')
  const [adminError, setAdminError] = useState<string>('')
  const [adminBusy, setAdminBusy] = useState<boolean>(false)
  const [adminClientSearch, setAdminClientSearch] = useState('')
  const [adminClientDropdownOpen, setAdminClientDropdownOpen] = useState(false)
  const [adminClientTouched, setAdminClientTouched] = useState(false)
  const [adminTechniciansOpen, setAdminTechniciansOpen] = useState(false)

  const techniciansQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersApi.list({ role: 'technicien', page: 1, limit: 100 }),
    enabled: isAdmin && adminModalOpen,
    staleTime: 60_000,
  })

  const clientsQuery = useQuery({
    queryKey: ['clients', 1, 2000],
    queryFn: () => usersApi.listClients({ page: 1, limit: 2000 }),
    enabled: isAdmin && adminModalOpen,
    staleTime: 10 * 60_000,
  })

  const clientOptions: ClientRow[] = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data])

  const filteredClients = useMemo(() => {
    const q = (adminClientSearch ?? '').trim().toLowerCase()
    const base = clientOptions
      .map((c) => ({ id: c.id, label: getClientLabel(c) }))
      .filter((x) => x.label)
    if (!q) return base.slice(0, 30)
    return base.filter((x) => x.label.toLowerCase().includes(q)).slice(0, 30)
  }, [clientOptions, adminClientSearch])

  const technicianOptions = useMemo(() => {
    return techniciansQuery.data ?? []
  }, [techniciansQuery.data])

  const filteredTechnicians = useMemo(() => {
    const q = adminTechSearch.trim().toLowerCase()
    if (!q) return technicianOptions
    return technicianOptions.filter((tech) => {
      const fullname = (tech.fullname ?? '').toLowerCase()
      const username = (tech.username ?? '').toLowerCase()
      const id = String(tech.id)
      return fullname.includes(q) || username.includes(q) || id.includes(q)
    })
  }, [technicianOptions, adminTechSearch])

  const adminSelectedLead = useMemo(
    () => technicianOptions.find((t) => t.id === adminLeadId) ?? null,
    [technicianOptions, adminLeadId],
  )

  const adminSelectedAssistants = useMemo(
    () => technicianOptions.filter((t) => adminAssistantIds.includes(t.id)),
    [technicianOptions, adminAssistantIds],
  )

  const resetAdmin = () => {
    setAdminClient('')
    setAdminNumberOfInstallations(1)
    setAdminTypeEquipment('DashCam')
    setAdminEquipmentMake('Teltonika')
    setAdminEquipmentModel('FMC650')
    setAdminEquipmentVersion('v2')
    setAdminType('INSTALLATION')
    setAdminScheduledDate(getNowLocalDatetimeInputValue())
    setAdminLeadId(null)
    setAdminAssistantIds([])
    setAdminCreatedTaskId(null)
    setAdminTechSearch('')
    setAdminError('')
    setAdminBusy(false)
    setAdminClientSearch('')
    setAdminClientDropdownOpen(false)
    setAdminClientTouched(false)
    setAdminTechniciansOpen(false)
  }

  const canSubmitAdmin =
    adminClient.trim().length > 0 &&
    adminNumberOfInstallations > 0 &&
    adminTypeEquipment.trim().length > 0 &&
    adminEquipmentMake.trim().length > 0 &&
    adminEquipmentModel.trim().length > 0

  const handleAdminSubmit = async () => {
    const technicians = adminLeadId
      ? [
          { technicianId: adminLeadId, isLead: true },
          ...adminAssistantIds
            .filter((id) => id !== adminLeadId)
            .map((id) => ({ technicianId: id, isLead: false })),
        ]
      : []

    try {
      setAdminError('')
      setAdminBusy(true)
      const scheduledDateIso = datetimeLocalToIso(adminScheduledDate)
      const created = await tasksApi.createTask({
        client: adminClient.trim(),
        numberOfInstallations: adminNumberOfInstallations,
        typeEquipment: adminTypeEquipment.trim(),
        equipmentMake: adminEquipmentMake.trim(),
        equipmentModel: adminEquipmentModel.trim(),
        equipmentVersion: adminEquipmentVersion.trim() || undefined,
        type: adminType,
        scheduledDate: scheduledDateIso,
      })
      setAdminCreatedTaskId(created.id)
      if (technicians.length > 0) {
        await tasksApi.assignTaskTechnicians(created.id, technicians)
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setAdminModalOpen(false)
      resetAdmin()
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.message ??
        'Failed to create and assign task.'
      setAdminError(Array.isArray(msg) ? msg.join(', ') : String(msg))
    } finally {
      setAdminBusy(false)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col px-3 md:px-6">
        <header className="flex shrink-0 flex-col gap-4 border-b border-slate-200 bg-white py-4 md:h-20 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">Malambi</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-sky-700">Tableau de bord</h1>
            <p className="text-sm text-slate-500">Tâches, fiches et validation</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-700">
                <span className="text-slate-600">{roleLabel}:</span>
                <span className="min-w-0 truncate font-medium text-slate-900">{displayName}</span>
                {meQuery.isFetching ? <span className="text-slate-600">(sync…)</span> : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              {isAdmin ? (
                <button
                  type="button"
                  className="min-h-10 rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-50 shadow-sm hover:bg-sky-700"
                  onClick={() => {
                    resetAdmin()
                    setAdminModalOpen(true)
                  }}
                >
                  Create Task
                </button>
              ) : null}

              <button
                type="button"
                className="min-h-10 rounded-md bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-rose-700"
                onClick={() => {
                  clearAuth()
                  window.location.href = '/login'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-4 py-4 lg:gap-6 lg:flex">
          <aside className="hidden w-56 shrink-0 space-y-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 lg:block">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Overview</p>
              <p className="text-sm font-medium text-slate-900">
                {tasksForUI.length} task{tasksForUI.length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">My tasks are filtered by assignment.</p>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <TaskList
              tasks={tasksForUI}
              loading={tasksQuery.isLoading}
              onSelectTask={(id) => setSelectedTaskId(id)}
              showTechnicians={isAdmin}
              title={isAdmin ? 'All tasks' : 'My tasks'}
              search={search}
              onSearchChange={setSearch}
              typeFilter={typeFilter}
              onTypeFilterChange={(v) => setTypeFilter((v as TaskType | '') || '')}
              statusFilter={statusFilter}
              onStatusFilterChange={(v) => setStatusFilter((v as TaskStatus | '') || '')}
            />
          </div>
        </main>
      </div>

      {selectedTaskId ? (
        <TaskDetailDrawer
          open={true}
          taskId={selectedTaskId}
          currentUserId={profile?.id ?? null}
          installerDefaultName={profile?.fullname ?? profile?.username ?? ''}
          isAdmin={isAdmin}
          onTaskDeleted={async () => {
            await queryClient.invalidateQueries({ queryKey: ['tasks'] })
            setSelectedTaskId(null)
          }}
          onTaskUpdated={async () => {
            await queryClient.invalidateQueries({ queryKey: ['tasks'] })
          }}
          onClose={() => setSelectedTaskId(null)}
        />
      ) : null}

      {adminModalOpen ? (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" className="h-full w-full bg-black/40" onClick={() => setAdminModalOpen(false)} />
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                  Create task
                </p>
                <p className="text-[11px] text-slate-500">
                  Fill the task details first, then (optionally) assign technicians. Required fields are marked *.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setAdminModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="px-4 py-4">
              <div className="space-y-4">
                {adminError ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {adminError}
                  </p>
                ) : null}
                {adminCreatedTaskId ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Last created task ID: <span className="font-semibold">{adminCreatedTaskId}</span>
                  </p>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Task details</p>
                  <p className="mt-1 text-[11px] text-slate-500">Who, what device, how many, and when.</p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Client <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-0"
                          value={adminClientTouched ? adminClientSearch : adminClient}
                          onChange={(e) => {
                            const v = e.target.value
                            setAdminClient(v)
                            setAdminClientSearch(v)
                            setAdminClientTouched(true)
                            setAdminClientDropdownOpen(true)
                          }}
                          onFocus={() => {
                            setAdminClientTouched(true)
                            setAdminClientDropdownOpen(true)
                            if (!adminClientSearch) setAdminClientSearch(adminClient)
                          }}
                          onBlur={() => {
                            setTimeout(() => setAdminClientDropdownOpen(false), 120)
                          }}
                          placeholder={clientsQuery.isLoading ? 'Loading clients…' : 'Select a client or type a new name'}
                        />
                        {adminClientDropdownOpen ? (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                            {clientsQuery.isLoading ? (
                              <div className="px-3 py-2 text-sm text-slate-500">Loading clients…</div>
                            ) : filteredClients.length > 0 ? (
                              <div className="max-h-56 overflow-y-auto">
                                {filteredClients.map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setAdminClient(c.label)
                                      setAdminClientSearch(c.label)
                                      setAdminClientTouched(true)
                                      setAdminClientDropdownOpen(false)
                                    }}
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2 text-sm text-slate-500">
                                No match. You can keep typing to create a new client name.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {!adminClient.trim() ? (
                        <p className="mt-1 text-[11px] text-slate-500">Use the customer/company name.</p>
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Task type</label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={adminType}
                          onChange={(e) => setAdminType(e.target.value as TaskType)}
                        >
                          <option value="INSTALLATION">INSTALLATION</option>
                          <option value="INTERVENTION">INTERVENTION</option>
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500">Used to route the right technician workflow.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Scheduled date-time (optional)
                        </label>
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={adminScheduledDate}
                          onChange={(e) => setAdminScheduledDate(e.target.value)}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">Local time will be converted to UTC for the API.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Equipment</p>
                  <p className="mt-1 text-[11px] text-slate-500">Helps technicians prepare the right device.</p>

                  <datalist id="equipment-make-options">
                    <option value="Teltonika" />
                    <option value="Queclink" />
                    <option value="Ruptela" />
                    <option value="Concox" />
                  </datalist>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Number of installations <span className="text-rose-600">*</span>
                      </label>
                      <div className="mt-1 flex items-stretch gap-2">
                        <button
                          type="button"
                          className="w-10 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => setAdminNumberOfInstallations((n) => Math.max(1, n - 1))}
                          aria-label="Decrease installations"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={adminNumberOfInstallations}
                          onChange={(e) => setAdminNumberOfInstallations(Math.max(1, Number(e.target.value || 1)))}
                        />
                        <button
                          type="button"
                          className="w-10 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => setAdminNumberOfInstallations((n) => Math.max(1, n + 1))}
                          aria-label="Increase installations"
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">For bulk installs, set the total quantity.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Type equipment <span className="text-rose-600">*</span>
                      </label>
                      <select
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                        value={adminTypeEquipment}
                        onChange={(e) => setAdminTypeEquipment(e.target.value)}
                      >
                        <option value="DashCam">DashCam</option>
                        <option value="GPS">GPS</option>
                        <option value="Camera Secondaire">Camera Secondaire</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Equipment make <span className="text-rose-600">*</span>
                      </label>
                      <input
                        list="equipment-make-options"
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                        value={adminEquipmentMake}
                        onChange={(e) => setAdminEquipmentMake(e.target.value)}
                        placeholder="e.g. Teltonika"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Equipment model <span className="text-rose-600">*</span>
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                        value={adminEquipmentModel}
                        onChange={(e) => setAdminEquipmentModel(e.target.value)}
                        placeholder="e.g. FMC650"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Equipment version (optional)
                    </label>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                      value={adminEquipmentVersion}
                      onChange={(e) => setAdminEquipmentVersion(e.target.value)}
                      placeholder="e.g. v2"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Assignment (optional)</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Choose a lead technician and any assistants. You can leave this empty and assign later.
                  </p>
                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                    onClick={() => setAdminTechniciansOpen((s) => !s)}
                  >
                    <span className="min-w-0 truncate">
                      {adminSelectedLead ? (
                        <>
                          <span className="font-semibold">Lead:</span>{' '}
                          {adminSelectedLead.fullname || adminSelectedLead.username}
                        </>
                      ) : (
                        <span className="text-slate-600">Select technicians…</span>
                      )}
                      <span className="text-slate-500">
                        {adminSelectedAssistants.length > 0 ? ` · Assistants: ${adminSelectedAssistants.length}` : ''}
                      </span>
                    </span>
                    <svg
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${adminTechniciansOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {adminTechniciansOpen ? (
                    <div className="mt-3">
                      <input
                        className="mb-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                        placeholder="Search by name, username or ID"
                        value={adminTechSearch}
                        onChange={(e) => setAdminTechSearch(e.target.value)}
                      />
                      {(adminSelectedLead || adminSelectedAssistants.length > 0) && (
                        <div className="mb-2 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700">
                          <p>
                            Lead:{' '}
                            <span className="font-semibold text-slate-900">
                              {adminSelectedLead ? adminSelectedLead.fullname || adminSelectedLead.username : 'Not selected'}
                            </span>
                          </p>
                          <p>
                            Assistants:{' '}
                            <span className="font-semibold text-slate-900">
                              {adminSelectedAssistants.length > 0
                                ? adminSelectedAssistants.map((t) => t.fullname || t.username).join(', ')
                                : 'None'}
                            </span>
                          </p>
                        </div>
                      )}
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                        {techniciansQuery.isLoading ? (
                          <p className="text-sm text-slate-500">Loading technicians…</p>
                        ) : technicianOptions.length === 0 ? (
                          <p className="text-sm text-slate-500">No technicians available.</p>
                        ) : filteredTechnicians.length === 0 ? (
                          <p className="text-sm text-slate-500">No technicians match your search.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {filteredTechnicians.map((tech) => {
                              const isLead = adminLeadId === tech.id
                              const isAssistant = adminAssistantIds.includes(tech.id)
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
                                        name="lead-technician"
                                        checked={isLead}
                                        onChange={() => {
                                          setAdminLeadId(tech.id)
                                          setAdminAssistantIds((prev) => prev.filter((id) => id !== tech.id))
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
                                          setAdminAssistantIds((prev) => {
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
                    </div>
                  ) : null}
                </div>

                <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => resetAdmin()}
                    >
                      Reset
                    </button>
                    <div className="flex items-center gap-2">
                      {!canSubmitAdmin ? (
                        <span className="text-[11px] text-slate-500">Fill required fields to enable create.</span>
                      ) : null}
                      <button
                        type="button"
                        disabled={!canSubmitAdmin || adminBusy}
                        className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                        onClick={handleAdminSubmit}
                      >
                        {adminBusy ? 'Creating…' : 'Create task'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

