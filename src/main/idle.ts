import { powerMonitor } from 'electron'
import { nextIdleAction, type IdlePrompt } from '@shared/idle'
import { IpcEvent } from '@shared/ipc'
import { notify } from './notify'
import { pausePomodoroIfFocus } from './pomodoro'
import { isQuitting, timerMutated } from './runtime'
import { describeTimer, pauseTimer } from './sessions'
import { currentSettings } from './settings'
import { sendToMain, showMainWindow } from './windows'

const RETURN_GRACE_MS = 15_000
const MIN_PROMPT_SEC = 30

let pending: IdlePrompt | null = null
let quietUntil = 0
let idleErrorLogged = false

export function startIdleWatch(): void {
  powerMonitor.on('lock-screen', () => {
    pauseForAbsence('lock')
  })
  powerMonitor.on('suspend', () => {
    pauseForAbsence('lock')
  })
  powerMonitor.on('unlock-screen', () => {
    deliverPendingIdle()
  })
  powerMonitor.on('resume', () => {
    deliverPendingIdle()
  })
  setInterval(() => {
    if (isQuitting()) return
    try {
      watchIdle()
    } catch (error) {
      console.error(error)
    }
  }, 5_000)
}

export function takeIdlePrompt(): IdlePrompt | null {
  const prompt = pending
  pending = null
  if (prompt) quietUntil = Date.now() + RETURN_GRACE_MS
  return prompt
}

function watchIdle(): void {
  const idleSec = readIdleSec()
  if (pending) {
    const action = nextIdleAction({
      timerRunning: false,
      idleSec,
      thresholdMin: null,
      pending: true
    })
    if (action === 'deliver') deliverPendingIdle()
    return
  }
  if (Date.now() < quietUntil) return
  const described = describeTimer()
  const action = nextIdleAction({
    timerRunning: described?.session.running ?? false,
    idleSec,
    thresholdMin: currentSettings().idlePauseMin,
    pending: false
  })
  if (action === 'pause') pauseForAbsence('idle')
}

function pauseForAbsence(reason: 'idle' | 'lock'): void {
  if (pending || isQuitting()) return
  const described = describeTimer()
  if (!described?.session.running || !described.session.resumedAt) return
  const segmentSec = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(described.session.resumedAt)) / 1000)
  )
  const stretch = Math.min(readIdleSec(), segmentSec)
  try {
    pauseTimer()
    pausePomodoroIfFocus()
    timerMutated()
  } catch (error) {
    console.error(error)
    return
  }
  const ask =
    currentSettings().idlePauseMin !== null &&
    stretch >= (reason === 'idle' ? MIN_PROMPT_SEC : Math.max(MIN_PROMPT_SEC, 60))
  if (ask) {
    pending = {
      sessionId: described.session.id,
      idleSec: stretch,
      spaceName: described.spaceName
    }
  }
  if (reason === 'idle') {
    notify('Timer paused', 'You stepped away, so the session is paused.')
  } else {
    notify('Timer paused', 'The screen locked, so the session is paused.')
  }
}

function deliverPendingIdle(): void {
  if (isQuitting() || !pending) return
  const prompt = pending
  pending = null
  quietUntil = Date.now() + RETURN_GRACE_MS
  showMainWindow()
  sendToMain(IpcEvent.idlePrompt, prompt)
}

function readIdleSec(): number {
  // Test hook: a whole number of seconds stands in for the operating system idle time.
  const override = process.env['GOALTRAIL_IDLE_SEC']
  if (override && /^\d+$/.test(override)) return Number(override)
  try {
    return powerMonitor.getSystemIdleTime()
  } catch (error) {
    if (!idleErrorLogged) {
      idleErrorLogged = true
      console.error(error)
    }
    return 0
  }
}
