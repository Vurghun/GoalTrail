import { IpcEvent } from '@shared/ipc'
import type {
  PomodoroComplete,
  PomodoroPhase,
  PomodoroSnapshot,
  PomodoroStart
} from '@shared/pomodoro'
import { notify } from './notify'
import { isQuitting, timerMutated } from './runtime'
import { pauseTimer } from './sessions'
import { sendToMain } from './windows'

interface PomodoroState {
  phase: PomodoroPhase
  remainingSec: number
  endsAt: number | null
  spaceName: string
  cycle: number
  durationSec: number
}

let state: PomodoroState | null = null
let timer: NodeJS.Timeout | null = null

export function startPomodoro(input: PomodoroStart): PomodoroSnapshot {
  state = {
    phase: input.phase,
    remainingSec: input.durationSec,
    endsAt: input.ticking ? Date.now() + input.durationSec * 1000 : null,
    spaceName: input.spaceName,
    cycle: input.cycle,
    durationSec: input.durationSec
  }
  schedule()
  return snapshot()
}

export function stopPomodoro(): void {
  state = null
  clearSchedule()
}

export function getPomodoro(): PomodoroSnapshot | null {
  if (!state) return null
  return snapshot()
}

export function pausePomodoroIfFocus(): void {
  if (!state || state.phase !== 'focus' || state.endsAt === null) return
  state.remainingSec = secondsLeft(state)
  state.endsAt = null
  clearSchedule()
}

export function resumePomodoroIfFocus(): void {
  if (!state || state.phase !== 'focus' || state.endsAt !== null) return
  if (state.remainingSec <= 0) return
  state.endsAt = Date.now() + state.remainingSec * 1000
  schedule()
}

export function giveBackPomodoroFocus(seconds: number): void {
  if (!state || state.phase !== 'focus' || !Number.isInteger(seconds) || seconds <= 0) return
  const next = secondsLeft(state) + seconds
  state.remainingSec = next
  if (state.endsAt !== null) {
    state.endsAt = Date.now() + next * 1000
    schedule()
  }
}

function schedule(): void {
  clearSchedule()
  if (!state?.endsAt) return
  const delay = Math.max(0, state.endsAt - Date.now())
  timer = setTimeout(() => {
    complete()
  }, delay)
}

function complete(): void {
  if (!state || isQuitting()) return
  if (state.phase !== 'focus' && state.phase !== 'break') return
  const phase = state.phase
  const spaceName = state.spaceName
  state = {
    phase: phase === 'focus' ? 'offer-break' : 'offer-resume',
    remainingSec: 0,
    endsAt: null,
    spaceName,
    cycle: state.cycle,
    durationSec: state.durationSec
  }
  clearSchedule()
  if (phase === 'focus') {
    try {
      pauseTimer()
    } catch {
      // The study timer may already be paused.
    }
  }
  timerMutated()
  if (phase === 'focus') notify('Focus block finished', `${spaceName} can take a break.`)
  else notify('Break is over', `Ready to continue ${spaceName}?`)
  const payload: PomodoroComplete = { phase }
  sendToMain(IpcEvent.pomodoroComplete, payload)
}

function snapshot(): PomodoroSnapshot {
  if (!state) throw new Error('Pomodoro is not running.')
  return {
    phase: state.phase,
    remainingSec: secondsLeft(state),
    endsAt: state.endsAt,
    spaceName: state.spaceName,
    cycle: state.cycle,
    durationSec: state.durationSec
  }
}

function secondsLeft(current: PomodoroState, now = Date.now()): number {
  if (current.endsAt === null) return current.remainingSec
  return Math.max(0, Math.ceil((current.endsAt - now) / 1000))
}

function clearSchedule(): void {
  if (!timer) return
  clearTimeout(timer)
  timer = null
}
