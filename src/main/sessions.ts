import { randomUUID } from 'crypto'
import {
  SESSION_DURATION_MAX_SEC,
  SESSION_NOTE_MAX,
  elapsedSec,
  isoFromLocalDate,
  parseSessionDraft,
  type HistorySession,
  type Session
} from '@shared/time'
import { getDatabase } from './db'

interface SessionRow {
  id: string
  space_id: string
  started_at: string
  ended_at: string | null
  duration_sec: number
  resumed_at: string | null
  note: string
  is_open: number
}

const SESSION_COLUMNS = `
  id, space_id, started_at, ended_at, duration_sec, resumed_at, note, is_open
`

export function listSessions(spaceId: string): Session[] {
  assertSpaceExists(spaceId)
  const rows = getDatabase()
    .prepare<[string], SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM sessions WHERE space_id = ? ORDER BY started_at DESC`
    )
    .all(spaceId)
  return rows.map(mapSession)
}

export function listSessionHistory(spaceId: string | null): HistorySession[] {
  if (spaceId) assertSpaceExists(spaceId)
  const rows = getDatabase()
    .prepare<
      [string | null, string | null],
      SessionRow & { space_name: string; space_icon: string; space_color: string }
    >(
      `SELECT s.id, s.space_id, s.started_at, s.ended_at, s.duration_sec, s.resumed_at, s.note, s.is_open,
              sp.name AS space_name, sp.icon AS space_icon, sp.color AS space_color
       FROM sessions s
       JOIN spaces sp ON sp.id = s.space_id
       WHERE s.is_open = 0 AND (? IS NULL OR s.space_id = ?)
       ORDER BY s.started_at DESC
       LIMIT 300`
    )
    .all(spaceId, spaceId)
  return rows.map((row) => ({
    ...mapSession(row),
    spaceName: row.space_name,
    spaceIcon: row.space_icon,
    spaceColor: row.space_color
  }))
}

export function getTimer(): Session | null {
  const row = findOpen()
  return row ? mapSession(row) : null
}

export function describeTimer(now = Date.now()): {
  session: Session
  spaceName: string
  elapsed: number
} | null {
  const session = getTimer()
  if (!session) return null
  return {
    session,
    spaceName: spaceName(session.spaceId),
    elapsed: elapsedSec(session, now)
  }
}

export function spaceName(spaceId: string): string {
  const row = getDatabase()
    .prepare<[string], { name: string }>('SELECT name FROM spaces WHERE id = ?')
    .get(spaceId)
  return row?.name ?? 'Timer'
}

export function discardIdleTime(
  sessionId: string,
  idleSec: number
): { session: Session | null; removedSec: number } {
  if (!Number.isInteger(idleSec) || idleSec < 1 || idleSec > SESSION_DURATION_MAX_SEC) {
    throw new Error('Idle time is invalid.')
  }
  const existing = findSession(sessionId)
  if (!existing) throw new Error('Time entry was not found.')
  if (existing.is_open === 1 && existing.resumed_at) {
    throw new Error('Pause the timer before changing idle time.')
  }
  const removedSec = Math.min(idleSec, existing.duration_sec)
  const next = existing.duration_sec - removedSec
  if (next === 0 && existing.is_open === 0) {
    getDatabase().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    return { session: null, removedSec }
  }
  getDatabase().prepare('UPDATE sessions SET duration_sec = ? WHERE id = ?').run(next, sessionId)
  return { session: requireSession(sessionId), removedSec }
}

export function setSessionNote(id: string, note: string): Session {
  const clean = note.trim()
  if ([...clean].length > SESSION_NOTE_MAX) {
    throw new Error(`Note must be ${SESSION_NOTE_MAX} characters or fewer.`)
  }
  const existing = findSession(id)
  if (!existing) throw new Error('Time entry was not found.')
  if (existing.is_open === 1) throw new Error('Stop the timer before adding a wrap-up.')
  getDatabase().prepare('UPDATE sessions SET note = ? WHERE id = ? AND is_open = 0').run(clean, id)
  return requireSession(id)
}

export function startTimer(spaceId: string): Session {
  const status = spaceStatus(spaceId)
  if (status === 'archived') throw new Error('Restore this space before timing it.')

  const now = new Date().toISOString()
  const apply = getDatabase().transaction(() => {
    const open = findOpen()
    if (open?.space_id === spaceId) {
      if (!open.resumed_at) {
        getDatabase().prepare('UPDATE sessions SET resumed_at = ? WHERE id = ?').run(now, open.id)
      }
      return requireSession(open.id)
    }

    if (open) finishOpen(open, now)

    const id = randomUUID()
    getDatabase()
      .prepare(
        `INSERT INTO sessions (id, space_id, started_at, ended_at, duration_sec, resumed_at, note, is_open)
         VALUES (?, ?, ?, NULL, 0, ?, '', 1)`
      )
      .run(id, spaceId, now, now)
    return requireSession(id)
  })

  return apply()
}

export function pauseTimer(): Session {
  const open = findOpen()
  if (!open?.resumed_at) throw new Error('No timer is running.')
  const now = new Date().toISOString()
  getDatabase()
    .prepare('UPDATE sessions SET duration_sec = ?, resumed_at = NULL WHERE id = ?')
    .run(foldedDuration(open, now), open.id)
  return requireSession(open.id)
}

export function stopTimer(): Session | null {
  const open = findOpen()
  if (!open) throw new Error('No timer is open.')
  return finishOpen(open, new Date().toISOString())
}

export function finalizeOpenSession(spaceId: string): void {
  const open = findOpen()
  if (open?.space_id !== spaceId) return
  finishOpen(open, new Date().toISOString())
}

/** A crash can leave a timer running. Pause it without counting the time the app was closed. */
export function pauseInterruptedTimer(): void {
  const open = findOpen()
  if (!open?.resumed_at) return
  getDatabase().prepare('UPDATE sessions SET resumed_at = NULL WHERE id = ?').run(open.id)
}

/** Closing the app pauses the timer and keeps the time up to now. */
export function pauseTimerForQuit(): void {
  try {
    const open = findOpen()
    if (!open?.resumed_at) return
    const now = new Date().toISOString()
    getDatabase()
      .prepare('UPDATE sessions SET duration_sec = ?, resumed_at = NULL WHERE id = ?')
      .run(foldedDuration(open, now), open.id)
  } catch {
    // Quitting still closes the database if the timer row cannot be saved.
  }
}

export function createSession(spaceId: string, input: unknown): Session {
  assertSpaceExists(spaceId)
  const draft = parseSessionDraft(input)
  const startedAt = isoFromLocalDate(draft.date)
  const endedAt = new Date(Date.parse(startedAt) + draft.durationSec * 1000).toISOString()
  const id = randomUUID()

  getDatabase()
    .prepare(
      `INSERT INTO sessions (id, space_id, started_at, ended_at, duration_sec, resumed_at, note, is_open)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 0)`
    )
    .run(id, spaceId, startedAt, endedAt, draft.durationSec, draft.note)

  return requireSession(id)
}

export function updateSession(id: string, input: unknown): Session {
  const existing = findSession(id)
  if (!existing) throw new Error('Time entry was not found.')
  if (existing.is_open === 1) throw new Error('Stop the timer before editing this entry.')

  const draft = parseSessionDraft(input)
  const startedAt = isoFromLocalDate(draft.date)
  const endedAt = new Date(Date.parse(startedAt) + draft.durationSec * 1000).toISOString()

  getDatabase()
    .prepare(
      `UPDATE sessions
       SET started_at = ?, ended_at = ?, duration_sec = ?, note = ?
       WHERE id = ? AND is_open = 0`
    )
    .run(startedAt, endedAt, draft.durationSec, draft.note, id)

  return requireSession(id)
}

export function deleteSession(id: string): void {
  const existing = findSession(id)
  if (!existing) throw new Error('Time entry was not found.')
  if (existing.is_open === 1) throw new Error('Stop the timer before deleting this entry.')
  const result = getDatabase().prepare('DELETE FROM sessions WHERE id = ? AND is_open = 0').run(id)
  if (result.changes === 0) throw new Error('Time entry was not found.')
}

function finishOpen(open: SessionRow, now: string): Session | null {
  const duration = foldedDuration(open, now)
  if (duration <= 0) {
    getDatabase().prepare('DELETE FROM sessions WHERE id = ?').run(open.id)
    return null
  }

  getDatabase()
    .prepare(
      `UPDATE sessions
       SET duration_sec = ?, resumed_at = NULL, ended_at = ?, is_open = 0
       WHERE id = ?`
    )
    .run(duration, now, open.id)
  return requireSession(open.id)
}

function foldedDuration(row: SessionRow, now: string): number {
  if (!row.resumed_at) return row.duration_sec
  const extra = Math.floor((Date.parse(now) - Date.parse(row.resumed_at)) / 1000)
  return row.duration_sec + Math.max(0, extra)
}

function findOpen(): SessionRow | undefined {
  return getDatabase()
    .prepare<[], SessionRow>(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE is_open = 1`)
    .get()
}

function findSession(id: string): SessionRow | undefined {
  return getDatabase()
    .prepare<[string], SessionRow>(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ?`)
    .get(id)
}

function requireSession(id: string): Session {
  const row = findSession(id)
  if (!row) throw new Error('Time entry was not found.')
  return mapSession(row)
}

function assertSpaceExists(spaceId: string): void {
  spaceStatus(spaceId)
}

function spaceStatus(spaceId: string): string {
  const row = getDatabase()
    .prepare<[string], { status: string }>('SELECT status FROM spaces WHERE id = ?')
    .get(spaceId)
  if (!row) throw new Error('Space was not found.')
  return row.status
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    spaceId: row.space_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSec: row.duration_sec,
    resumedAt: row.resumed_at,
    note: row.note,
    running: row.is_open === 1 && row.resumed_at !== null
  }
}
