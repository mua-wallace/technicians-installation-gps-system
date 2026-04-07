import type { TechnicianTaskBucket } from '../../api/tasks'
import { useI18n } from '../../i18n/I18nContext'
import type { MessageId } from '../../i18n/messages'

/** Sidebar cards — excludes internal-only `open` bucket (those tasks stay under “All”). */
export type TechnicianBucketSelection = Exclude<TechnicianTaskBucket, 'open'> | 'all'

type Item = {
  id: TechnicianBucketSelection
  labelKey: MessageId
  hintKey: MessageId
  countClass: string
  ringActive: string
  iconBg: string
  /** SVG path(s) for the icon */
  iconPath: string
}

const ITEMS: Item[] = [
  {
    id: 'all',
    labelKey: 'buckets.all',
    hintKey: 'buckets.allHint',
    countClass: 'bg-slate-100 text-slate-800',
    ringActive: 'ring-sky-500',
    iconBg: 'bg-slate-100 text-slate-500',
    iconPath: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  },
  {
    id: 'draft',
    labelKey: 'buckets.draft',
    hintKey: 'buckets.draftHint',
    countClass: 'bg-amber-100 text-amber-900',
    ringActive: 'ring-amber-500',
    iconBg: 'bg-amber-50 text-amber-500',
    iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  {
    id: 'submitted',
    labelKey: 'buckets.submitted',
    hintKey: 'buckets.submittedHint',
    countClass: 'bg-sky-100 text-sky-900',
    ringActive: 'ring-sky-500',
    iconBg: 'bg-sky-50 text-sky-500',
    iconPath: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  },
  {
    id: 'rejected',
    labelKey: 'buckets.rejected',
    hintKey: 'buckets.rejectedHint',
    countClass: 'bg-rose-100 text-rose-900',
    ringActive: 'ring-rose-500',
    iconBg: 'bg-rose-50 text-rose-500',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  {
    id: 'validated',
    labelKey: 'buckets.validated',
    hintKey: 'buckets.validatedHint',
    countClass: 'bg-emerald-100 text-emerald-900',
    ringActive: 'ring-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-500',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
]

type Props = {
  counts: Record<TechnicianBucketSelection, number>
  value: TechnicianBucketSelection
  onChange: (next: TechnicianBucketSelection) => void
}

export function TechnicianTaskBucketsNav({ counts, value, onChange }: Props) {
  const { t } = useI18n()

  return (
    <nav aria-label={t('buckets.stripTitle')} className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('buckets.navTitle')}</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">{t('buckets.navHint')}</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {ITEMS.map((item) => {
          const n = counts[item.id] ?? 0
          const active = value === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`w-full rounded-xl border bg-white px-3 py-3 text-left transition-all duration-150 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                  active
                    ? `border-transparent ring-2 ring-offset-1 ${item.ringActive} shadow-sm`
                    : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
                aria-pressed={active}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.iconBg}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{t(item.labelKey)}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t(item.hintKey)}</p>
                  </div>
                  <span
                    className={`inline-flex min-h-[1.75rem] min-w-[1.75rem] shrink-0 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums ${item.countClass}`}
                    aria-hidden
                  >
                    {n}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Horizontal strip for small screens (same data as sidebar). */
export function TechnicianTaskBucketsStrip({ counts, value, onChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="lg:hidden">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('buckets.stripTitle')}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
        {ITEMS.map((item) => {
          const n = counts[item.id] ?? 0
          const active = value === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                active
                  ? 'border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-400/50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
              aria-pressed={active}
              title={t(item.hintKey)}
            >
              <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${item.iconBg}`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                </svg>
              </div>
              <span className="text-xs font-semibold text-slate-800">{t(item.labelKey)}</span>
              <span
                className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${item.countClass}`}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
