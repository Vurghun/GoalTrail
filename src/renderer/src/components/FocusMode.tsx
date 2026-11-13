import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import type { Space } from '@shared/spaces'
import { formatClock } from '@shared/time'
import { Button } from '@renderer/components/ui/Button'
import { fieldClass } from '@renderer/components/ui/styles'
import { pushToast } from '@renderer/lib/toast'
import type { useTimer } from '@renderer/hooks/useTimer'

type TimerApi = ReturnType<typeof useTimer>
type Phase = 'focus' | 'break' | 'offer-break' | 'offer-resume'

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
  const [phase, setPhase] = useState<Phase>('focus')
  const [remaining, setRemaining] = useState(focusMin * 60)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const alive = useRef(true)
  const phaseRef = useRef<Phase>('focus')
  const running = timer.session?.running ?? false
  const refresh = timer.refresh
  const phaseTotal = (phase === 'break' || phase === 'offer-resume' ? breakMin : focusMin) * 60
  const ratio = pomodoro ? Math.min(1, (phaseTotal - remaining) / Math.max(1, phaseTotal)) : 0
  const color = space?.color ?? 'var(--accent)'
  const spaceName = space?.name ?? 'Focus'

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      void window.api.stopPomodoro()
    }
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    if (!pomodoro || endsAt === null || remaining > 0) return
    if (phase !== 'focus' && phase !== 'break') return
    const id = window.setTimeout(() => {
      void window.api.getPomodoro().then((snap) => {
        if (!alive.current || snap) return
        setPhase(phase === 'focus' ? 'offer-break' : 'offer-resume')
        void refresh()
      })
    }, 800)
    return () => {
      window.clearTimeout(id)
    }
  }, [pomodoro, phase, endsAt, remaining, refresh])

  useEffect(() => {
    if (endsAt === null) return
    const tick = (): void => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => {
      window.clearInterval(id)
    }
  }, [endsAt])

  useEffect(() => {
    return window.api.onPomodoroComplete((event) => {
      if (!alive.current) return
      setEndsAt(null)
      setRemaining(0)
      void refresh()
      if (event.phase === 'focus') {
        setPhase('offer-break')
        if (!document.hidden) pushToast('Focus block finished')
      } else {
        setPhase('offer-resume')
        if (!document.hidden) pushToast('Break is over')
      }
    })
  }, [refresh])

  useEffect(() => {
    if (!pomodoro) return
    const sync = (): void => {
      if (phaseRef.current !== 'focus' && phaseRef.current !== 'break') return
      void window.api.getPomodoro().then((snap) => {
        if (!alive.current) return
        if (!snap) return
        if (phaseRef.current !== snap.phase) return
        setRemaining(snap.remainingSec)
        setEndsAt(snap.endsAt)
      })
    }
    const offTimer = window.api.onTimerChanged(sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      offTimer()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [pomodoro])

  function arm(nextPhase: 'focus' | 'break', seconds: number, ticking: boolean): void {
    void window.api
      .startPomodoro({
        phase: nextPhase,
        durationSec: seconds,
        spaceName,
        ticking
      })
      .then((snap) => {
        if (!alive.current) return
        setRemaining(snap.remainingSec)
        setEndsAt(snap.endsAt)
      })
      .catch(() => {
        if (alive.current) pushToast('Could not start the Pomodoro')
      })
  }

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
                  setPhase('break')
                  arm('break', breakMin * 60, true)
                }}
              >
                Start {breakMin}m break
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPhase('focus')
                  if (timer.session && !timer.session.running) void timer.start(timer.session.spaceId)
                  arm('focus', focusMin * 60, true)
                }}
              >
                Keep studying
              </Button>
            </div>
          ) : null}
          {phase === 'offer-resume' ? (
            <Button
              onClick={() => {
                setPhase('focus')
                if (timer.session) void timer.start(timer.session.spaceId)
                arm('focus', focusMin * 60, true)
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
            if (pomodoro) {
              setPomodoro(false)
              setPhase('focus')
              setEndsAt(null)
              setRemaining(focusMin * 60)
              void window.api.stopPomodoro()
              return
            }
            setPomodoro(true)
            setPhase('focus')
            arm('focus', focusMin * 60, running)
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
