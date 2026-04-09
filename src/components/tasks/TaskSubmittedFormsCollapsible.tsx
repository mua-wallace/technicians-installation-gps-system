import { useEffect, useMemo, useState } from 'react'
import {
  filterFormsForViewer,
  type TaskFormInstallation,
  type TaskFormDraftServer,
} from '../../api/tasks'
import { SubmittedFormViewerModal } from './SubmittedFormViewerModal'

/** Unified item for the Gmail-style list: either a submitted form or a draft. */
type UnifiedFormItem =
  | { kind: 'submitted'; form: TaskFormInstallation }
  | { kind: 'draft'; draft: TaskFormDraftServer }

function formatWhen(raw: string | null | undefined): string {
  if (!raw) return '\u2014'
  try {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    }
  } catch { /* fall through */ }
  return raw.trim() || '\u2014'
}

type Props = {
  forms: TaskFormInstallation[] | undefined
  numberOfInstallations: number
  isAdmin: boolean
  technicianId: number | null
  technicianFullname?: string | null
  technicianUsername?: string | null
  taskClient?: string | null
  /** Server-side drafts for this task. */
  drafts?: TaskFormDraftServer[]
  /** The draft currently being edited. */
  activeDraftId?: number | null
  /** Called when user clicks "Continue" on a draft. */
  onResumeDraft?: (draft: TaskFormDraftServer) => void
}

export function TaskSubmittedFormsCollapsible({
  forms,
  numberOfInstallations,
  isAdmin,
  technicianId,
  technicianFullname,
  technicianUsername,
  taskClient,
  drafts = [],
  activeDraftId,
  onResumeDraft,
}: Props) {
  const [open, setOpen] = useState(false)
  const [viewerForm, setViewerForm] = useState<TaskFormInstallation | null>(null)
  const [viewerDraft, setViewerDraft] = useState<TaskFormDraftServer | null>(null)

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

  const hasDrafts = drafts.length > 0

  // Auto-expand when drafts exist
  useEffect(() => {
    if (hasDrafts) setOpen(true)
  }, [hasDrafts])

  const total = Math.max(1, Number(numberOfInstallations) || 1)
  const submitted = visible.length
  const scopeLabel = isAdmin ? 'Toutes les fiches' : 'Vos fiches'

  // Build unified list sorted by date (newest first), like Gmail
  const unified: UnifiedFormItem[] = useMemo(() => {
    const items: UnifiedFormItem[] = [
      ...visible.map((f): UnifiedFormItem => ({ kind: 'submitted', form: f })),
      ...drafts.map((d): UnifiedFormItem => ({ kind: 'draft', draft: d })),
    ]
    items.sort((a, b) => {
      const aDate = a.kind === 'submitted'
        ? (a.form.updatedAt ?? a.form.createdAt ?? a.form.date ?? '')
        : (a.draft.updatedAt ?? a.draft.createdAt ?? '')
      const bDate = b.kind === 'submitted'
        ? (b.form.updatedAt ?? b.form.createdAt ?? b.form.date ?? '')
        : (b.draft.updatedAt ?? b.draft.createdAt ?? '')
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })
    return items
  }, [visible, drafts])

  return (
    <>
    <SubmittedFormViewerModal
      form={viewerForm}
      draft={viewerDraft}
      onClose={() => { setViewerForm(null); setViewerDraft(null) }}
      taskLabel={taskClient?.trim() || undefined}
    />
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50/80"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fiches</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-sm text-slate-800">
                <span className="font-bold tabular-nums text-slate-900">
                  {submitted}<span className="font-normal text-slate-400">/{total}</span>
                </span>
                <span className="ml-1.5 text-xs text-slate-500"> {scopeLabel}</span>
              </p>
              {hasDrafts ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  {drafts.length} brouillon{drafts.length > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-5 pb-5">
          {/* Empty state */}
          {unified.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center">
              <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-slate-500">
                {isAdmin ? 'No fiche submitted yet.' : "You haven't submitted any fiche for this task."}
              </p>
            </div>
          ) : null}

          {/* Gmail-style unified list */}
          {unified.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {unified.map((item) => {
                if (item.kind === 'draft') {
                  const draft = item.draft
                  const isActive = activeDraftId === draft.id
                  return (
                    <li
                      key={`draft-${draft.id}`}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition ${
                        isActive
                          ? 'border-amber-300 bg-amber-50/70 ring-1 ring-amber-200'
                          : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          Brouillon
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {draft.client?.trim() || draft.immatriculation?.trim() || draft.vehicleMakeModel?.trim() || 'Sans titre'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatWhen(draft.updatedAt ?? draft.createdAt)}
                            {draft.installerName?.trim() ? ` \u00b7 ${draft.installerName.trim()}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewerDraft(draft)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Voir
                        </button>
                        <button
                          type="button"
                          onClick={() => onResumeDraft?.(draft)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Continuer
                        </button>
                      </div>
                    </li>
                  )
                }

                // Submitted form
                const f = item.form
                const idx = f.installationIndex != null ? `Installation ${f.installationIndex}` : `Fiche #${f.id}`
                const hasUrl = Boolean(f.ficheUrl?.trim())
                return (
                  <li
                    key={`form-${f.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{idx}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatWhen(f.updatedAt ?? f.createdAt ?? f.date)}
                        {f.installerName?.trim() ? ` \u00b7 ${f.installerName.trim()}` : ''}
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
          ) : null}
        </div>
      ) : null}
    </div>
    </>
  )
}
