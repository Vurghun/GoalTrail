import { elapsedSec } from '@shared/time'
import { assembleWeeklyReview, type WeeklyReview } from '@shared/review'
import { getDatabase } from './db'
import { currentSettings } from './settings'

interface SessionRow {
  space_id: string
  started_at: string
  duration_sec: number
  resumed_at: string | null
  is_open: number
}

export function getWeeklyReview(now = Date.now()): WeeklyReview {
  const db = getDatabase()
  const sessions = db
    .prepare<[], SessionRow>(
      `SELECT space_id, started_at, duration_sec, resumed_at, is_open FROM sessions`
    )
    .all()
    .map((row) => ({
      spaceId: row.space_id,
      startedAt: row.started_at,
      durationSec:
        row.is_open === 1 && row.resumed_at
          ? elapsedSec({ durationSec: row.duration_sec, resumedAt: row.resumed_at }, now)
          : row.duration_sec
    }))
  const spaces = db
    .prepare<[], { id: string; name: string; icon: string; color: string }>(
      'SELECT id, name, icon, color FROM spaces'
    )
    .all()
  const milestones = db
    .prepare<
      [],
      { id: string; space_id: string; space_name: string; title: string; done_at: string | null }
    >(
      `SELECT m.id, m.space_id, sp.name AS space_name, m.title, m.done_at
       FROM milestones m
       JOIN spaces sp ON sp.id = m.space_id
       WHERE m.done = 1`
    )
    .all()
    .map((row) => ({
      id: row.id,
      spaceId: row.space_id,
      spaceName: row.space_name,
      title: row.title,
      doneAt: row.done_at
    }))

  return assembleWeeklyReview(sessions, spaces, milestones, now, currentSettings().weekStartsOn)
}
