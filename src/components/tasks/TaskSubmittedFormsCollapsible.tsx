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
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fiches soumises</p>
            <p className="mt-0.5 text-sm text-slate-800">
              <span className="font-bold tabular-nums text-slate-900">
                {submitted}<span className="font-normal text-slate-400">/{total}</span>
              </span>
              <span className="ml-1.5 text-xs text-slate-500"> {scopeLabel}</span>
            </p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center">
              <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-slate-500">
                {isAdmin
                  ? 'No fiche submitted yet.'
                  : "You haven't submitted any fiche for this task."}
              </p>
            </div>
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{idx}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatFormWhen(f)}
                          {f.installerName?.trim() ? ` · ${f.installerName.trim()}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewerForm(f)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Voir
                        </button>
                        {hasUrl ? (
                          <a
                            href={f.ficheUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
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
