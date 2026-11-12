import { END_OF_DAY_HOUR } from '@shared/settings'
import { localDateKey } from '@shared/time'
import { IpcEvent, type GoalReached } from '@shared/ipc'
import { getDatabase } from './db'
import { notify } from './notify'
import { isQuitting } from './runtime'
import { sendToMain } from './windows'
import { getTimer } from './sessions'
import { currentSettings, getNudgeDate, setNudgeDate } from './settings'

interface GoalSpace {
  id: string
  name: string
  daily_goal_min: number
  status: string
}

interface SessionSlice {
  space_id: string
  started_at: string
  duration_sec: number
  resumed_at: string | null
}

const announced = new Set<string>()

export function startGoalWatch(): void {
  seedReachedGoals()
  setInterval(() => {
    if (isQuitting()) return
    try {
      checkDailyGoals()
    } catch (error) {
      console.error(error)
    }
  }, 15_000)
  const nudge = (): void => {
    if (isQuitting()) return
    try {
      maybeEndOfDayNudge()
    } catch (error) {
      console.error(error)
    }
  }
  setTimeout(() => {
    nudge()
    setInterval(nudge, 60_000)
  }, 45_000)
}

export function checkDailyGoals(now = new Date()): void {
  if (isQuitting()) return
  const today = localDateKey(now)
  const totals = todaySeconds(now)
  const notifyOn = currentSettings().notifications
  for (const space of goalSpaces()) {
    const key = `${space.id}:${today}`
    if (announced.has(key)) continue
    if ((totals.get(space.id) ?? 0) < space.daily_goal_min * 60) continue
    announced.add(key)
    if (!notifyOn) continue
    const payload: GoalReached = { spaceName: space.name }
    notify('Daily goal reached', `${space.name} is at today's goal.`)
    sendToMain(IpcEvent.goalReached, payload)
  }
}

export function maybeEndOfDayNudge(now = new Date()): void {
  if (isQuitting()) return
  const settings = currentSettings()
  if (!settings.notifications || !settings.endOfDayNudge) return
  if (now.getHours() < END_OF_DAY_HOUR) return
  const today = localDateKey(now)
  if (getNudgeDate() === today) return
  if (getTimer()?.running) return
  const unmet = unmetGoals(now)
  if (unmet.length === 0) {
    setNudgeDate(today)
    return
  }
  notify('Today is still open', nudgeBody(unmet), 'low')
  setNudgeDate(today)
}

function seedReachedGoals(now = new Date()): void {
  const today = localDateKey(now)
  const totals = todaySeconds(now)
  for (const space of goalSpaces()) {
    if ((totals.get(space.id) ?? 0) >= space.daily_goal_min * 60) {
      announced.add(`${space.id}:${today}`)
    }
  }
}

function nudgeBody(unmet: { name: string; shortMin: number }[]): string {
  const first = unmet[0]
  if (!first) return 'A goal is still open today.'
  if (unmet.length === 1) {
    const unit = first.shortMin === 1 ? 'minute' : 'minutes'
    return `${first.name} is about ${first.shortMin} ${unit} short of today's goal.`
  }
  return `A few goals are still short of today, including ${first.name}.`
}

function unmetGoals(now: Date): { name: string; shortMin: number }[] {
  const totals = todaySeconds(now)
  const unmet: { name: string; shortMin: number }[] = []
  for (const space of goalSpaces()) {
    if (space.status !== 'active') continue
    const goalSec = space.daily_goal_min * 60
    const sec = totals.get(space.id) ?? 0
    if (sec >= goalSec) continue
    unmet.push({
      name: space.name,
      shortMin: Math.max(1, Math.ceil((goalSec - sec) / 60))
    })
  }
  unmet.sort((a, b) => a.shortMin - b.shortMin)
  return unmet
}

function goalSpaces(): GoalSpace[] {
  return getDatabase()
    .prepare<[], GoalSpace>(
      `SELECT id, name, daily_goal_min, status
       FROM spaces
       WHERE daily_goal_min IS NOT NULL AND status != 'archived'`
    )
    .all()
}

function todaySeconds(now: Date): Map<string, number> {
  const today = localDateKey(now)
  const rows = getDatabase()
    .prepare<[], SessionSlice>(
      'SELECT space_id, started_at, duration_sec, resumed_at FROM sessions'
    )
    .all()
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (localDateKey(new Date(row.started_at)) !== today) continue
    let sec = row.duration_sec
    if (row.resumed_at) {
      sec += Math.max(0, Math.floor((now.getTime() - Date.parse(row.resumed_at)) / 1000))
    }
    totals.set(row.space_id, (totals.get(row.space_id) ?? 0) + sec)
  }
  return totals
}
