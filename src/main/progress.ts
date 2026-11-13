import { randomUUID } from 'crypto'
import {
  ACTIVITY_LIMIT,
  parseMilestoneDraft,
  type ActivityItem,
  type Milestone,
  type ProgressSource
} from '@shared/progress'
import { formatHoursMinutes, localDateKey } from '@shared/time'
import { getDatabase } from './db'
import { listSessions } from './sessions'

interface MilestoneRow {
  id: string
  space_id: string
  title: string
  done: number
  done_at: string | null
  target_date: string | null
  sort_order: number
}

const MILESTONE_COLUMNS = 'id, space_id, title, done, done_at, target_date, sort_order'

export function listMilestones(spaceId: string): Milestone[] {
  requireSpace(spaceId)
  const rows = getDatabase()
    .prepare<[string], MilestoneRow>(
      `SELECT ${MILESTONE_COLUMNS}
       FROM milestones
       WHERE space_id = ?
       ORDER BY sort_order ASC, rowid ASC`
    )
    .all(spaceId)
  return rows.map(mapMilestone)
}

export function createMilestone(spaceId: string, input: unknown): Milestone {
  requireSpace(spaceId)
  const draft = parseMilestoneDraft(input)
  const db = getDatabase()
  const maxRow = db
    .prepare<[string], { max_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM milestones WHERE space_id = ?'
    )
    .get(spaceId)
  const id = randomUUID()
  db.prepare(
    `INSERT INTO milestones (id, space_id, title, done, done_at, target_date, sort_order)
     VALUES (?, ?, ?, 0, NULL, ?, ?)`
  ).run(id, spaceId, draft.title, draft.targetDate, (maxRow?.max_order ?? -1) + 1)
  return requireMilestone(id)
}

export function updateMilestone(id: string, input: unknown): Milestone {
  requireMilestone(id)
  const draft = parseMilestoneDraft(input)
  getDatabase()
    .prepare('UPDATE milestones SET title = ?, target_date = ? WHERE id = ?')
    .run(draft.title, draft.targetDate, id)
  return requireMilestone(id)
}

export function setMilestoneDone(id: string, done: boolean): Milestone {
  requireMilestone(id)
  if (done) {
    getDatabase()
      .prepare('UPDATE milestones SET done = 1, done_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
  } else {
    getDatabase().prepare('UPDATE milestones SET done = 0, done_at = NULL WHERE id = ?').run(id)
  }
  return requireMilestone(id)
}

export function deleteMilestone(id: string): void {
  const result = getDatabase().prepare('DELETE FROM milestones WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Milestone was not found.')
}

export function reorderMilestones(spaceId: string, ids: string[]): Milestone[] {
  const current = listMilestones(spaceId)
  if (ids.length !== current.length) throw new Error('Reorder must include every milestone.')
  const known = new Set(current.map((milestone) => milestone.id))
  const seen = new Set<string>()
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) throw new Error('Reorder list is invalid.')
    seen.add(id)
  }

  const db = getDatabase()
  const update = db.prepare('UPDATE milestones SET sort_order = ? WHERE id = ?')
  const apply = db.transaction(() => {
    ids.forEach((id, index) => {
      update.run(index, id)
    })
  })
  apply()
  return listMilestones(spaceId)
}

export function getProgress(spaceId: string): ProgressSource {
  const space = requireSpaceRow(spaceId)
  const sessions = listSessions(spaceId)
  const milestones = listMilestones(spaceId)
  const byDay = new Map<string, number>()
  let live: ProgressSource['live'] = null

  for (const session of sessions) {
    const date = localDateKey(new Date(session.startedAt))
    byDay.set(date, (byDay.get(date) ?? 0) + session.durationSec)
    if (session.running && session.resumedAt) {
      live = { startedAt: session.startedAt, resumedAt: session.resumedAt }
    }
  }

  return {
    targetHours: space.target_hours,
    targetDate: space.target_date,
    dailyGoalMin: space.daily_goal_min,
    weeklyGoalMin: space.weekly_goal_min,
    milestones,
    daySeconds: [...byDay.entries()].map(([date, sec]) => ({ date, sec })),
    live,
    activity: listActivity(spaceId, sessions, milestones)
  }
}

function listActivity(
  spaceId: string,
  sessions: ReturnType<typeof listSessions>,
  milestones: Milestone[]
): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const session of sessions) {
    const open = session.endedAt === null
    items.push({
      id: `session:${session.id}`,
      kind: 'session',
      at: session.startedAt,
      title: open ? 'Timer running' : 'Tracked time',
      detail: session.note || (open ? '' : formatHoursMinutes(session.durationSec))
    })
  }
  for (const milestone of milestones) {
    if (!milestone.doneAt) continue
    items.push({
      id: `milestone:${milestone.id}`,
      kind: 'milestone',
      at: milestone.doneAt,
      title: `Completed ${milestone.title}`,
      detail: ''
    })
  }

  const notes = getDatabase()
    .prepare<[string, number], { id: string; title: string; created_at: string }>(
      `SELECT id, title, created_at FROM notes
       WHERE space_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(spaceId, ACTIVITY_LIMIT)
  for (const note of notes) {
    items.push({
      id: `note:${note.id}`,
      kind: 'note',
      at: note.created_at,
      title: note.title.trim() || 'Untitled note',
      detail: ''
    })
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LIMIT)
}

function requireSpace(spaceId: string): void {
  const row = getDatabase()
    .prepare<[string], { id: string }>('SELECT id FROM spaces WHERE id = ?')
    .get(spaceId)
  if (!row) throw new Error('Space was not found.')
}

function requireSpaceRow(spaceId: string): {
  target_hours: number | null
  target_date: string | null
  daily_goal_min: number | null
  weekly_goal_min: number | null
} {
  const row = getDatabase()
    .prepare<
      [string],
      {
        target_hours: number | null
        target_date: string | null
        daily_goal_min: number | null
        weekly_goal_min: number | null
      }
    >(
      `SELECT target_hours, target_date, daily_goal_min, weekly_goal_min
       FROM spaces WHERE id = ?`
    )
    .get(spaceId)
  if (!row) throw new Error('Space was not found.')
  return row
}

function requireMilestone(id: string): Milestone {
  const row = getDatabase()
    .prepare<[string], MilestoneRow>(`SELECT ${MILESTONE_COLUMNS} FROM milestones WHERE id = ?`)
    .get(id)
  if (!row) throw new Error('Milestone was not found.')
  return mapMilestone(row)
}

function mapMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    done: row.done === 1,
    doneAt: row.done_at,
    targetDate: row.target_date,
    sortOrder: row.sort_order
  }
}
