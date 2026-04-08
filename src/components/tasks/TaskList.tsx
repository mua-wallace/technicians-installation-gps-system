import { Fragment, useState, type ReactNode } from 'react'
import { filterFormsForViewer, type TaskFormInstallation, type TaskListItem } from '../../api/tasks'
import { useI18n } from '../../i18n/I18nContext'
import { SubmittedFormViewerModal } from './SubmittedFormViewerModal'

function getTechnicianDisplayName(task: TaskListItem): string {
  const assignments = task.assignments ?? []
  if (assignments.length === 0) return '—'
  const sorted = [...assignments].sort((a, b) => Number(b.isLead) - Number(a.isLead))
  const names = sorted
    .map((a) => a.technician?.fullname || a.technician?.username || (a.technicianId ? `#${a.technicianId}` : ''))
    .filter(Boolean)
  return names.length > 0 ? names.join(', ') : '—'
}

function formatFormDate(f: TaskFormInstallation): string {
  const raw = f.date?.trim() || f.createdAt
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) {
      // Force dd/mm/yyyy regardless of browser locale.
      return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
    }
  } catch {
    /* fall through */
  }
  return raw
}

function formatDateDdMmYyyy(raw?: string | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return '—'
    // Force dd/mm/yyyy regardless of browser locale.
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  } catch {
    return '—'
  }
}

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  )
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin-smooth text-sky-500 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const STATUS_DISPLAY: Record<string, { label: string; dot: string; classes: string }> = {
  CREATED:     { label: 'Created',     dot: 'bg-slate-400',   classes: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
  ASSIGNED:    { label: 'Assigned',    dot: 'bg-blue-400',    classes: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-amber-400',   classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' },
  COMPLETED:   { label: 'Completed',   dot: 'bg-emerald-400', classes: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' },
  VERIFIED:    { label: 'Verified',    dot: 'bg-sky-400',     classes: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200' },
}

function StatusPill({ status }: { status: string }) {
  const info = STATUS_DISPLAY[status] ?? { label: status, dot: 'bg-slate-400', classes: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' }
  return (
    <Pill className={info.classes}>
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </Pill>
  )
}

type Props = {
  tasks: TaskListItem[]
  loading?: boolean
  onSelectTask: (taskId: string) => void
  title?: string
  /** Shown under the title when filtering (e.g. technician bucket). */
  subtitle?: string
  /** Hide task status (CREATED / ASSIGNED / …) filter — e.g. when using technician bucket cards. */
  showTaskStatusFilter?: boolean
  search: string
  onSearchChange: (next: string) => void
  typeFilter: string
  onTypeFilterChange: (next: string) => void
  statusFilter: string
  onStatusFilterChange: (next: string) => void
  /** For “soumis / prévu” counts */
  viewerIsAdmin: boolean
  viewerTechnicianId: number | null
  viewerFullname?: string | null
  viewerUsername?: string | null
  /** Technicians assigned to the task can open the task to add another fiche. */
  onAddFormForTask?: (taskId: string) => void
}

export function TaskList({
  tasks,
  loading,
  onSelectTask,
  title = 'My tasks',
  subtitle,
  showTaskStatusFilter = true,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  viewerIsAdmin,
  viewerTechnicianId,
  viewerFullname,
  viewerUsername,
  onAddFormForTask,
}: Props) {
  const { t } = useI18n()
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [viewerForm, setViewerForm] = useState<{ form: TaskFormInstallation; taskLabel: string } | null>(null)

  const toggleRow = (taskId: string) => {
    setOpenTaskId((id) => (id === taskId ? null : taskId))
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur">
      <SubmittedFormViewerModal
        form={viewerForm?.form ?? null}
        onClose={() => setViewerForm(null)}
        taskLabel={viewerForm?.taskLabel}
      />
      <div className="mb-4 flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {loading ? (
            <>
              <Spinner className="h-3 w-3" />
              {t('taskList.loading')}
            </>
          ) : (
            `${tasks.length} ${tasks.length === 1 ? t('taskApp.taskCount') : t('taskApp.taskCountPlural')}`
          )}
        </span>
      </div>

      <div className="mb-4 shrink-0 rounded-xl border border-slate-200/60 bg-slate-50/80 p-3">
        <div className={`grid gap-2 ${showTaskStatusFilter ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4"
            placeholder={t('taskList.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4"
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
        >
          <option value="">{t('taskList.filter.typesAll')}</option>
          <option value="INSTALLATION">{t('taskList.filter.typeInstallation')}</option>
          <option value="INTERVENTION">{t('taskList.filter.typeIntervention')}</option>
        </select>

        {showTaskStatusFilter ? (
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">{t('taskList.filter.statusAll')}</option>
            <option value="CREATED">Created</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="VERIFIED">Verified</option>
          </select>
        ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full min-w-[880px] border-collapse text-sm text-slate-700">
            <thead>
              <tr className="sticky top-0 z-10 bg-slate-50/95 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur">
                <th className="border-b border-slate-200 px-3 py-3 text-start">{t('taskList.col.client')}</th>
                <th className="border-b border-slate-200 px-3 py-3 text-center">{t('taskList.col.type')}</th>
                <th className="border-b border-slate-200 px-3 py-3 text-center">{t('taskList.col.technicians')}</th>
                <th className="border-b border-slate-200 px-3 py-3 text-center whitespace-normal break-words leading-tight max-w-36">
                  {t('taskList.col.submittedPlanned')}
                </th>
                <th className="border-b border-slate-200 px-3 py-3 text-center">{t('taskList.col.schedule')}</th>
                <th className="border-b border-slate-200 px-3 py-3 text-center">{t('taskList.col.status')}</th>
                <th className="w-0 border-b border-slate-200 py-3 pl-1 pr-3 text-right">{t('taskList.col.details')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const planned = Math.max(1, Number(task.numberOfInstallations) || 1)
                const visibleForms = filterFormsForViewer(task.forms, {
                  isAdmin: viewerIsAdmin,
                  technicianId: viewerTechnicianId,
                  fullname: viewerFullname,
                  username: viewerUsername,
                })
                const submitted = visibleForms.length
                const isOpen = openTaskId === task.id
                const formsSorted = [...visibleForms].sort(
                  (a, b) => Number(a.installationIndex ?? 0) - Number(b.installationIndex ?? 0),
                )
                const isAssignedToMe =
                  viewerTechnicianId != null &&
                  (task.assignments ?? []).some((a) => a.technicianId === viewerTechnicianId)
                const showAddForm =
                  !viewerIsAdmin && isAssignedToMe && typeof onAddFormForTask === 'function'
                return (
                  <Fragment key={task.id}>
                  <tr className="task-row group bg-white hover:bg-sky-50/40">
                  <td className="border-b border-slate-100 px-3 py-3 text-start align-middle">
                    <div className="flex items-center justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleRow(task.id)}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        title={isOpen ? t('taskList.expand.hideForms') : t('taskList.expand.showForms')}
                        aria-expanded={isOpen}
                      >
                        <span className="sr-only">{isOpen ? t('taskList.expand.hideForms') : t('taskList.expand.showForms')}</span>
                        <svg
                          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1 text-start text-sm font-semibold text-slate-900">{task.client || '—'}</div>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 text-center">
                    {task.type === 'INSTALLATION' ? (
                      <Pill className="bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                        Install
                      </Pill>
                    ) : (
                      <Pill className="bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200">
                        Interv.
                      </Pill>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 text-center text-xs text-slate-600">
                    <span className="mx-auto block line-clamp-2 max-w-[260px]">{getTechnicianDisplayName(task)}</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 text-center">
                    <span className="inline-flex flex-col items-center gap-0.5">
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {submitted}<span className="font-normal text-slate-400">/{planned}</span>
                      </span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {viewerIsAdmin ? t('taskList.formsAll') : t('taskList.formsMine')}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 text-center text-xs text-slate-500">
                    {formatDateDdMmYyyy(task.scheduledDate)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 text-center">
                    <StatusPill status={task.status} />
                  </td>
                  <td className="w-0 border-b border-slate-100 py-3 pl-1 pr-3 text-right">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-sky-100 hover:text-sky-600"
                      onClick={() => onSelectTask(task.id)}
                      title={t('taskList.viewDetail')}
                    >
                      <span className="sr-only">{t('taskList.viewDetail')}</span>
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={7} className="border-b border-slate-200 bg-slate-50/60 px-4 py-4 text-left align-top">
                        {showAddForm ? (
                          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
                            <span className="mr-auto text-xs text-slate-400">{t('taskList.addFicheHint')}</span>
                            <button
                              type="button"
                              disabled={task.status === 'COMPLETED'}
                              onClick={() => {
                                onAddFormForTask(task.id)
                                setOpenTaskId(null)
                              }}
                              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {t('taskList.addFiche')}
                            </button>
                          </div>
                        ) : null}
                        {formsSorted.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white/80 px-4 py-6 text-center">
                            <p className="text-sm text-slate-500">
                              {viewerIsAdmin ? t('taskList.noFiche.admin') : t('taskList.noFiche.tech')}
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                            <table className="w-full min-w-[640px] border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                                  <th className="border-b border-slate-100 px-3 py-2.5 text-left font-semibold">#</th>
                                  <th className="border-b border-slate-100 px-3 py-2.5 text-left font-semibold">{t('taskList.table.plate')}</th>
                                  <th className="border-b border-slate-100 px-3 py-2.5 text-left font-semibold">{t('taskList.table.chassis')}</th>
                                  <th className="border-b border-slate-100 px-3 py-2.5 text-left font-semibold">{t('taskList.table.installer')}</th>
                                  <th className="border-b border-slate-100 px-3 py-2.5 text-left font-semibold">{t('taskList.table.date')}</th>
                                  <th className="border-b border-slate-100 px-3 py-2.5 text-center font-semibold">{t('taskList.table.view')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {formsSorted.map((f) => (
                                  <tr key={f.id} className="text-slate-700 transition hover:bg-slate-50/60">
                                    <td className="border-b border-slate-50 px-3 py-2.5 tabular-nums text-slate-500">
                                      {f.installationIndex != null ? f.installationIndex : '—'}
                                    </td>
                                    <td className="border-b border-slate-50 px-3 py-2.5 font-medium text-slate-800">
                                      {(f.immatriculation || '').trim() || '—'}
                                    </td>
                                    <td className="border-b border-slate-50 px-3 py-2.5">
                                      {(f.chassis || '').trim() || '—'}
                                    </td>
                                    <td className="border-b border-slate-50 px-3 py-2.5">
                                      {(f.installerName || '').trim() || '—'}
                                    </td>
                                    <td className="border-b border-slate-50 px-3 py-2.5 text-slate-500">{formatFormDate(f)}</td>
                                    <td className="border-b border-slate-50 px-2 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewerForm({
                                            form: f,
                                            taskLabel: (task.client || '').trim() || '—',
                                          })
                                        }
                                        className="rounded-md bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100"
                                      >
                                        {t('taskList.table.view')}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenTaskId(null)}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                          {t('taskList.closeRow')}
                        </button>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                )
              })}

              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-16 text-center"
                  >
                    <div className="mx-auto flex max-w-xs flex-col items-center gap-4">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{t('taskList.noTasks')}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t('taskList.searchPlaceholder')}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

