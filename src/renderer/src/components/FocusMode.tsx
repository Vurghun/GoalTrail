import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import type { Space } from '@shared/spaces'
import { formatClock } from '@shared/time'
import { Button } from '@renderer/components/ui/Button'
import { fieldClass } from '@renderer/components/ui/styles'
import { pushToast } from '@renderer/lib/toast'
import type { useTimer } from '@renderer/hooks/useTimer'

type TimerApi = ReturnType<typeof useTimer>

export function FocusMode({
  space,
  timer,
  focusMin,
  breakMin,
  onClose
}: {
  space: Space | undefined
  timer: TimerApi
  focusMin: number
  breakMin: number
  onClose: () => void
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [pomodoro, setPomodoro] = useState(false)
  const [phase, setPhase] = useState<'focus' | 'break' | 'offer-break' | 'offer-resume'>('focus')
  const [remaining, setRemaining] = useState(focusMin * 60)
  const [saving, setSaving] = useState(false)
  const finishing = useRef(false)
  const running = timer.session?.running ?? false
  const phaseTotal = (phase === 'break' || phase === 'offer-resume' ? breakMin : focusMin) * 60
  const ratio = pomodoro ? Math.min(1, (phaseTotal - remaining) / Math.max(1, phaseTotal)) : 0
  const color = space?.color ?? 'var(--accent)'

  useEffect(() => {
    if (!pomodoro || phase === 'offer-break' || phase === 'offer-resume') return
    if (phase === 'focus' && !running) return
    const refresh = timer.refresh
    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value > 1) return value - 1
        if (finishing.current) return 0
        finishing.current = true
        window.setTimeout(() => {
          if (phase === 'focus') {
            void window.api.pauseTimer().then(() => refresh()).then(() => {
              pushToast('Focus block finished')
            }).catch(() => {
              pushToast('Could not pause the timer')
            })
            setPhase('offer-break')
          } else {
            pushToast('Break is over')
            setPhase('offer-resume')
          }
          setRemaining(0)
          finishing.current = false
        }, 0)
        return 0
      })
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [pomodoro, phase, running, timer.refresh])

  async function saveNote(): Promise<void> {
    if (!space || note.trim().length === 0) return
    setSaving(true)
    try {
      const created = await window.api.createNote(space.id)
      const title = note.trim().slice(0, 80)
      const content = `<p>${escapeHtml(note.trim())}</p>`
      await window.api.updateNote(created.id, { title, content, tags: [] })
      setNote('')
      pushToast('Note saved')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="focus-ambient fixed inset-0 z-40 flex flex-col items-center justify-center px-6 text-center"
      style={{ ['--timer' as string]: color }}
    >
      <p className="text-sm font-medium text-muted">{space?.name ?? 'Focus'}</p>
      <p className="timer-glow mt-4 text-7xl font-semibold tracking-tight tabular-nums sm:text-8xl">
        {formatClock(timer.elapsed)}
      </p>
      {pomodoro ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-sm text-muted">
          <div className="flex items-center gap-3">
            <Ring ratio={ratio} color={color} />
            <span className="tabular-nums">
              {phase === 'break' || phase === 'offer-resume' ? 'Break' : 'Focus'} · {formatClock(remaining)}
            </span>
          </div>
          {phase === 'offer-break' ? (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  finishing.current = false
                  setPhase('break')
                  setRemaining(breakMin * 60)
                }}
              >
                Start {breakMin}m break
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  finishing.current = false
                  setPhase('focus')
                  setRemaining(focusMin * 60)
                  if (timer.session && !timer.session.running) void timer.start(timer.session.spaceId)
                }}
              >
                Keep studying
              </Button>
            </div>
          ) : null}
          {phase === 'offer-resume' ? (
            <Button
              onClick={() => {
                finishing.current = false
                setPhase('focus')
                setRemaining(focusMin * 60)
                if (timer.session) void timer.start(timer.session.spaceId)
              }}
            >
              Resume session
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-8 flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            if (!timer.session) return
            if (running) void timer.pause()
            else void timer.start(timer.session.spaceId)
          }}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? 'Pause' : 'Resume'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void timer.stop().then(() => {
              onClose()
            })
          }}
        >
          <Square size={14} />
          Stop
        </Button>
      </div>
      <label className="mt-10 w-full max-w-md text-left text-sm">
        <span className="mb-1.5 block font-medium">Quick note</span>
        <textarea
          className={fieldClass}
          rows={3}
          value={note}
          placeholder="Capture a thought without leaving the timer"
          onChange={(event) => {
            setNote(event.target.value)
          }}
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={saving || note.trim().length === 0} onClick={() => void saveNote()}>
          Save note
        </Button>
        <button
          type="button"
          className="text-sm text-muted"
          aria-pressed={pomodoro}
          onClick={() => {
            setPomodoro((value) => {
              const next = !value
              if (next) {
                finishing.current = false
                setPhase('focus')
                setRemaining(focusMin * 60)
              }
              return next
            })
          }}
        >
          {pomodoro ? 'Hide Pomodoro' : 'Show Pomodoro'}
        </button>
        <button type="button" className="text-sm text-muted" onClick={onClose}>
          Leave focus
        </button>
      </div>
    </div>
  )
}

function Ring({ ratio, color }: { ratio: number; color: string }): React.JSX.Element {
  const radius = 14
  const circumference = 2 * Math.PI * radius
  return (
    <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
      />
    </svg>
  )
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
