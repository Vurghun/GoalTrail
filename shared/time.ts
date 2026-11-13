export const SESSION_NOTE_MAX = 500
export const SESSION_DURATION_MAX_SEC = 24 * 60 * 60

/** Monday. Settings can replace this later. */
export const WEEK_STARTS_ON = 1

export interface Session {
  id: string
  spaceId: string
  startedAt: string
  endedAt: string | null
  durationSec: number
  resumedAt: string | null
  note: string
  running: boolean
}

export interface SessionDraft {
  date: string
  durationSec: number
  note: string
}

export interface TimeTotals {
  todaySec: number
  weekSec: number
  monthSec: number
  totalSec: number
}

export function elapsedSec(
  session: Pick<Session, 'durationSec' | 'resumedAt'>,
  now = Date.now()
): number {
  if (!session.resumedAt) return session.durationSec
  const extra = Math.floor((now - Date.parse(session.resumedAt)) / 1000)
  return session.durationSec + Math.max(0, extra)
}

export function isOpenSession(session: Pick<Session, 'endedAt'>): boolean {
  return session.endedAt === null
}

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export function formatHoursMinutes(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function summarizeSessions(
  sessions: Session[],
  now = Date.now(),
  weekStartsOn = WEEK_STARTS_ON
): TimeTotals {
  const today = localDateKey(new Date(now))
  const weekStart = startOfWeek(new Date(now), weekStartsOn)
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1)
  const totals: TimeTotals = { todaySec: 0, weekSec: 0, monthSec: 0, totalSec: 0 }

  for (const session of sessions) {
    const sec = elapsedSec(session, now)
    totals.totalSec += sec
    const when = new Date(session.startedAt)
    if (localDateKey(when) === today) totals.todaySec += sec
    if (when >= weekStart) totals.weekSec += sec
    if (when >= monthStart) totals.monthSec += sec
  }

  return totals
}

export function parseSessionDraft(input: unknown): SessionDraft {
  if (!isRecord(input)) throw new Error('Time entry is invalid.')

  if (typeof input.date !== 'string' || !isRealIsoDate(input.date)) {
    throw new Error('Choose a real date.')
  }

  if (typeof input.durationSec !== 'number' || !Number.isInteger(input.durationSec)) {
    throw new Error('Duration must be a whole number of seconds.')
  }
  if (input.durationSec <= 0) throw new Error('Enter a duration.')
  if (input.durationSec > SESSION_DURATION_MAX_SEC) {
    throw new Error('A manual entry cannot be longer than 24 hours.')
  }

  if (typeof input.note !== 'string') throw new Error('Note is invalid.')
  const note = input.note.trim()
  if ([...note].length > SESSION_NOTE_MAX) {
    throw new Error(`Note must be ${SESSION_NOTE_MAX} characters or fewer.`)
  }

  return { date: input.date, durationSec: input.durationSec, note }
}

export function isoFromLocalDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Choose a real date.')
  }
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString()
}

export function startOfWeek(date: Date, weekStartsOn: number): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay()
  const daysSinceWeekStart = (day - weekStartsOn + 7) % 7
  start.setDate(start.getDate() - daysSinceWeekStart)
  return start
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}
