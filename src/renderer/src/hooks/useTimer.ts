import { useCallback, useEffect, useState } from 'react'
import { elapsedSec, type Session } from '@shared/time'
import { errorMessage } from '@renderer/lib/errors'

export function useTimer(): {
  session: Session | null
  now: number
  error: string | null
  elapsed: number
  refresh: () => Promise<void>
  start: (spaceId: string) => Promise<boolean>
  pause: () => Promise<boolean>
  stop: () => Promise<boolean>
} {
  const [session, setSession] = useState<Session | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await window.api.getTimer()
    setSession(next)
    setNow(Date.now())
  }, [])

  useEffect(() => {
    let active = true
    void window.api
      .getTimer()
      .then((next) => {
        if (!active) return
        setSession(next)
        setNow(Date.now())
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!session?.running) return
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [session?.running])

  async function run(action: () => Promise<Session | null>): Promise<boolean> {
    try {
      const next = await action()
      setSession(next)
      setNow(Date.now())
      setError(null)
      return true
    } catch (actionError: unknown) {
      setError(errorMessage(actionError))
      return false
    }
  }

  return {
    session,
    now,
    error,
    elapsed: session ? elapsedSec(session, now) : 0,
    refresh,
    start: (spaceId) => run(() => window.api.startTimer(spaceId)),
    pause: () => run(() => window.api.pauseTimer()),
    stop: () => run(() => window.api.stopTimer())
  }
}
