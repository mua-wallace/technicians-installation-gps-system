import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmTone?: 'primary' | 'danger'
  busy?: boolean
  anchorRect?: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'OK',
  cancelLabel = 'Annuler',
  confirmTone = 'primary',
  busy,
  anchorRect,
  onConfirm,
  onClose,
}: Props) {
  const confirmClass =
    confirmTone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500 shadow-sm'
      : 'bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-500 shadow-sm'

  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open || !anchorRect) {
      setPanelPos(null)
      return
    }

    const margin = 12
    const gap = 10
    const estimatedWidth = 448 // max-w-md
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    const spaceBelow = viewportH - anchorRect.bottom
    const openBelow = spaceBelow > 220 // heuristic

    const top = Math.max(
      margin,
      Math.round((openBelow ? anchorRect.bottom + gap : anchorRect.top - gap) + (openBelow ? 0 : -240)),
    )

    // prefer aligning to left of button, clamp within viewport
    const preferredLeft = Math.round(anchorRect.left)
    const left = Math.min(Math.max(margin, preferredLeft), Math.max(margin, viewportW - estimatedWidth - margin))

    setPanelPos({ top, left })
  }, [open, anchorRect])

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <div className="animate-fade-in fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 p-4">
        <DialogPanel
          className="animate-scale-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          style={panelPos ? { position: 'fixed', top: panelPos.top, left: panelPos.left } : undefined}
        >
          <DialogTitle className="text-base font-bold text-slate-900">{title}</DialogTitle>
          {description ? <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p> : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-60"
              onClick={onClose}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed active:scale-[0.98] ${confirmClass}`}
              onClick={onConfirm}
            >
              {busy ? (
                <svg className="h-3.5 w-3.5 animate-spin-smooth" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              {busy ? '...' : confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

