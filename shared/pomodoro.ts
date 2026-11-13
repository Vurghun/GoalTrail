export const POMODORO_CYCLE_MAX = 99

export type PomodoroPhase = 'focus' | 'break' | 'offer-break' | 'offer-resume'

export interface PomodoroSnapshot {
  phase: PomodoroPhase
  remainingSec: number
  endsAt: number | null
  spaceName: string
  cycle: number
  durationSec: number
}

export interface PomodoroStart {
  phase: 'focus' | 'break'
  durationSec: number
  spaceName: string
  ticking: boolean
  cycle: number
}

export interface PomodoroComplete {
  phase: 'focus' | 'break'
}

export function parsePomodoroStart(input: unknown): PomodoroStart {
  if (!isRecord(input)) throw new Error('Pomodoro is invalid.')
  if (input.phase !== 'focus' && input.phase !== 'break') {
    throw new Error('Pomodoro phase is invalid.')
  }
  if (
    typeof input.durationSec !== 'number' ||
    !Number.isInteger(input.durationSec) ||
    input.durationSec < 1 ||
    input.durationSec > 120 * 60
  ) {
    throw new Error('Pomodoro length is invalid.')
  }
  if (typeof input.spaceName !== 'string') throw new Error('Pomodoro space is invalid.')
  const spaceName = input.spaceName.trim()
  if (spaceName.length === 0 || [...spaceName].length > 80) {
    throw new Error('Pomodoro space is invalid.')
  }
  if (typeof input.ticking !== 'boolean') throw new Error('Pomodoro state is invalid.')
  if (
    typeof input.cycle !== 'number' ||
    !Number.isInteger(input.cycle) ||
    input.cycle < 1 ||
    input.cycle > POMODORO_CYCLE_MAX
  ) {
    throw new Error('Pomodoro cycle is invalid.')
  }
  return {
    phase: input.phase,
    durationSec: input.durationSec,
    spaceName,
    ticking: input.ticking,
    cycle: input.cycle
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
