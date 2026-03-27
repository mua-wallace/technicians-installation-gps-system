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
      ? 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500'
      : 'bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-500'

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
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 p-4">
        <DialogPanel
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          style={panelPos ? { position: 'fixed', top: panelPos.top, left: panelPos.left } : undefined}
        >
          <DialogTitle className="text-sm font-semibold text-slate-900">{title}</DialogTitle>
          {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={onClose}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              className={`rounded-md px-3 py-2 text-xs font-semibold shadow-sm disabled:cursor-not-allowed ${confirmClass}`}
              onClick={onConfirm}
            >
              {busy ? '...' : confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

