import { useEffect } from 'react'

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="rise w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card"
      >
        <h2 id="confirm-title" className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-sm leading-relaxed text-muted">
          {body}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text transition hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[#c0362c] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#a82e26] focus-visible:ring-2 focus-visible:ring-[#c0362c]/40 focus-visible:outline-none"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
