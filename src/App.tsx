import { useEffect, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { useAuthStore } from './store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from './api/users'

type InterventionRow = {
  id: number
  type: 'installation' | 'intervention'
  status: 'Terminée' | 'En cours' | 'Planifiée'
  client: string
  vehicleMakeModel: string
  immatriculation: string
  year: string
  odometer: string
  chassis: string
  operatorCode: string
  country: string
  simNumber: string
  imsi: string
  antivol: boolean
  geolocation: boolean
  fleetManagement: boolean
  otherOption: boolean
  camera: boolean
  alarm: boolean
  buzzer: boolean
  canClick: boolean
  alimentationRed: boolean
  alimentationYellow: boolean
  acc: boolean
  immobilisationCable: boolean
  fuelGauge: boolean
  canH: boolean
  canL: boolean
  observations: string
  battery12vOk: boolean
  kitGpsConnected: boolean
  engineStartsWell: boolean
  dashboardDefaults: boolean
  buttonsDefaults: boolean
  climRadioDefaults: boolean
  installerName: string
  date: string
}

const technicianNames = [
  'Srandley M.',
  'Serge T.',
  'Junior N.',
  'Guy P.',
  'Aloys Noël',
] as const

const clients = ['SABC', 'BOISSONS CAM', 'TRANSLOG', 'LOGISTICS SA', 'FLEET CO'] as const
const vehicles = ['Renault Duster', 'Toyota Hilux', 'Ford Ranger', 'Isuzu D-Max', 'Mitsubishi L200'] as const
const countries = ['Cameroun', 'Sénégal', 'Côte d\'Ivoire', 'Gabon', 'Mali'] as const

function buildDummyInterventions(): InterventionRow[] {
  return Array.from({ length: 20 }).map((_, index) => {
    const client = clients[index % clients.length]
    const vehicle = vehicles[index % vehicles.length]
    const tech = technicianNames[index % technicianNames.length]
    const status: InterventionRow['status'] =
      index % 3 === 0 ? 'Terminée' : index % 3 === 1 ? 'En cours' : 'Planifiée'
    const country = countries[index % countries.length]
    const year = String(2018 + (index % 7))
    const hasOptions = index % 2 === 0
    const hasCabling = index % 3 !== 2
    const checklistOk = status === 'Terminée'
    return {
      id: index + 1,
      type: index % 2 === 0 ? 'installation' : 'intervention',
      status,
      client,
      vehicleMakeModel: vehicle,
      immatriculation: index % 2 === 0 ? `LT-56${index} KA` : `CE-78${index} AA`,
      year,
      odometer: String(25000 + index * 3200),
      chassis: `CH${100000 + index}${String.fromCharCode(65 + (index % 26))}`,
      operatorCode: `OP${1000 + index}`,
      country,
      simNumber: `+237 6${String(index).padStart(2, '0')} 12 34 56`,
      imsi: `6020${String(index).padStart(2, '0')}123456789`,
      antivol: hasOptions,
      geolocation: true,
      fleetManagement: hasOptions && index % 3 === 0,
      otherOption: index % 5 === 0,
      camera: hasCabling && index % 2 === 0,
      alarm: hasCabling,
      buzzer: hasCabling && index % 4 === 0,
      canClick: hasCabling,
      alimentationRed: hasCabling,
      alimentationYellow: hasCabling && index % 2 === 1,
      acc: hasCabling,
      immobilisationCable: hasCabling && index % 3 === 0,
      fuelGauge: hasCabling,
      canH: hasCabling,
      canL: hasCabling,
      observations: index % 4 === 0 ? 'Contrôle OK. Client satisfait.' : index % 4 === 1 ? 'Remplacement batterie effectué.' : '',
      battery12vOk: checklistOk,
      kitGpsConnected: checklistOk,
      engineStartsWell: checklistOk,
      dashboardDefaults: !checklistOk && index % 2 === 0,
      buttonsDefaults: index % 5 === 0,
      climRadioDefaults: index % 6 === 0,
      installerName: tech,
      date: `2024-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
    }
  })
}

const dummyInterventions = buildDummyInterventions()
const clientOptions = Array.from(new Set(dummyInterventions.map((row) => row.client))).sort()
const immatriculationOptions = Array.from(
  new Set(dummyInterventions.map((row) => row.immatriculation)),
).sort()

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded bg-slate-900/50 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value || '—'}</span>
    </div>
  )
}

function CheckRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded bg-slate-900/50 px-3 py-2">
      <span
        className={
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ' +
          (checked
            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
            : 'border-slate-600 bg-slate-800/60 text-slate-500')
        }
      >
        {checked ? (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="text-[10px]">—</span>
        )}
      </span>
      <span className={checked ? 'text-slate-200' : 'text-slate-500'}>{label}</span>
    </div>
  )
}

export function App() {
  const {
    currentForm,
    updateFormField,
    submitForm,
    resetForm,
  } = useAppStore()
  const authUser = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const clearAuth = useAuthStore((s) => s.clearAuth)

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
  const displayRole = profile?.role || '—'

  const [showDrawer, setShowDrawer] = useState(false)
  const [sheetType, setSheetType] = useState<'installation' | 'intervention' | null>(null)
  const [detailsRow, setDetailsRow] = useState<InterventionRow | null>(null)
  const [filterType, setFilterType] = useState<string>('')
  const [filterClient, setFilterClient] = useState('')
  const [filterVehicle, setFilterVehicle] = useState('')
  const [filterTechnician, setFilterTechnician] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]

  const filteredInterventions = dummyInterventions.filter((row) => {
    if (filterType && row.type !== filterType) return false
    if (filterClient && !row.client.toLowerCase().includes(filterClient.toLowerCase())) return false
    if (filterVehicle && !row.vehicleMakeModel.toLowerCase().includes(filterVehicle.toLowerCase())) return false
    if (filterTechnician && row.installerName !== filterTechnician) return false
    if (filterStatus && row.status !== filterStatus) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredInterventions.length / pageSize))
  const paginatedInterventions = filteredInterventions.slice(
    (page - 1) * pageSize,
    page * pageSize,
  )

  useEffect(() => {
    setPage(1)
  }, [filterType, filterClient, filterVehicle, filterTechnician, filterStatus])

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const handleSaveForm = () => {
    submitForm()
    resetForm()
    setShowDrawer(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col px-3 md:px-6">
        <header className="flex shrink-0 flex-col gap-4 border-b border-slate-800 bg-slate-950 py-4 md:h-20 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              malambi
            </h1>
            <p className="text-sm text-slate-400">
              Fiches d&apos;installation et d&apos;intervention GPS pour techniciens
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
              <span className="text-slate-500">Technician</span>
              <span className="min-w-0 truncate font-medium text-slate-100">{displayName}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">{displayRole}</span>
              {meQuery.isFetching ? <span className="text-slate-600">(sync…)</span> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <button
                type="button"
                className="min-h-10 rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-50 shadow-sm hover:bg-sky-700"
                onClick={() => {
                  setSheetType(null)
                  resetForm()
                  setShowDrawer(true)
                }}
              >
                Nouvelle fiche
              </button>
              <button
                type="button"
                className="min-h-10 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  clearAuth()
                  window.location.href = '/login'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-4 py-4 lg:gap-6 lg:flex">
          <aside className="hidden w-56 shrink-0 space-y-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300 lg:block">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Vue d&apos;ensemble
              </p>
              <p className="text-sm font-medium text-slate-50">
                {filteredInterventions.length} intervention{filteredInterventions.length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Filtrez à droite puis consultez les détails dans le panneau latéral.
              </p>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Types de fiche
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                  <span className="text-[11px] text-slate-300">Installation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="text-[11px] text-slate-300">Intervention</span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Statuts
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-slate-300">Terminée</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] text-slate-300">En cours</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span className="text-[11px] text-slate-300">Planifiée</span>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <section className="shrink-0 rounded-xl border border-slate-300 bg-slate-200/80 p-6 shadow-sm text-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold uppercase tracking-wide text-sky-900">
                  Fiche d&apos;intervention système GPS
                </h2>
                <p className="text-xs text-slate-700">
                  Cliquez sur &quot;Nouvelle fiche&quot; en haut à droite pour remplir la fiche en
                  plein écran.
                </p>
              </div>
              <span className="rounded-full border border-sky-700 bg-sky-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Papier &rarr; Numérique
              </span>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <div className="shrink-0 mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-300">
                Historique (données de démonstration)
              </h2>
              <span className="text-xs text-slate-500">
                {filteredInterventions.length} intervention{filteredInterventions.length === 1 ? '' : 's'}
                {totalPages > 1 && ` · page ${page}/${totalPages}`}
              </span>
            </div>

            <div className="shrink-0 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Filtres</span>
              <select
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Tous les types</option>
                <option value="installation">Installation</option>
                <option value="intervention">Intervention</option>
              </select>
              <input
                type="text"
                placeholder="Client"
                className="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
              />
              <input
                type="text"
                placeholder="Véhicule"
                className="w-36 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500"
                value={filterVehicle}
                onChange={(e) => setFilterVehicle(e.target.value)}
              />
              <select
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
              >
                <option value="">Tous les techniciens</option>
                {technicianNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="Terminée">Terminée</option>
                <option value="En cours">En cours</option>
                <option value="Planifiée">Planifiée</option>
              </select>
              {(filterType || filterClient || filterVehicle || filterTechnician || filterStatus) && (
                <button
                  type="button"
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                  onClick={() => {
                    setFilterType('')
                    setFilterClient('')
                    setFilterVehicle('')
                    setFilterTechnician('')
                    setFilterStatus('')
                  }}
                >
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-xs text-slate-100">
                <thead>
                  <tr className="bg-slate-800/80 text-left uppercase tracking-wide text-[11px] text-slate-300">
                    <th className="border-b border-slate-700 px-3 py-2">N°</th>
                    <th className="border-b border-slate-700 px-3 py-2">Type</th>
                    <th className="border-b border-slate-700 px-3 py-2">Client</th>
                    <th className="border-b border-slate-700 px-3 py-2">Immat.</th>
                    <th className="border-b border-slate-700 px-3 py-2">Véhicule</th>
                    <th className="border-b border-slate-700 px-3 py-2">Technicien</th>
                    <th className="border-b border-slate-700 px-3 py-2">Statut</th>
                    <th className="w-0 border-b border-slate-700 py-2 pl-1 pr-2 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInterventions.map((row, index) => (
                    <tr
                      key={row.id}
                      className={index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/80'}
                    >
                      <td className="border-b border-slate-800 px-3 py-2">{row.id}</td>
                      <td className="border-b border-slate-800 px-3 py-2">
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                            (row.type === 'installation'
                              ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/40'
                              : 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40')
                          }
                        >
                          {row.type === 'installation' ? 'Installation' : 'Intervention'}
                        </span>
                      </td>
                      <td className="border-b border-slate-800 px-3 py-2">{row.client}</td>
                      <td className="border-b border-slate-800 px-3 py-2">{row.immatriculation}</td>
                      <td className="border-b border-slate-800 px-3 py-2">{row.vehicleMakeModel}</td>
                      <td className="border-b border-slate-800 px-3 py-2">{row.installerName}</td>
                      <td className="border-b border-slate-800 px-3 py-2 pr-1">
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                            (row.status === 'Terminée'
                              ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40'
                              : row.status === 'En cours'
                                ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40'
                                : 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/40')
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="w-0 border-b border-slate-800 py-2 pl-1 pr-2 text-right">
                        <button
                          type="button"
                          className="rounded p-1.5 text-slate-400 hover:bg-sky-600/30 hover:text-sky-300"
                          onClick={() => setDetailsRow(row)}
                          title="Voir détail"
                        >
                          <span className="sr-only">Voir détail</span>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredInterventions.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-slate-400">
                    {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filteredInterventions.length)} sur {filteredInterventions.length}
                  </p>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Par page</span>
                    <select
                      className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-slate-200 outline-none focus:border-sky-500"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Précédent
                  </button>
                  <span className="px-2 text-xs text-slate-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {filteredInterventions.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">Aucune intervention ne correspond aux filtres.</p>
            )}
            </div>
          </section>
          </div>
        </main>
      </div>

      {detailsRow && (
        <div className="fixed inset-0 z-30 flex">
          <button
            type="button"
            className="h-full w-full bg-black/40"
            onClick={() => setDetailsRow(null)}
          />
          <div className="flex h-full w-full max-w-2xl flex-col bg-slate-900 shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={
                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                    (detailsRow.status === 'Terminée'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : detailsRow.status === 'En cours'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-sky-500/20 text-sky-300')
                  }
                >
                  {detailsRow.status}
                </span>
                <span
                  className={
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                    (detailsRow.type === 'installation'
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-cyan-500/20 text-cyan-300')
                  }
                >
                  {detailsRow.type === 'installation' ? 'Installation' : 'Intervention'}
                </span>
                <h3 className="truncate text-sm font-semibold text-slate-100">
                  #{detailsRow.id} — {detailsRow.client}
                </h3>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => setDetailsRow(null)}
              >
                <span className="sr-only">Fermer</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-6">
                <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Client & véhicule
                  </h4>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <DetailRow label="Client" value={detailsRow.client} />
                    <DetailRow label="Marque / modèle" value={detailsRow.vehicleMakeModel} />
                    <DetailRow label="Immatriculation" value={detailsRow.immatriculation} />
                    <DetailRow label="Année" value={detailsRow.year} />
                    <DetailRow label="Odomètre" value={detailsRow.odometer} />
                    <DetailRow label="Châssis" value={detailsRow.chassis} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Opérateur & SIM
                  </h4>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <DetailRow label="Code opérateur" value={detailsRow.operatorCode} />
                    <DetailRow label="Pays" value={detailsRow.country} />
                    <DetailRow label="N° SIM" value={detailsRow.simNumber} />
                    <DetailRow label="IMSI" value={detailsRow.imsi} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Options véhicule
                  </h4>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <CheckRow label="Antivol" checked={detailsRow.antivol} />
                    <CheckRow label="Géolocalisation" checked={detailsRow.geolocation} />
                    <CheckRow label="Gestion flotte FMS" checked={detailsRow.fleetManagement} />
                    <CheckRow label="Autre option" checked={detailsRow.otherOption} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Matériel / câblage
                  </h4>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <CheckRow label="Caméra" checked={detailsRow.camera} />
                    <CheckRow label="Alarme" checked={detailsRow.alarm} />
                    <CheckRow label="Buzzer" checked={detailsRow.buzzer} />
                    <CheckRow label="CAN Click" checked={detailsRow.canClick} />
                    <CheckRow label="Alim. rouge" checked={detailsRow.alimentationRed} />
                    <CheckRow label="Alim. jaune" checked={detailsRow.alimentationYellow} />
                    <CheckRow label="ACC" checked={detailsRow.acc} />
                    <CheckRow label="Câble immobilisation" checked={detailsRow.immobilisationCable} />
                    <CheckRow label="Jauge carburant" checked={detailsRow.fuelGauge} />
                    <CheckRow label="CAN H" checked={detailsRow.canH} />
                    <CheckRow label="CAN L" checked={detailsRow.canL} />
                  </div>
                </section>

                {detailsRow.observations && (
                  <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                      Observations
                    </h4>
                    <p className="text-sm text-slate-200">{detailsRow.observations}</p>
                  </section>
                )}

                <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Checklist
                  </h4>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <CheckRow label="Batterie 12V OK" checked={detailsRow.battery12vOk} />
                    <CheckRow label="Kit GPS connecté" checked={detailsRow.kitGpsConnected} />
                    <CheckRow label="Moteur démarre bien" checked={detailsRow.engineStartsWell} />
                    <CheckRow label="Dashboard défauts" checked={detailsRow.dashboardDefaults} />
                    <CheckRow label="Boutons défauts" checked={detailsRow.buttonsDefaults} />
                    <CheckRow label="Clim / radio défauts" checked={detailsRow.climRadioDefaults} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <DetailRow label="Installateur" value={detailsRow.installerName} />
                    <DetailRow label="Date" value={detailsRow.date} />
                  </div>
                </section>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-700 px-4 py-3">
              <button
                type="button"
                className="w-full rounded-lg bg-slate-700 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
                onClick={() => setDetailsRow(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showDrawer && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            className="h-full w-full bg-black/40"
            onClick={() => setShowDrawer(false)}
          />
          <div className="h-full w-full max-w-2xl bg-slate-100 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-300 bg-slate-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                  {sheetType === 'installation'
                    ? "Fiche d'installation"
                    : sheetType === 'intervention'
                      ? "Fiche d'intervention"
                      : 'Nouvelle fiche'}
                </p>
                <p className="text-[11px] text-slate-600">
                  {sheetType
                    ? 'Saisie sur une seule colonne'
                    : 'Choisissez Installation ou Intervention pour commencer'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-400 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setShowDrawer(false)}
              >
                Fermer
              </button>
            </div>

            <div className="h-[calc(100%-52px)] overflow-y-auto px-4 py-4 text-sm text-slate-900">
              <div className="mb-4 flex items-center gap-2 text-xs">
                <span className="mr-1 text-[11px] font-semibold uppercase text-slate-600">
                  Type de fiche
                </span>
                <button
                  type="button"
                  className={
                    'rounded-full border px-3 py-1 font-medium ' +
                    (sheetType === 'installation'
                      ? 'border-sky-700 bg-sky-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100')
                  }
                  onClick={() => setSheetType('installation')}
                >
                  Installation
                </button>
                <button
                  type="button"
                  className={
                    'rounded-full border px-3 py-1 font-medium ' +
                    (sheetType === 'intervention'
                      ? 'border-sky-700 bg-sky-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100')
                  }
                  onClick={() => setSheetType('intervention')}
                >
                  Intervention
                </button>
              </div>

              {!sheetType && (
                <p className="text-xs text-slate-600">
                  Sélectionnez d&apos;abord le type de fiche ci-dessus. Le même formulaire sera utilisé
                  pour les deux cas.
                </p>
              )}

              {sheetType && (
                <>
                  <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">Client</label>
                  <input
                    type="text"
                    list="client-options"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.client}
                    onChange={(e) => updateFormField('client', e.target.value)}
                    placeholder="Rechercher ou saisir un client"
                  />
                  <datalist id="client-options">
                    {clientOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">
                    Marque / modèle
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.vehicleMakeModel}
                    onChange={(e) => updateFormField('vehicleMakeModel', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">
                    Immatriculation
                  </label>
                  <input
                    type="text"
                    list="immat-options"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.immatriculation}
                    onChange={(e) => updateFormField('immatriculation', e.target.value)}
                    placeholder="Rechercher ou saisir une immatriculation"
                  />
                  <datalist id="immat-options">
                    {immatriculationOptions.map((immat) => (
                      <option key={immat} value={immat} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-sky-800">
                      Année
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                      value={currentForm.year}
                      onChange={(e) => updateFormField('year', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-sky-800">
                      Odomètre
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                      value={currentForm.odometer}
                      onChange={(e) => updateFormField('odometer', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-sky-800">
                      Châssis
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                      value={currentForm.chassis}
                      onChange={(e) => updateFormField('chassis', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">
                    Code opérateur
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.operatorCode}
                    onChange={(e) => updateFormField('operatorCode', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">Pays</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.country}
                    onChange={(e) => updateFormField('country', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">
                    N° SIM
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.simNumber}
                    onChange={(e) => updateFormField('simNumber', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">IMSI</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.imsi}
                    onChange={(e) => updateFormField('imsi', e.target.value)}
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-sky-800">
                    Options véhicule
                  </p>
                  <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.antivol}
                          onChange={(e) => updateFormField('antivol', e.target.checked)}
                        />
                        <span className="text-slate-700">Antivol</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.geolocation}
                          onChange={(e) => updateFormField('geolocation', e.target.checked)}
                        />
                        <span className="text-slate-700">Géolocalisation</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.fleetManagement}
                          onChange={(e) => updateFormField('fleetManagement', e.target.checked)}
                        />
                        <span className="text-slate-700">Gestion flotte FMS</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.otherOption}
                          onChange={(e) => updateFormField('otherOption', e.target.checked)}
                        />
                        <span className="text-slate-700">Autre option</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-sky-800">
                    Matériel / câblage
                  </p>
                  <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.camera}
                          onChange={(e) => updateFormField('camera', e.target.checked)}
                        />
                        <span className="text-slate-700">Caméra</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.alarm}
                          onChange={(e) => updateFormField('alarm', e.target.checked)}
                        />
                        <span className="text-slate-700">Alarme</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.buzzer}
                          onChange={(e) => updateFormField('buzzer', e.target.checked)}
                        />
                        <span className="text-slate-700">Buzzer</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.canClick}
                          onChange={(e) => updateFormField('canClick', e.target.checked)}
                        />
                        <span className="text-slate-700">CAN Click</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.alimentationRed}
                          onChange={(e) => updateFormField('alimentationRed', e.target.checked)}
                        />
                        <span className="text-slate-700">Alimentation rouge</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.alimentationYellow}
                          onChange={(e) => updateFormField('alimentationYellow', e.target.checked)}
                        />
                        <span className="text-slate-700">Alimentation jaune</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.acc}
                          onChange={(e) => updateFormField('acc', e.target.checked)}
                        />
                        <span className="text-slate-700">ACC</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.immobilisationCable}
                          onChange={(e) =>
                            updateFormField('immobilisationCable', e.target.checked)
                          }
                        />
                        <span className="text-slate-700">Câble immobilisation</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.fuelGauge}
                          onChange={(e) => updateFormField('fuelGauge', e.target.checked)}
                        />
                        <span className="text-slate-700">Jauge carburant</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.canH}
                          onChange={(e) => updateFormField('canH', e.target.checked)}
                        />
                        <span className="text-slate-700">CAN H</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.canL}
                          onChange={(e) => updateFormField('canL', e.target.checked)}
                        />
                        <span className="text-slate-700">CAN L</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">
                    Observations
                  </label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.observations}
                    onChange={(e) => updateFormField('observations', e.target.value)}
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-sky-800">Checklist</p>
                  <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.battery12vOk}
                          onChange={(e) => updateFormField('battery12vOk', e.target.checked)}
                        />
                        <span>Batterie 12V OK</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.kitGpsConnected}
                          onChange={(e) => updateFormField('kitGpsConnected', e.target.checked)}
                        />
                        <span>Kit GPS connecté</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.engineStartsWell}
                          onChange={(e) => updateFormField('engineStartsWell', e.target.checked)}
                        />
                        <span>Moteur démarre bien</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.dashboardDefaults}
                          onChange={(e) => updateFormField('dashboardDefaults', e.target.checked)}
                        />
                        <span>Dashboard défauts</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.buttonsDefaults}
                          onChange={(e) => updateFormField('buttonsDefaults', e.target.checked)}
                        />
                        <span>Boutons défauts</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-slate-400 text-sky-700"
                          checked={currentForm.climRadioDefaults}
                          onChange={(e) => updateFormField('climRadioDefaults', e.target.checked)}
                        />
                        <span>Clim / radio défauts</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">
                    Installateur
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.installerName}
                    onChange={(e) => updateFormField('installerName', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-sky-800">Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-0"
                    value={currentForm.date}
                    onChange={(e) => updateFormField('date', e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-md border border-slate-400 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => resetForm()}
                >
                  Effacer
                </button>
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                  onClick={handleSaveForm}
                >
                  Enregistrer
                </button>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
