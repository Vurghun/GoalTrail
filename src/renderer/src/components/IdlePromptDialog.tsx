import { useEffect, useState } from 'react'
import type { IdlePrompt } from '@shared/idle'
import { Button } from '@renderer/components/ui/Button'
import { errorMessage } from '@renderer/lib/errors'

export function IdlePromptDialog({
  prompt,
  onDone,
  onRemoved
}: {
  prompt: IdlePrompt
  onDone: () => void
  onRemoved: () => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const minutes = Math.max(1, Math.round(prompt.idleSec / 60))
  const length = minutes === 1 ? '1 minute' : `${minutes} minutes`

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [busy, onDone])

  async function discard(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const session = await window.api.discardIdle(prompt.sessionId, prompt.idleSec)
      if (!session) onRemoved()
      onDone()
    } catch (reason) {
      setError(errorMessage(reason))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-body"
        className="rise w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card"
      >
        <h2 id="idle-title" className="text-xl font-semibold tracking-tight">
          You stepped away
        </h2>
        <p id="idle-body" className="mt-2 text-sm leading-relaxed text-muted">
          The timer paused after {length} away from the computer. Keep that time on{' '}
          {prompt.spaceName}, or leave it out?
        </p>
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void discard()}>
            Leave it out
          </Button>
          <Button disabled={busy} onClick={onDone} autoFocus>
            Keep it
          </Button>
        </div>
      </div>
    </div>
  )
}
