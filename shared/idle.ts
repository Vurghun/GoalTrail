export const IDLE_RETURN_SEC = 2

export interface IdlePrompt {
  sessionId: string
  idleSec: number
  spaceName: string
}

export type IdleAction = 'none' | 'pause' | 'wait' | 'deliver'

export function nextIdleAction(input: {
  timerRunning: boolean
  idleSec: number
  thresholdMin: number | null
  pending: boolean
}): IdleAction {
  if (input.pending) return input.idleSec <= IDLE_RETURN_SEC ? 'deliver' : 'wait'
  if (!input.timerRunning || input.thresholdMin === null) return 'none'
  if (input.idleSec >= input.thresholdMin * 60) return 'pause'
  return 'none'
}
