type Listener = () => void

let quitting = false
let trayReady = false
const timerListeners = new Set<Listener>()
const sessionListeners = new Set<Listener>()

export function markQuitting(): void {
  quitting = true
}

export function isQuitting(): boolean {
  return quitting
}

export function setTrayReady(ready: boolean): void {
  trayReady = ready
}

export function isTrayReady(): boolean {
  return trayReady
}

export function onTimerMutated(listener: Listener): void {
  timerListeners.add(listener)
}

export function timerMutated(): void {
  if (quitting) return
  for (const listener of timerListeners) listener()
}

export function onSessionsMutated(listener: Listener): void {
  sessionListeners.add(listener)
}

export function sessionsMutated(): void {
  if (quitting) return
  for (const listener of sessionListeners) listener()
}
