import { RECENT_NOTE_LIMIT, type DashboardSource, type DashboardSpace } from '@shared/dashboard'
import { isSpaceStatus } from '@shared/spaces'
import { localDateKey } from '@shared/time'
import { getDatabase } from './db'

interface SpaceRow {
  id: string
  name: string
  color: string
  icon: string
  status: string
  target_hours: number | null
  sort_order: number
}

interface SessionRow {
  space_id: string
  started_at: string
  duration_sec: number
  resumed_at: string | null
  is_open: number
}

export function getDashboard(): DashboardSource {
  const db = getDatabase()
  const spaces = db
    .prepare<[], SpaceRow>(
      `SELECT id, name, color, icon, status, target_hours, sort_order
       FROM spaces
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all()
  const counts = new Map<string, { done: number; total: number }>()
  const countRows = db
    .prepare<[], { space_id: string; done_count: number; total_count: number }>(
      `SELECT space_id,
              SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done_count,
              COUNT(*) AS total_count
       FROM milestones
       GROUP BY space_id`
    )
    .all()
  for (const row of countRows) {
    counts.set(row.space_id, { done: row.done_count, total: row.total_count })
  }

  const logged = new Map<string, number>()
  const byDay = new Map<string, number>()
  const bySpaceDay = new Map<string, number>()
  let live: DashboardSource['live'] = null
  const sessions = db
    .prepare<[], SessionRow>(
      `SELECT space_id, started_at, duration_sec, resumed_at, is_open FROM sessions`
    )
    .all()
  for (const session of sessions) {
    logged.set(session.space_id, (logged.get(session.space_id) ?? 0) + session.duration_sec)
    const date = localDateKey(new Date(session.started_at))
    byDay.set(date, (byDay.get(date) ?? 0) + session.duration_sec)
    const spaceKey = `${date}\t${session.space_id}`
    bySpaceDay.set(spaceKey, (bySpaceDay.get(spaceKey) ?? 0) + session.duration_sec)
    if (session.is_open === 1 && session.resumed_at) {
      live = {
        spaceId: session.space_id,
        startedAt: session.started_at,
        resumedAt: session.resumed_at
      }
    }
  }

  const notes = db
    .prepare<
      [],
      { id: string; space_id: string; space_name: string; title: string; updated_at: string }
    >(
      `SELECT n.id AS id, n.space_id AS space_id, s.name AS space_name, n.title AS title,
              n.updated_at AS updated_at
       FROM notes n
       JOIN spaces s ON s.id = n.space_id
       ORDER BY n.updated_at DESC
       LIMIT ${RECENT_NOTE_LIMIT}`
    )
    .all()

  return {
    daySeconds: [...byDay.entries()].map(([date, sec]) => ({ date, sec })),
    spaceDays: [...bySpaceDay.entries()].map(([key, sec]) => {
      const [date, spaceId] = key.split('\t')
      return { date: date ?? '', spaceId: spaceId ?? '', sec }
    }),
    spaces: spaces.map((space) => toSpace(space, logged, counts)),
    live,
    recentNotes: notes.map((note) => ({
      id: note.id,
      spaceId: note.space_id,
      spaceName: note.space_name,
      title: note.title.trim() || 'Untitled',
      updatedAt: note.updated_at
    }))
  }
}

function toSpace(
  row: SpaceRow,
  logged: Map<string, number>,
  counts: Map<string, { done: number; total: number }>
): DashboardSpace {
  if (!isSpaceStatus(row.status)) throw new Error('A saved space has an invalid status.')
  const count = counts.get(row.id)
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    status: row.status,
    loggedSec: logged.get(row.id) ?? 0,
    targetHours: row.target_hours,
    milestoneDone: count?.done ?? 0,
    milestoneTotal: count?.total ?? 0
  }
}
