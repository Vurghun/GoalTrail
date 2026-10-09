import { randomUUID } from 'crypto'
import { parseSpaceGoals } from '@shared/progress'
import { isSpaceStatus, parseSpaceDraft, type Space, type SpaceStatus } from '@shared/spaces'
import { getDatabase } from './db'
import { deleteNoteImageFile } from './note-images'
import { clearSpaceNoteSearch, listSpaceNoteFiles } from './notes'
import { finalizeOpenSession } from './sessions'
import { currentSettings } from './settings'

interface SpaceRow {
  id: string
  name: string
  description: string
  color: string
  icon: string
  status: string
  target_hours: number | null
  target_date: string | null
  daily_goal_min: number | null
  weekly_goal_min: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

interface SpaceWrite {
  id: string
  name: string
  description: string
  color: string
  icon: string
  status: SpaceStatus
  target_hours: number | null
  target_date: string | null
  daily_goal_min: number | null
  weekly_goal_min: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

const SPACE_COLUMNS = `
  id, name, description, color, icon, status, target_hours, target_date,
  daily_goal_min, weekly_goal_min, sort_order, created_at, updated_at
`

export function listSpaces(): Space[] {
  const rows = getDatabase()
    .prepare<[], SpaceRow>(
      `SELECT ${SPACE_COLUMNS} FROM spaces ORDER BY sort_order ASC, created_at ASC`
    )
    .all()
  return rows.map(mapSpace)
}

export function createSpace(input: unknown): Space {
  const draft = parseSpaceDraft(input)
  const db = getDatabase()
  const maxRow = db
    .prepare<[], { max_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM spaces'
    )
    .get()
  const now = new Date().toISOString()
  const id = randomUUID()

  db.prepare<SpaceWrite>(
    `INSERT INTO spaces (${SPACE_COLUMNS})
     VALUES (
       @id, @name, @description, @color, @icon, @status, @target_hours, @target_date,
       @daily_goal_min, @weekly_goal_min, @sort_order, @created_at, @updated_at
     )`
  ).run({
    id,
    name: draft.name,
    description: draft.description,
    color: draft.color,
    icon: draft.icon,
    status: draft.status,
    target_hours: draft.targetHours,
    target_date: draft.targetDate,
    daily_goal_min: currentSettings().dailyGoalMin,
    weekly_goal_min: null,
    sort_order: (maxRow?.max_order ?? -1) + 1,
    created_at: now,
    updated_at: now
  })

  return requireSpace(id)
}

export function updateSpace(id: string, input: unknown): Space {
  requireSpace(id)
  const draft = parseSpaceDraft(input)
  const now = new Date().toISOString()

  getDatabase()
    .prepare(
      `UPDATE spaces
       SET name = @name,
           description = @description,
           color = @color,
           icon = @icon,
           status = @status,
           target_hours = @target_hours,
           target_date = @target_date,
           updated_at = @updated_at
       WHERE id = @id`
    )
    .run({
      id,
      name: draft.name,
      description: draft.description,
      color: draft.color,
      icon: draft.icon,
      status: draft.status,
      target_hours: draft.targetHours,
      target_date: draft.targetDate,
      updated_at: now
    })

  if (draft.status === 'archived') finalizeOpenSession(id)
  return requireSpace(id)
}

export function setSpaceGoals(id: string, input: unknown): Space {
  requireSpace(id)
  const goals = parseSpaceGoals(input)
  getDatabase()
    .prepare(
      `UPDATE spaces
       SET daily_goal_min = ?, weekly_goal_min = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(goals.dailyGoalMin, goals.weeklyGoalMin, new Date().toISOString(), id)
  return requireSpace(id)
}

export function deleteSpace(id: string): void {
  const files = listSpaceNoteFiles(id)
  const db = getDatabase()
  const tx = db.transaction(() => {
    clearSpaceNoteSearch(id)
    const result = db.prepare('DELETE FROM spaces WHERE id = ?').run(id)
    if (result.changes === 0) throw new Error('Space was not found.')
    db.prepare(
      `DELETE FROM tags
       WHERE NOT EXISTS (SELECT 1 FROM note_tags WHERE note_tags.tag_id = tags.id)`
    ).run()
  })
  tx()
  for (const filePath of files) deleteNoteImageFile(filePath)
}

export function reorderSpaces(ids: string[]): Space[] {
  const current = listSpaces()
  if (ids.length !== current.length) throw new Error('Reorder must include every space.')

  const known = new Set(current.map((space) => space.id))
  const seen = new Set<string>()
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) throw new Error('Reorder list is invalid.')
    seen.add(id)
  }

  const db = getDatabase()
  const update = db.prepare('UPDATE spaces SET sort_order = ? WHERE id = ?')
  const apply = db.transaction(() => {
    ids.forEach((id, index) => {
      update.run(index, id)
    })
  })
  apply()
  return listSpaces()
}

function requireSpace(id: string): Space {
  const row = getDatabase()
    .prepare<string[], SpaceRow>(`SELECT ${SPACE_COLUMNS} FROM spaces WHERE id = ?`)
    .get(id)
  if (!row) throw new Error('Space was not found.')
  return mapSpace(row)
}

function mapSpace(row: SpaceRow): Space {
  if (!isSpaceStatus(row.status)) throw new Error('A saved space has an invalid status.')
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    status: row.status,
    targetHours: row.target_hours,
    targetDate: row.target_date,
    dailyGoalMin: row.daily_goal_min,
    weeklyGoalMin: row.weekly_goal_min,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
