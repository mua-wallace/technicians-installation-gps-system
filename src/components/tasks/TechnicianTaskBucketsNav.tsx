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
}

const ITEMS: Item[] = [
  {
    id: 'all',
    labelKey: 'buckets.all',
    hintKey: 'buckets.allHint',
    countClass: 'bg-slate-100 text-slate-800',
    ringActive: 'ring-sky-500',
  },
  {
    id: 'draft',
    labelKey: 'buckets.draft',
    hintKey: 'buckets.draftHint',
    countClass: 'bg-amber-100 text-amber-900',
    ringActive: 'ring-amber-500',
  },
  {
    id: 'submitted',
    labelKey: 'buckets.submitted',
    hintKey: 'buckets.submittedHint',
    countClass: 'bg-sky-100 text-sky-900',
    ringActive: 'ring-sky-500',
  },
  {
    id: 'rejected',
    labelKey: 'buckets.rejected',
    hintKey: 'buckets.rejectedHint',
    countClass: 'bg-rose-100 text-rose-900',
    ringActive: 'ring-rose-500',
  },
  {
    id: 'validated',
    labelKey: 'buckets.validated',
    hintKey: 'buckets.validatedHint',
    countClass: 'bg-emerald-100 text-emerald-900',
    ringActive: 'ring-emerald-500',
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
    <nav aria-label={t('buckets.stripTitle')} className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t('buckets.navTitle')}</p>
      <p className="text-[11px] leading-snug text-slate-500">{t('buckets.navHint')}</p>
      <ul className="flex flex-col gap-2">
        {ITEMS.map((item) => {
          const n = counts[item.id] ?? 0
          const active = value === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                  active ? `ring-2 ring-offset-1 ${item.ringActive}` : ''
                }`}
                aria-pressed={active}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{t(item.labelKey)}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{t(item.hintKey)}</p>
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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t('buckets.stripTitle')}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5">
        {ITEMS.map((item) => {
          const n = counts[item.id] ?? 0
          const active = value === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                active
                  ? `border-sky-400 bg-sky-50 ring-2 ring-sky-400`
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
              aria-pressed={active}
              title={t(item.hintKey)}
            >
              <span className="max-w-[5.5rem] text-xs font-semibold leading-tight text-slate-900">{t(item.labelKey)}</span>
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
