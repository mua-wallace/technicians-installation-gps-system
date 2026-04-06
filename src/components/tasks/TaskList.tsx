import { Fragment, useState, type ReactNode } from 'react'
import { filterFormsForViewer, type TaskFormInstallation, type TaskListItem } from '../../api/tasks'

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
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString()
  } catch {
    /* fall through */
  }
  return raw
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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const toggleRow = (taskId: string) => {
    setOpenTaskId((id) => (id === taskId ? null : taskId))
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="shrink-0 mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-700">{title}</h2>
        <span className="text-xs text-slate-500">
          {loading ? 'Loading…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <input
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600"
          placeholder="Search client / technicians"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <select
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600"
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
        >
          <option value="">All types</option>
          <option value="INSTALLATION">Installation</option>
          <option value="INTERVENTION">Intervention</option>
        </select>

        <select
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="CREATED">CREATED</option>
          <option value="ASSIGNED">ASSIGNED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="VERIFIED">VERIFIED</option>
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-xs text-slate-700">
            <thead>
              <tr className="bg-slate-50 text-left uppercase tracking-wide text-[11px] text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2 text-center">Client</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">Type</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">Technicians</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center whitespace-normal break-words leading-tight max-w-36">
                  Soumis / prévu
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">Schedule</th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">Status</th>
                <th className="w-0 border-b border-slate-200 py-2 pl-1 pr-2 text-right">Details</th>
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
                  <tr className="bg-white">
                  <td className="border-b border-slate-200 px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleRow(task.id)}
                        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        title={isOpen ? 'Masquer les fiches' : 'Voir immatriculation, châssis, installateur, date'}
                        aria-expanded={isOpen}
                      >
                        <span className="sr-only">{isOpen ? 'Replier' : 'Déplier'}</span>
                        <svg
                          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1 text-center font-medium text-slate-900">{task.client || '—'}</div>
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
                        {viewerIsAdmin ? 'toutes' : 'mes fiches'}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2 text-center text-slate-600">
                    {task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString() : '—'}
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
                      className="rounded p-1.5 text-slate-500 hover:bg-sky-600/20 hover:text-sky-700"
                      onClick={() => onSelectTask(task.id)}
                      title="Voir détail"
                    >
                      <span className="sr-only">Voir détail</span>
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
                              Ajouter une fiche
                            </button>
                            <span className="text-xs text-slate-500">Ouvre le formulaire pour cette tâche.</span>
                          </div>
                        ) : null}
                        {formsSorted.length === 0 ? (
                          <p className="text-center text-sm text-slate-500">
                            {viewerIsAdmin
                              ? 'No fiche submitted yet.'
                              : "You haven't submitted any fiche for this task."}
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full min-w-[640px] border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">#</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">Immatriculation</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">Châssis</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">Installateur</th>
                                  <th className="border-b border-slate-200 px-3 py-2 text-left">Date</th>
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
                          Fermer
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
                    className="border-b border-slate-200 px-3 py-8 text-center text-sm text-slate-500"
                  >
                    No tasks found.
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

