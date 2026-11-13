import type { Session } from '@shared/time'
import type { SessionWrapUp } from '@shared/ipc'
import { IpcEvent } from '@shared/ipc'
import { takeIdlePrompt } from './idle'
import { pausePomodoroIfFocus, resumePomodoroIfFocus, stopPomodoro } from './pomodoro'
import { timerMutated } from './runtime'
import { pauseTimer, spaceName, startTimer, stopTimer } from './sessions'
import { sendToMain, showMainWindow } from './windows'

export function userStartTimer(spaceId: string): Session {
  const session = startTimer(spaceId)
  resumePomodoroIfFocus()
  timerMutated()
  return session
}

export function userPauseTimer(): Session {
  const session = pauseTimer()
  pausePomodoroIfFocus()
  timerMutated()
  return session
}

export function userStopTimer(): Session | null {
  const idle = takeIdlePrompt()
  stopPomodoro()
  const session = stopTimer()
  timerMutated()
  const wrap: SessionWrapUp | null =
    session && session.note.trim() === ''
      ? {
          id: session.id,
          spaceId: session.spaceId,
          spaceName: spaceName(session.spaceId),
          durationSec: session.durationSec
        }
      : null
  if (idle || wrap) showMainWindow()
  if (idle) sendToMain(IpcEvent.idlePrompt, idle)
  if (wrap) sendToMain(IpcEvent.sessionWrapUp, wrap)
  return session
}
