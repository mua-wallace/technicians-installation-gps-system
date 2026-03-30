import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type TaskListItem, type TaskStatus, type TaskType } from './api/tasks'
import { usersApi } from './api/users'
import { useAuthStore } from './store/auth.store'
import { TaskDetailDrawer } from './components/tasks/TaskDetailDrawer'
import { TaskList } from './components/tasks/TaskList'

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
            t.title ?? '',
            t.type ?? '',
            t.status ?? '',
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
  const [adminTitle, setAdminTitle] = useState('')
  const [adminType, setAdminType] = useState<TaskType>('INSTALLATION')
  const [adminScheduledDate, setAdminScheduledDate] = useState(getNowLocalDatetimeInputValue())
  const [adminLeadId, setAdminLeadId] = useState<number | null>(null)
  const [adminAssistantIds, setAdminAssistantIds] = useState<number[]>([])
  const [adminCreatedTaskId, setAdminCreatedTaskId] = useState<string | null>(null)
  const [adminTechSearch, setAdminTechSearch] = useState('')
  const [adminError, setAdminError] = useState<string>('')
  const [adminBusy, setAdminBusy] = useState<boolean>(false)

  const techniciansQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersApi.list({ role: 'technicien', page: 1, limit: 100 }),
    enabled: isAdmin && adminModalOpen,
    staleTime: 60_000,
  })

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
    setAdminTitle('')
    setAdminType('INSTALLATION')
    setAdminScheduledDate(getNowLocalDatetimeInputValue())
    setAdminLeadId(null)
    setAdminAssistantIds([])
    setAdminCreatedTaskId(null)
    setAdminTechSearch('')
    setAdminError('')
    setAdminBusy(false)
  }

  const canSubmitAdmin = adminTitle.trim().length > 0

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
        title: adminTitle.trim(),
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
                  Admin: create and assign
                </p>
                <p className="text-[11px] text-slate-500">Single form flow: fill task info and assign technicians.</p>
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
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {adminError ? <p className="text-xs text-rose-700">{adminError}</p> : null}
                {adminCreatedTaskId ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Last created task ID: <span className="font-semibold">{adminCreatedTaskId}</span>
                  </p>
                ) : null}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Title
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={adminTitle}
                    onChange={(e) => setAdminTitle(e.target.value)}
                    placeholder="e.g. Installation GPS - Toyota Hilux"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Type
                    </label>
                    <select
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                      value={adminType}
                      onChange={(e) => setAdminType(e.target.value as TaskType)}
                    >
                      <option value="INSTALLATION">INSTALLATION</option>
                      <option value="INTERVENTION">INTERVENTION</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Scheduled date (optional)
                    </label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                      value={adminScheduledDate}
                      onChange={(e) => setAdminScheduledDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Select technicians</p>
                  <p className="mb-2 text-xs text-slate-500">
                    Optional. You can create the task without assigning technicians.
                  </p>
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
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                    {techniciansQuery.isLoading ? (
                      <p className="text-sm text-slate-500">Loading technicians…</p>
                    ) : technicianOptions.length === 0 ? (
                      <p className="text-sm text-slate-500">No technicians available.</p>
                    ) : filteredTechnicians.length === 0 ? (
                      <p className="text-sm text-slate-500">No technicians match your search.</p>
                    ) : (
                      filteredTechnicians.map((tech) => {
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
                      })
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => resetAdmin()}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmitAdmin || adminBusy}
                    className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    onClick={handleAdminSubmit}
                  >
                    {adminBusy ? 'Creating & assigning…' : 'Create task & assign technicians'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

