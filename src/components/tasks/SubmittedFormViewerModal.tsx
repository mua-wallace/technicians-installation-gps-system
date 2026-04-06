import { useEffect, useMemo, useState } from 'react'
import {
  coerceTaskFormBool,
  formatTaskFormText,
  readTaskFormField,
  tasksApi,
  type TaskFormInstallation,
} from '../../api/tasks'
import type { InterventionForm } from '../../store/useAppStore'

type FormRecord = TaskFormInstallation & Partial<InterventionForm>

type Props = {
  form: TaskFormInstallation | null
  onClose: () => void
  /** Shown in the header (e.g. task client name). */
  taskLabel?: string
}

function asRecord(f: TaskFormInstallation): FormRecord {
  return f as FormRecord
}

/** Same field layout as “Fiche (remplie)” in `TaskDetailDrawer` (finalized task). */
function FormDetailsLeft({ form }: { form: FormRecord }) {
  const raw = form as Record<string, unknown>
  const txt = (camelKey: string) => formatTaskFormText(readTaskFormField(raw, camelKey))
  const bit = (camelKey: string) => coerceTaskFormBool(readTaskFormField(raw, camelKey))

  const obsRaw = readTaskFormField(raw, 'observations')
  const obsDisplay =
    obsRaw === null || obsRaw === undefined
      ? '—'
      : typeof obsRaw === 'string'
        ? obsRaw.trim() || '—'
        : formatTaskFormText(obsRaw)

  const vehicleOptionRows: Array<[keyof InterventionForm, string]> = [
    ['antivol', 'Antivol'],
    ['geolocation', 'Géolocalisation'],
    ['fleetManagement', 'Gestion de flotte FMS'],
    ['otherOption', 'Autre option'],
    ['camera', 'Caméra'],
    ['alarm', 'Alarme'],
    ['buzzer', 'Buzzer'],
    ['canClick', 'CAN Click'],
    ['alimentationRed', 'Alimentation rouge'],
    ['alimentationYellow', 'Alimentation jaune'],
    ['acc', 'ACC'],
    ['immobilisationCable', 'Immobilisation'],
    ['fuelGauge', 'Jauge carburant'],
    ['canH', 'CAN H'],
    ['canL', 'CAN L'],
  ]

  const checklistRows: Array<[keyof InterventionForm, string]> = [
    ['battery12vOk', 'Batterie OK'],
    ['kitGpsConnected', 'Kit GPS connecté'],
    ['engineStartsWell', 'Moteur démarre bien'],
    ['dashboardDefaults', 'Défauts tableau de bord'],
    ['buttonsDefaults', 'Boutons défauts'],
    ['climRadioDefaults', 'Clim / radio défauts'],
  ]

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fiche (remplie)</p>
      <div className="mt-3 space-y-3 text-sm text-slate-900">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <div className="col-span-full">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Client</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('client')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Immatriculation</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('immatriculation')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Marque / modèle</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('vehicleMakeModel')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Année</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('year')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Odomètre</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('odometer')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Châssis</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('chassis')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Code opérateur</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('operatorCode')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Pays</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('country')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">N° SIM</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('simNumber')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">IMSI</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('imsi')}</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Options véhicule</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {vehicleOptionRows.map(([key, label]) => {
              const checked = bit(key as string)
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-xs font-medium text-slate-900">{label}</span>
                  <span
                    className={
                      checked
                        ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-500/30'
                        : 'rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-500/20'
                    }
                  >
                    {checked ? 'Oui' : 'Non'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Checklist</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {checklistRows.map(([key, label]) => {
              const checked = bit(key as string)
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-xs font-medium text-slate-900">{label}</span>
                  <span
                    className={
                      checked
                        ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-500/30'
                        : 'rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-500/20'
                    }
                  >
                    {checked ? 'Oui' : 'Non'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Observations</p>
          <p className="mt-1 whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2">
            {obsDisplay}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Installateur</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('installerName')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Date</p>
            <p className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">{txt('date')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function useFichePreviewSrc(ficheUrl: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ficheUrl?.trim()) {
      setSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
      setError('')
      return
    }

    let cancelled = false
    setError('')

    const isHttpUrl = /^https?:\/\//i.test(ficheUrl.trim())
    if (isHttpUrl) {
      setSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return ficheUrl.trim()
      })
      return () => {}
    }

    setSrc((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })

    tasksApi
      .fetchSignedFicheBlob(ficheUrl)
      .then((blob) => {
        if (cancelled) return
        const objectUrl = URL.createObjectURL(blob)
        setSrc((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
          return objectUrl
        })
      })
      .catch((e) => {
        if (cancelled) return
        setSrc(null)
        setError(e?.message ?? 'Impossible de charger la fiche')
      })

    return () => {
      cancelled = true
      setSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [ficheUrl])

  return { src, error }
}

function FichePreviewRight({ ficheUrl }: { ficheUrl: string | null | undefined }) {
  const trimmed = ficheUrl?.trim() ?? ''
  const { src, error } = useFichePreviewSrc(trimmed || null)

  const ext = useMemo(() => {
    if (!trimmed) return ''
    const last = trimmed.split('/').pop() ?? ''
    const dot = last.lastIndexOf('.')
    if (dot === -1) return ''
    const e = last.slice(dot + 1).toLowerCase().split('?')[0]
    return e
  }, [trimmed])

  if (!trimmed) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-slate-600">Aucun fichier fiche (ficheUrl) pour cette soumission.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-rose-700">{error}</p>
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
        >
          Ouvrir le lien
        </a>
      </div>
    )
  }

  if (!src) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center p-6">
        <p className="text-sm text-slate-500">Chargement de l’aperçu…</p>
      </div>
    )
  }

  const isPdf = ext === 'pdf'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-sky-700 hover:underline"
        >
          Ouvrir ficheUrl dans un nouvel onglet
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mx-auto flex h-full min-h-[320px] max-w-full items-center justify-center rounded-lg border border-slate-200 bg-white">
          {isPdf ? (
            <iframe title="Fiche signée" src={src} className="h-full min-h-[480px] w-full rounded-md" />
          ) : (
            <img src={src} alt="Fiche signée" className="max-h-[calc(90vh-220px)] w-full object-contain p-2" />
          )}
        </div>
      </div>
    </div>
  )
}

function resolveFicheUrl(raw: Record<string, unknown>): string | undefined {
  const v = readTaskFormField(raw, 'ficheUrl')
  if (v === null || v === undefined) return undefined
  if (typeof v === 'string') return v.trim() || undefined
  return String(v).trim() || undefined
}

export function SubmittedFormViewerModal({ form, onClose, taskLabel }: Props) {
  if (!form) return null

  const record = asRecord(form)
  const raw = record as Record<string, unknown>
  const instRaw = readTaskFormField(raw, 'installationIndex')
  const idx =
    instRaw != null && instRaw !== ''
      ? `Installation ${String(instRaw)}`
      : `Fiche #${record.id}`
  const ficheUrlForPreview = resolveFicheUrl(raw)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submitted-form-viewer-title"
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <h2 id="submitted-form-viewer-title" className="text-base font-semibold text-slate-900">
              {idx}
            </h2>
            {taskLabel ? <p className="mt-0.5 truncate text-sm text-slate-600">{taskLabel}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="min-h-0 overflow-y-auto p-4 lg:max-h-[calc(92vh-56px)]">
            <FormDetailsLeft form={record} />
          </div>
          <div className="flex min-h-[280px] flex-col bg-slate-50 lg:min-h-0 lg:max-h-[calc(92vh-56px)]">
            <p className="shrink-0 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-800">
              Fiche signée (ficheUrl)
            </p>
            <div className="min-h-0 flex-1 overflow-hidden">
              <FichePreviewRight ficheUrl={ficheUrlForPreview} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
