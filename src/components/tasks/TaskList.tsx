import type React from 'react'
import type { TaskListItem } from '../../api/tasks'

function getTechnicianDisplayName(task: TaskListItem): string {
  const assignments = task.assignments ?? []
  if (assignments.length === 0) return '—'
  const sorted = [...assignments].sort((a, b) => Number(b.isLead) - Number(a.isLead))
  const names = sorted
    .map((a) => a.technician?.fullname || a.technician?.username || (a.technicianId ? `#${a.technicianId}` : ''))
    .filter(Boolean)
  return names.length > 0 ? names.join(', ') : '—'
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
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
  showTechnicians?: boolean
}

export function TaskList({ tasks, loading, onSelectTask, showTechnicians }: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="shrink-0 mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-700">My tasks</h2>
        <span className="text-xs text-slate-500">
          {loading ? 'Loading…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs text-slate-700">
            <thead>
              <tr className="bg-slate-50 text-left uppercase tracking-wide text-[11px] text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2">Title</th>
                <th className="border-b border-slate-200 px-3 py-2">Type</th>
                <th className="border-b border-slate-200 px-3 py-2">Scheduled</th>
                {showTechnicians ? (
                  <th className="border-b border-slate-200 px-3 py-2">Techniciens</th>
                ) : null}
                <th className="border-b border-slate-200 px-3 py-2">Status</th>
                <th className="w-0 border-b border-slate-200 py-2 pl-1 pr-2 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="bg-white">
                  <td className="border-b border-slate-200 px-3 py-2">
                    <div className="font-medium text-slate-900">{task.title}</div>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2">
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
                  <td className="border-b border-slate-200 px-3 py-2 text-slate-600">
                    {task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString() : '—'}
                  </td>
                  {showTechnicians ? (
                    <td className="border-b border-slate-200 px-3 py-2 text-slate-700">
                      <span className="line-clamp-2">{getTechnicianDisplayName(task)}</span>
                    </td>
                  ) : null}
                  <td className="border-b border-slate-200 px-3 py-2">
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
              ))}

              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={showTechnicians ? 6 : 5}
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

