import { useEffect, useState } from 'react'
import { SESSION_NOTE_MAX } from '@shared/time'
import type { SessionWrapUp } from '@shared/ipc'
import { Button } from '@renderer/components/ui/Button'
import { fieldClass } from '@renderer/components/ui/styles'
import { errorMessage } from '@renderer/lib/errors'

export function WrapUpDialog({
  session,
  onDone
}: {
  session: SessionWrapUp
  onDone: () => void
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [busy, onDone])

  async function save(): Promise<void> {
    const clean = note.trim()
    if (clean.length === 0) {
      onDone()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.api.setSessionNote(session.id, clean)
      onDone()
    } catch (reason) {
      setError(errorMessage(reason))
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#17191f]/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDone()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wrap-title"
        className="rise w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card"
      >
        <h2 id="wrap-title" className="text-xl font-semibold tracking-tight">
          What did you work on?
        </h2>
        <p className="mt-2 text-sm text-muted">
          A sentence is enough. This is saved on the {session.spaceName} session.
        </p>
        <textarea
          className={`${fieldClass} mt-4`}
          rows={2}
          maxLength={SESSION_NOTE_MAX}
          autoFocus
          placeholder="Chapter 4, scales, a bug in the parser"
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void save()
            }
          }}
        />
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onDone}>
            Skip
          </Button>
          <Button disabled={busy || note.trim().length === 0} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
