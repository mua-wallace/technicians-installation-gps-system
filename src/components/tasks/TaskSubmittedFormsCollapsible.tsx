import { useEffect, useMemo, useState } from 'react'
import {
  filterFormsForViewer,
  type TaskFormInstallation,
} from '../../api/tasks'
import type { InterventionForm } from '../../store/useAppStore'
import type { TaskFormDraft } from '../../lib/taskFormDraftStorage'
import { SubmittedFormViewerModal } from './SubmittedFormViewerModal'

function formatFormWhen(f: TaskFormInstallation): string {
  const raw = f.createdAt ?? f.updatedAt ?? f.date
  if (raw) {
    try {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      }
    } catch { /* fall through */ }
  }
  return f.date?.trim() || '\u2014'
}

function getDraftFields(form: InterventionForm): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = []
  if (form.client?.trim()) fields.push({ label: 'Client', value: form.client.trim() })
  if (form.immatriculation?.trim()) fields.push({ label: 'Immatriculation', value: form.immatriculation.trim() })
  if (form.vehicleMakeModel?.trim()) fields.push({ label: 'Marque / Modele', value: form.vehicleMakeModel.trim() })
  if (form.chassis?.trim()) fields.push({ label: 'Chassis', value: form.chassis.trim() })
  if (form.year?.trim()) fields.push({ label: 'Annee', value: form.year.trim() })
  if (form.odometer?.trim()) fields.push({ label: 'Odometre', value: form.odometer.trim() })
  if (form.operatorCode?.trim()) fields.push({ label: 'Code operateur', value: form.operatorCode.trim() })
  if (form.country?.trim()) fields.push({ label: 'Pays', value: form.country.trim() })
  if (form.simNumber?.trim()) fields.push({ label: 'N SIM', value: form.simNumber.trim() })
  if (form.imsi?.trim()) fields.push({ label: 'IMSI', value: form.imsi.trim() })
  if (form.installerName?.trim()) fields.push({ label: 'Installateur', value: form.installerName.trim() })
  if (form.date?.trim()) fields.push({ label: 'Date', value: form.date.trim() })
  return fields
}

function getCheckedOptions(form: InterventionForm): string[] {
  const mapping: Array<[keyof InterventionForm, string]> = [
    ['antivol', 'Antivol'], ['geolocation', 'Geolocalisation'], ['fleetManagement', 'Gestion de flotte'],
    ['otherOption', 'Autre'], ['camera', 'Camera'], ['alarm', 'Alarme'], ['buzzer', 'Buzzer'],
    ['canClick', 'CAN Click'], ['alimentationRed', 'Alim. rouge'], ['alimentationYellow', 'Alim. jaune'],
    ['acc', 'ACC'], ['immobilisationCable', 'Immobilisation'], ['fuelGauge', 'Jauge carburant'],
    ['canH', 'CAN H'], ['canL', 'CAN L'],
  ]
  return mapping.filter(([k]) => form[k] === true).map(([, l]) => l)
}

function getCheckedChecklist(form: InterventionForm): string[] {
  const mapping: Array<[keyof InterventionForm, string]> = [
    ['battery12vOk', 'Batterie 12V OK'], ['kitGpsConnected', 'Kit GPS connecte'],
    ['engineStartsWell', 'Moteur demarre bien'], ['dashboardDefaults', 'Dashboard defauts'],
    ['buttonsDefaults', 'Boutons defauts'], ['climRadioDefaults', 'Clim / radio defauts'],
  ]
  return mapping.filter(([k]) => form[k] === true).map(([, l]) => l)
}

function formatDraftDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

type Props = {
  forms: TaskFormInstallation[] | undefined
  numberOfInstallations: number
  isAdmin: boolean
  technicianId: number | null
  technicianFullname?: string | null
  technicianUsername?: string | null
  taskClient?: string | null
  /** All saved drafts for this task. */
  drafts?: TaskFormDraft[]
  /** The draft currently being edited. */
  activeDraftId?: string | null
  /** Called when user clicks "Continue" on a draft. */
  onResumeDraft?: (draft: TaskFormDraft) => void
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
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)

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

  return (
    <>
    <SubmittedFormViewerModal
      form={viewerForm}
      onClose={() => setViewerForm(null)}
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
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fiches soumises</p>
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
          {submitted === 0 && drafts.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center">
              <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-slate-500">
                {isAdmin ? 'No fiche submitted yet.' : "You haven't submitted any fiche for this task."}
              </p>
            </div>
          ) : null}

          {/* Draft rows */}
          {drafts.length > 0 ? (
            <div className="mt-4 space-y-2">
              {drafts.map((draft) => {
                const isExpanded = expandedDraftId === draft.draftId
                const isActive = activeDraftId === draft.draftId
                return (
                  <div
                    key={draft.draftId}
                    className={`overflow-hidden rounded-xl border transition ${
                      isActive
                        ? 'border-amber-300 bg-amber-50/70 ring-1 ring-amber-200'
                        : 'border-amber-200 bg-amber-50/40'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-amber-50"
                      onClick={() => setExpandedDraftId(isExpanded ? null : draft.draftId)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-amber-900">Brouillon</p>
                            {isActive ? (
                              <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">En cours</span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-amber-700/70">
                            {draft.step === 'SIGNED_FICHE' ? 'Etape 2 / 2' : 'Etape 1 / 2'}
                            {' \u00b7 '}
                            {formatDraftDate(draft.createdAt)}
                            {draft.form.installerName?.trim() ? ` \u00b7 ${draft.form.installerName.trim()}` : ''}
                          </p>
                        </div>
                      </div>
                      <svg
                        className={`h-4 w-4 shrink-0 text-amber-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-amber-200/60 bg-white px-4 py-4">
                        {(() => {
                          const fields = getDraftFields(draft.form)
                          const checkedOpts = getCheckedOptions(draft.form)
                          const checkedList = getCheckedChecklist(draft.form)
                          const hasObs = Boolean(draft.form.observations?.trim())
                          return (
                            <div className="space-y-4">
                              {fields.length > 0 ? (
                                <div>
                                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Informations remplies</p>
                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {fields.map((f) => (
                                      <div key={f.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</p>
                                        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{f.value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {checkedOpts.length > 0 ? (
                                <div>
                                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Options vehicule</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {checkedOpts.map((o) => (
                                      <span key={o} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200/60">
                                        <svg className="h-3 w-3 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        {o}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {checkedList.length > 0 ? (
                                <div>
                                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Checklist</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {checkedList.map((c) => (
                                      <span key={c} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/60">
                                        <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {hasObs ? (
                                <div>
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Observations</p>
                                  <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                    {draft.form.observations}
                                  </p>
                                </div>
                              ) : null}

                              {draft.ficheUrl ? (
                                <div className="flex items-center gap-2 text-xs text-emerald-700">
                                  <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Fiche signee jointe
                                </div>
                              ) : null}

                              <button
                                type="button"
                                className="mt-1 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:from-amber-600 hover:to-amber-700 active:scale-[0.98]"
                                onClick={() => onResumeDraft?.(draft)}
                              >
                                Continuer le brouillon
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                              </button>
                            </div>
                          )
                        })()}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* Submitted form rows */}
          {submitted > 0 ? (
            <ul className={`${hasDrafts ? 'mt-3' : submitted === 0 ? '' : 'mt-4'} space-y-2`}>
              {visible
                .slice()
                .sort((a, b) => Number(a.installationIndex ?? 0) - Number(b.installationIndex ?? 0))
                .map((f) => {
                  const idx = f.installationIndex != null ? `Installation ${f.installationIndex}` : `Fiche #${f.id}`
                  const hasUrl = Boolean(f.ficheUrl?.trim())
                  return (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{idx}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatFormWhen(f)}
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
