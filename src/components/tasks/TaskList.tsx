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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
      <SubmittedFormViewerModal
        form={viewerForm?.form ?? null}
        onClose={() => setViewerForm(null)}
        taskLabel={viewerForm?.taskLabel}
      />
      <div className="mb-3 flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-snug text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-slate-500 sm:pt-0.5">
          {loading
            ? t('taskList.loading')
            : `${tasks.length} ${tasks.length === 1 ? t('taskApp.taskCount') : t('taskApp.taskCountPlural')}`}
        </span>
      </div>

      <div className="mb-3 shrink-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className={`grid gap-2 ${showTaskStatusFilter ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <input
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500/20 focus:border-sky-600 focus:ring-4"
          placeholder={t('taskList.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500/20 focus:border-sky-600 focus:ring-4"
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
        >
          <option value="">{t('taskList.filter.typesAll')}</option>
          <option value="INSTALLATION">{t('taskList.filter.typeInstallation')}</option>
          <option value="INTERVENTION">{t('taskList.filter.typeIntervention')}</option>
        </select>

        {showTaskStatusFilter ? (
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500/20 focus:border-sky-600 focus:ring-4"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">{t('taskList.filter.statusAll')}</option>
            <option value="CREATED">CREATED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="VERIFIED">VERIFIED</option>
          </select>
        ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full min-w-[880px] border-collapse text-xs text-slate-700">
            <thead>
              <tr className="sticky top-0 z-10 bg-slate-50/95 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                <th className="border-b border-slate-200 px-3 py-2 text-start">{t('taskList.col.client')}</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">{t('taskList.col.type')}</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">{t('taskList.col.technicians')}</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center whitespace-normal break-words leading-tight max-w-36">
                  {t('taskList.col.submittedPlanned')}
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">{t('taskList.col.schedule')}</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">{t('taskList.col.status')}</th>
                <th className="w-0 border-b border-slate-200 py-2 pl-1 pr-2 text-right">{t('taskList.col.details')}</th>
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
                  <tr className="bg-white transition-colors hover:bg-slate-50">
                  <td className="border-b border-slate-200 px-2 py-2 text-start align-middle">
                    <div className="flex items-center justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleRow(task.id)}
                        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        title={isOpen ? t('taskList.expand.hideForms') : t('taskList.expand.showForms')}
                        aria-expanded={isOpen}
                      >
                        <span className="sr-only">{isOpen ? t('taskList.expand.hideForms') : t('taskList.expand.showForms')}</span>
                        <svg
                          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1 text-start font-medium text-slate-900">{task.client || '—'}</div>
                    </div>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-center">
                    {task.type === 'INSTALLATION' ? (
                      <Pill className="bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/30">
                        INSTALLATION
                      </Pill>
                    ) : (
                      <Pill className="bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-500/30">
                        INTERVENTION
                      </Pill>
                    )}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-center text-slate-700">
                    <span className="mx-auto block line-clamp-2 max-w-[260px]">{getTechnicianDisplayName(task)}</span>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-center text-slate-700">
                    <span className="inline-flex flex-col items-center gap-0.5">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {submitted} / {planned}
                      </span>
                      <span className="text-[10px] font-normal uppercase tracking-wide text-slate-500">
                        {viewerIsAdmin ? t('taskList.formsAll') : t('taskList.formsMine')}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-center text-slate-600">
                    {formatDateDdMmYyyy(task.scheduledDate)}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-center">
                    <Pill
                      className={
                        task.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30'
                          : task.status === 'VERIFIED'
                            ? 'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/30'
                            : task.status === 'IN_PROGRESS'
                              ? 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/30'
                              : 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20'
                      }
                    >
                      {task.status}
                    </Pill>
                  </td>
                  <td className="w-0 border-b border-slate-200 py-2 pl-1 pr-2 text-right">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-sky-600/15 hover:text-sky-700"
                      onClick={() => onSelectTask(task.id)}
                      title={t('taskList.viewDetail')}
                    >
                      <span className="sr-only">{t('taskList.viewDetail')}</span>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                  </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-slate-50/90">
                      <td colSpan={7} className="border-b border-slate-200 px-3 py-3 text-left align-top">
                        {showAddForm ? (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onAddFormForTask(task.id)
                                setOpenTaskId(null)
                              }}
                              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {t('taskList.addFiche')}
                            </button>
                            <span className="text-xs text-slate-500">{t('taskList.addFicheHint')}</span>
                          </div>
                        ) : null}
                        {formsSorted.length === 0 ? (
                          <p className="text-center text-sm text-slate-500">
                            {viewerIsAdmin ? t('taskList.noFiche.admin') : t('taskList.noFiche.tech')}
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full min-w-[640px] border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">#</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">{t('taskList.table.plate')}</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">{t('taskList.table.chassis')}</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">{t('taskList.table.installer')}</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">{t('taskList.table.date')}</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-center">{t('taskList.table.view')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {formsSorted.map((f) => (
                                  <tr key={f.id} className="text-slate-800">
                                    <td className="border-b border-slate-100 px-3 py-2 tabular-nums text-slate-600">
                                      {f.installationIndex != null ? f.installationIndex : '—'}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2">
                                      {(f.immatriculation || '').trim() || '—'}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2">
                                      {(f.chassis || '').trim() || '—'}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2">
                                      {(f.installerName || '').trim() || '—'}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2">{formatFormDate(f)}</td>
                                    <td className="border-b border-slate-100 px-2 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewerForm({
                                            form: f,
                                            taskLabel: (task.client || '').trim() || '—',
                                          })
                                        }
                                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
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
                          className="mt-2 text-xs font-medium text-sky-700 hover:underline"
                        >
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
                    className="border-b border-slate-200 px-3 py-12 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{t('taskList.noTasks')}</p>
                        <p className="mt-1 text-xs text-slate-600">{t('taskList.searchPlaceholder')}</p>
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

