import { useEffect, useState } from 'react'
import { Square, X } from 'lucide-react'
import type { Session } from '@shared/time'
import { elapsedSec, formatClock } from '@shared/time'
import type { Space } from '@shared/spaces'

export function MiniTimer(): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [space, setSpace] = useState<Space | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    const load = (): void => {
      void window.api.getTimer().then((next) => {
        if (!active) return
        setSession(next)
        if (!next) {
          setSpace(null)
          return
        }
        void window.api.listSpaces().then((spaces) => {
          if (active) setSpace(spaces.find((item) => item.id === next.spaceId) ?? null)
        })
      })
    }
    load()
    const poll = window.setInterval(load, 1000)
    const tick = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      active = false
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [])

  const elapsed = session ? elapsedSec(session, now) : 0

  return (
    <div className="flex h-screen items-center gap-3 bg-surface px-3 text-text">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: space?.color ?? 'var(--accent)' }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">{space?.name ?? 'No timer'}</p>
        <p className="text-lg font-semibold tabular-nums">{formatClock(elapsed)}</p>
      </div>
      <button
        type="button"
        className="rounded-md p-2 text-muted hover:bg-accent-soft hover:text-text"
        aria-label="Stop timer"
        onClick={() => {
          void window.api.stopTimer().then(() => window.api.closeMiniTimer())
        }}
      >
        <Square size={14} />
      </button>
      <button
        type="button"
        className="rounded-md p-2 text-muted hover:bg-accent-soft hover:text-text"
        aria-label="Close mini timer"
        onClick={() => {
          void window.api.closeMiniTimer()
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
