import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  tasksApi,
  type TaskListItem,
  type TaskStatus,
  type TaskType,
  getTechnicianTaskBucket,
  isTaskAssignedToTechnician,
  type TechnicianTaskBucket,
} from './api/tasks'
import { usersApi } from './api/users'
import type { ClientRow } from './api/users'
import { useAuthStore } from './store/auth.store'
import { TaskDetailDrawer } from './components/tasks/TaskDetailDrawer'
import { TaskList } from './components/tasks/TaskList'
import { LanguageSwitch } from './components/ui/LanguageSwitch'
import { useI18n } from './i18n/I18nContext'
import { taskHasLocalFormDraft } from './lib/taskFormDraftStorage'
import {
  TechnicianTaskBucketsNav,
  TechnicianTaskBucketsStrip,
  type TechnicianBucketSelection,
} from './components/tasks/TechnicianTaskBucketsNav'

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

function formatDateDdMmYyyy(raw?: string | null): string {
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    // Force dd/mm/yyyy regardless of browser locale.
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  } catch {
    return ''
  }
}

export function TaskApp() {
  const queryClient = useQueryClient()
  const { t } = useI18n()

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
    if (roleLower.includes('admin')) return t('role.admin')
    if (roleLower.includes('supervisor')) return t('role.supervisor')
    return t('role.technician')
  }, [roleLower, t])

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  /** Bumped when a technician opens “Ajouter une fiche” from the list so the drawer starts on the form step. */
  const [taskFormIntentNonce, setTaskFormIntentNonce] = useState(0)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [technicianBucketFilter, setTechnicianBucketFilter] = useState<TechnicianBucketSelection>('all')

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'submitted', { typeFilter, statusFilter: isAdmin ? statusFilter : '' }],
    queryFn: () =>
      tasksApi.listTasksSubmitted({
        page: 1,
        limit: 200,
        status: isAdmin ? statusFilter || undefined : undefined,
        type: typeFilter || undefined,
        search: undefined,
        include: 'assignments,technicians,forms',
      }),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })

  const myUserId = profile?.id

  const handleAddFormFromList = (taskId: string) => {
    setSelectedTaskId(taskId)
    setTaskFormIntentNonce((n) => n + 1)
  }

  const tasksFromApi: TaskListItem[] = tasksQuery.data?.data ?? []

  const technicianAssignedTasks = useMemo(() => {
    if (isAdmin) return []
    if (myUserId == null) return []
    return tasksFromApi.filter((t) => isTaskAssignedToTechnician(t, myUserId))
  }, [tasksFromApi, isAdmin, myUserId])

  const technicianBucketCounts = useMemo(() => {
    const base: Record<TechnicianBucketSelection, number> = {
      all: 0,
      draft: 0,
      submitted: 0,
      rejected: 0,
      validated: 0,
    }
    if (isAdmin || myUserId == null) return base
    for (const t of technicianAssignedTasks) {
      base.all += 1
      const hasLocal = taskHasLocalFormDraft(myUserId, t.id)
      const b = getTechnicianTaskBucket(t, {
        technicianId: myUserId,
        fullname: profile?.fullname ?? null,
        username: profile?.username ?? null,
        hasLocalFormDraft: hasLocal,
      })
      if (b !== 'open') {
        base[b] += 1
      }
    }
    return base
  }, [isAdmin, myUserId, technicianAssignedTasks, profile?.fullname, profile?.username])

  const technicianListSubtitle = useMemo(() => {
    if (isAdmin || technicianBucketFilter === 'all') return undefined
    const labels: Record<Exclude<TechnicianTaskBucket, 'open'>, string> = {
      draft: t('taskApp.subtitle.draft'),
      submitted: t('taskApp.subtitle.submitted'),
      rejected: t('taskApp.subtitle.rejected'),
      validated: t('taskApp.subtitle.validated'),
    }
    return labels[technicianBucketFilter]
  }, [isAdmin, technicianBucketFilter, t])

  const tasksForUI = useMemo(() => {
    const scoped = isAdmin ? tasksFromApi : technicianAssignedTasks

    let afterBucket = scoped
    if (!isAdmin && technicianBucketFilter !== 'all' && myUserId != null) {
      afterBucket = scoped.filter((t) => {
        const hasLocal = taskHasLocalFormDraft(myUserId, t.id)
        return (
          getTechnicianTaskBucket(t, {
            technicianId: myUserId,
            fullname: profile?.fullname ?? null,
            username: profile?.username ?? null,
            hasLocalFormDraft: hasLocal,
          }) === technicianBucketFilter
        )
      })
    }

    const q = search.trim().toLowerCase()
    const filtered = !q
      ? afterBucket
      : afterBucket.filter((t) => {
          const scheduled = formatDateDdMmYyyy(t.scheduledDate)
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
  }, [
    tasksFromApi,
    technicianAssignedTasks,
    isAdmin,
    search,
    technicianBucketFilter,
    myUserId,
    profile?.fullname,
    profile?.username,
  ])

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
    <div className="flex min-h-screen flex-col overflow-hidden text-slate-900">
      <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col px-3 pb-6 pt-4 md:px-6 md:pt-6">
        <header className="flex shrink-0 flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 shadow-sm">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                <span className="text-sky-600">malambi</span>
                <span className="mx-1.5 text-slate-300">/</span>
                {t('taskApp.dashboard')}
              </h1>
              <p className="text-xs text-slate-500">{t('taskApp.tagline')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <LanguageSwitch size="sm" className="order-first sm:order-none" />

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-[10px] font-bold text-white shadow-sm">
                {(displayName ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900 leading-tight">{displayName}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{roleLabel}</p>
              </div>
              {meQuery.isFetching ? (
                <svg className="h-3.5 w-3.5 animate-spin-smooth text-sky-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98]"
                  onClick={() => {
                    resetAdmin()
                    setAdminModalOpen(true)
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('taskApp.createTask')}
                </button>
              ) : null}

              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
                onClick={() => {
                  clearAuth()
                  window.location.href = '/login'
                }}
                title={t('taskApp.logout')}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {t('taskApp.logout')}
              </button>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-4 pt-4 lg:gap-6 lg:flex">
          <aside className="hidden w-72 shrink-0 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-xs text-slate-700 shadow-sm backdrop-blur lg:block">
            {isAdmin ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('taskApp.overview')}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                    {tasksForUI.length}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tasksForUI.length === 1 ? t('taskApp.taskCount') : t('taskApp.taskCountPlural')}
                  </p>
                </div>
                <div className="h-px bg-slate-200" />
                <p className="text-[11px] leading-relaxed text-slate-500">{t('taskApp.overviewHint')}</p>
              </div>
            ) : (
              <TechnicianTaskBucketsNav
                counts={technicianBucketCounts}
                value={technicianBucketFilter}
                onChange={setTechnicianBucketFilter}
              />
            )}
          </aside>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {!isAdmin ? (
              <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur">
                <TechnicianTaskBucketsStrip
                  counts={technicianBucketCounts}
                  value={technicianBucketFilter}
                  onChange={setTechnicianBucketFilter}
                />
              </div>
            ) : null}
            <TaskList
              tasks={tasksForUI}
              loading={tasksQuery.isLoading}
              onSelectTask={(id) => setSelectedTaskId(id)}
              title={isAdmin ? t('taskList.title.all') : t('taskList.title.mine')}
              subtitle={technicianListSubtitle}
              showTaskStatusFilter={isAdmin}
              search={search}
              onSearchChange={setSearch}
              typeFilter={typeFilter}
              onTypeFilterChange={(v) => setTypeFilter((v as TaskType | '') || '')}
              statusFilter={statusFilter}
              onStatusFilterChange={(v) => setStatusFilter((v as TaskStatus | '') || '')}
              viewerIsAdmin={isAdmin}
              viewerTechnicianId={myUserId ?? null}
              viewerFullname={profile?.fullname ?? null}
              viewerUsername={profile?.username ?? null}
              onAddFormForTask={!isAdmin ? handleAddFormFromList : undefined}
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
            await queryClient.invalidateQueries({ queryKey: ['task'] })
          }}
          viewerUsername={profile?.username ?? ''}
          taskFormIntentNonce={taskFormIntentNonce}
          onClose={() => {
            setSelectedTaskId(null)
            setTaskFormIntentNonce(0)
          }}
        />
      ) : null}

      {adminModalOpen ? (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" className="animate-fade-in h-full w-full bg-black/50 backdrop-blur-sm" onClick={() => setAdminModalOpen(false)} />
          <div className="animate-slide-in-right h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t('adminModal.createTitle')}</p>
                  <p className="text-xs text-slate-500">{t('adminModal.createHint')}</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setAdminModalOpen(false)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                    {t('adminModal.lastCreated')} <span className="font-semibold">{adminCreatedTaskId}</span>
                  </p>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t('adminModal.section.taskDetails')}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{t('adminModal.section.taskDetailsHint')}</p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {t('adminModal.client')} <span className="text-rose-600">*</span>
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
                          placeholder={
                            clientsQuery.isLoading ? t('adminModal.loadingClients') : t('adminModal.clientPlaceholder')
                          }
                        />
                        {adminClientDropdownOpen ? (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                            {clientsQuery.isLoading ? (
                              <div className="px-3 py-2 text-sm text-slate-500">{t('adminModal.loadingClients')}</div>
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
                              <div className="px-3 py-2 text-sm text-slate-500">{t('adminModal.noClientMatch')}</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {!adminClient.trim() ? (
                        <p className="mt-1 text-[11px] text-slate-500">{t('adminModal.clientHint')}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {t('adminModal.taskType')}
                        </label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={adminType}
                          onChange={(e) => setAdminType(e.target.value as TaskType)}
                        >
                          <option value="INSTALLATION">INSTALLATION</option>
                          <option value="INTERVENTION">INTERVENTION</option>
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500">{t('adminModal.taskTypeHint')}</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {t('adminModal.scheduled')}
                        </label>
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                          value={adminScheduledDate}
                          onChange={(e) => setAdminScheduledDate(e.target.value)}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">{t('adminModal.scheduledHint')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t('adminModal.equipment')}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{t('adminModal.equipmentHint')}</p>

                  <datalist id="equipment-make-options">
                    <option value="Teltonika" />
                    <option value="Queclink" />
                    <option value="Ruptela" />
                    <option value="Concox" />
                  </datalist>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {t('adminModal.numInstalls')} <span className="text-rose-600">*</span>
                      </label>
                      <div className="mt-1 flex items-stretch gap-2">
                        <button
                          type="button"
                          className="w-10 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => setAdminNumberOfInstallations((n) => Math.max(1, n - 1))}
                          aria-label={t('adminModal.numInstalls')}
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
                          aria-label={t('adminModal.numInstalls')}
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{t('adminModal.numInstallsHint')}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {t('adminModal.typeEquipment')} <span className="text-rose-600">*</span>
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
                        {t('adminModal.equipmentMake')} <span className="text-rose-600">*</span>
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
                        {t('adminModal.equipmentModel')} <span className="text-rose-600">*</span>
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
                      {t('adminModal.equipmentVersion')}
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t('adminModal.assignment')}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{t('adminModal.assignmentHint')}</p>
                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                    onClick={() => setAdminTechniciansOpen((s) => !s)}
                  >
                    <span className="min-w-0 truncate">
                      {adminSelectedLead ? (
                        <>
                          <span className="font-semibold">{t('adminModal.lead')}</span>{' '}
                          {adminSelectedLead.fullname || adminSelectedLead.username}
                        </>
                      ) : (
                        <span className="text-slate-600">{t('adminModal.selectTech')}</span>
                      )}
                      <span className="text-slate-500">
                        {adminSelectedAssistants.length > 0
                          ? ` · ${t('adminModal.assistants')} ${adminSelectedAssistants.length}`
                          : ''}
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
                        placeholder={t('adminModal.searchTech')}
                        value={adminTechSearch}
                        onChange={(e) => setAdminTechSearch(e.target.value)}
                      />
                      {(adminSelectedLead || adminSelectedAssistants.length > 0) && (
                        <div className="mb-2 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700">
                          <p>
                            {t('adminModal.lead')}{' '}
                            <span className="font-semibold text-slate-900">
                              {adminSelectedLead
                                ? adminSelectedLead.fullname || adminSelectedLead.username
                                : t('adminModal.notSelected')}
                            </span>
                          </p>
                          <p>
                            {t('adminModal.assistants')}{' '}
                            <span className="font-semibold text-slate-900">
                              {adminSelectedAssistants.length > 0
                                ? adminSelectedAssistants.map((tech) => tech.fullname || tech.username).join(', ')
                                : t('adminModal.none')}
                            </span>
                          </p>
                        </div>
                      )}
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                        {techniciansQuery.isLoading ? (
                          <p className="text-sm text-slate-500">{t('adminModal.loadingTech')}</p>
                        ) : technicianOptions.length === 0 ? (
                          <p className="text-sm text-slate-500">{t('adminModal.noTech')}</p>
                        ) : filteredTechnicians.length === 0 ? (
                          <p className="text-sm text-slate-500">{t('adminModal.noTechMatch')}</p>
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
                                      {t('adminModal.leadLabel')}
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
                                      {t('adminModal.assistantLabel')}
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

                <div className="sticky bottom-0 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                      onClick={() => resetAdmin()}
                    >
                      {t('adminModal.reset')}
                    </button>
                    <div className="flex items-center gap-3">
                      {!canSubmitAdmin ? (
                        <span className="text-xs text-slate-400">{t('adminModal.fillRequired')}</span>
                      ) : null}
                      <button
                        type="button"
                        disabled={!canSubmitAdmin || adminBusy}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                        onClick={handleAdminSubmit}
                      >
                        {adminBusy ? (
                          <svg className="h-3.5 w-3.5 animate-spin-smooth" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : null}
                        {adminBusy ? t('adminModal.creating') : t('adminModal.createBtn')}
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

