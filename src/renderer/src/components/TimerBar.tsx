import { Square } from 'lucide-react'
import type { Space } from '@shared/spaces'
import { formatClock, type Session } from '@shared/time'
import { IconTile } from '@renderer/components/ui/IconTile'

interface TimerBarProps {
  session: Session
  space: Space | undefined
  elapsed: number
  onSelect: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function TimerBar({
  session,
  space,
  elapsed,
  onSelect,
  onPause,
  onResume,
  onStop
}: TimerBarProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-1 pl-1.5">
      <button
        type="button"
        className="flex min-w-0 items-center gap-2 text-left"
        onClick={onSelect}
      >
        <IconTile icon={space?.icon ?? 'target'} color={space?.color ?? 'var(--text)'} size="sm" />
        <span className="max-w-28 truncate text-sm font-medium">{space?.name ?? 'Timer'}</span>
        {session.running ? <span className="timer-dot" aria-hidden /> : null}
        <span className="text-sm font-semibold tabular-nums">{formatClock(elapsed)}</span>
      </button>
      {session.running ? (
        <button type="button" className={buttonClass} onClick={onPause}>
          Pause
        </button>
      ) : (
        <button type="button" className={buttonClass} onClick={onResume}>
          Resume
        </button>
      )}
      <button type="button" aria-label="Stop timer" className={buttonClass} onClick={onStop}>
        <Square size={12} fill="currentColor" />
      </button>
    </div>
  )
}

const buttonClass =
  'rounded-full px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-accent-soft hover:text-text'
