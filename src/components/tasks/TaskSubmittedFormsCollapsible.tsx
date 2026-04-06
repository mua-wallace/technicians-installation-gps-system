import { useMemo, useState } from 'react'
import {
  filterFormsForViewer,
  type TaskFormInstallation,
} from '../../api/tasks'
import { SubmittedFormViewerModal } from './SubmittedFormViewerModal'

function formatFormWhen(f: TaskFormInstallation): string {
  const raw = f.createdAt ?? f.updatedAt ?? f.date
  if (raw) {
    try {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      }
    } catch {
      /* fall through */
    }
  }
  return f.date?.trim() || '—'
}

type Props = {
  forms: TaskFormInstallation[] | undefined
  numberOfInstallations: number
  isAdmin: boolean
  technicianId: number | null
  technicianFullname?: string | null
  technicianUsername?: string | null
  /** Task client name (shown in the form viewer header). */
  taskClient?: string | null
}

export function TaskSubmittedFormsCollapsible({
  forms,
  numberOfInstallations,
  isAdmin,
  technicianId,
  technicianFullname,
  technicianUsername,
  taskClient,
}: Props) {
  const [open, setOpen] = useState(false)
  const [viewerForm, setViewerForm] = useState<TaskFormInstallation | null>(null)

  const visible = useMemo(
    () =>
      filterFormsForViewer(forms, {
        isAdmin,
        technicianId,
        fullname: technicianFullname,
        username: technicianUsername,
      }),
    [forms, isAdmin, technicianId, technicianFullname, technicianUsername],
  )

  const total = Math.max(1, Number(numberOfInstallations) || 1)
  const submitted = visible.length
  const scopeLabel = isAdmin ? 'Toutes les fiches' : 'Vos fiches'

  return (
    <>
    <SubmittedFormViewerModal
      form={viewerForm}
      onClose={() => setViewerForm(null)}
      taskLabel={taskClient?.trim() || undefined}
    />
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Fiches soumises</p>
          <p className="mt-0.5 text-sm text-slate-800">
            <span className="font-semibold tabular-nums">
              {submitted} / {total}
            </span>
            <span className="text-slate-600"> — {scopeLabel}</span>
          </p>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 pb-4">
          {submitted === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
              {isAdmin
                ? 'No fiche submitted yet.'
                : "You haven't submitted any fiche for this task."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {visible
                .slice()
                .sort((a, b) => Number(a.installationIndex ?? 0) - Number(b.installationIndex ?? 0))
                .map((f) => {
                  const idx = f.installationIndex != null ? `Installation ${f.installationIndex}` : `Fiche #${f.id}`
                  const hasUrl = Boolean(f.ficheUrl?.trim())
                  return (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{idx}</p>
                        <p className="text-xs text-slate-600">
                          {formatFormWhen(f)}
                          {f.installerName?.trim() ? ` · ${f.installerName.trim()}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewerForm(f)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                          Voir
                        </button>
                        {hasUrl ? (
                          <a
                            href={f.ficheUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                          >
                            Ouvrir
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Pas de fichier</span>
                        )}
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
    </>
  )
}
