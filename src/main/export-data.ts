import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import { getDatabase } from './db'

interface SpaceRow {
  id: string
  name: string
  status: string
  target_hours: number | null
  target_date: string | null
}

interface SessionRow {
  id: string
  space_id: string
  started_at: string
  duration_sec: number
  note: string
}

export async function exportData(format: unknown): Promise<{ canceled: boolean }> {
  if (format !== 'json' && format !== 'csv') throw new Error('Choose JSON or CSV.')
  const spaces = getDatabase()
    .prepare<[], SpaceRow>(
      `SELECT id, name, status, target_hours, target_date
       FROM spaces ORDER BY sort_order`
    )
    .all()
  const sessions = getDatabase()
    .prepare<[], SessionRow>(
      `SELECT id, space_id, started_at, duration_sec, note
       FROM sessions WHERE is_open = 0 ORDER BY started_at`
    )
    .all()
  const result = await dialog.showSaveDialog({
    title: format === 'json' ? 'Export JSON' : 'Export CSV',
    defaultPath: format === 'json' ? 'goaltrail.json' : 'goaltrail.csv',
    filters: [{ name: format === 'json' ? 'JSON' : 'CSV', extensions: [format] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  const body =
    format === 'json'
      ? JSON.stringify({ spaces, sessions }, null, 2)
      : toCsv(spaces, sessions)
  writeFileSync(result.filePath, body, 'utf8')
  return { canceled: false }
}

function toCsv(spaces: SpaceRow[], sessions: SessionRow[]): string {
  const names = new Map(spaces.map((space) => [space.id, space.name]))
  const lines = ['space,started_at,duration_sec,note']
  for (const session of sessions) {
    lines.push(
      [
        csv(names.get(session.space_id) ?? session.space_id),
        csv(session.started_at),
        String(session.duration_sec),
        csv(session.note)
      ].join(',')
    )
  }
  return lines.join('\n')
}

function csv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}
