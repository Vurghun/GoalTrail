import { app, BrowserWindow, dialog } from 'electron'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { NOTE_IMAGE_BYTES_MAX } from '@shared/notes'
import { isTheme } from '@shared/theme'
import { getDatabase } from './db'
import { reindexAllNotes } from './notes'
import { noteImagesDir, resolveImagePath } from './note-images'

const BACKUP_NAME = 'backup.json'
const IMAGE_PATH =
  /^images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|gif|webp)$/i
const BACKUP_BYTES_MAX = 200 * 1024 * 1024

interface BackupResult {
  canceled: boolean
}

export async function exportBackup(): Promise<BackupResult> {
  // Test hook: a path skips the native save dialog.
  const override = process.env['GOALTRAIL_EXPORT_PATH']
  if (override && override.length > 0) {
    writeBackup(override)
    return { canceled: false }
  }
  const parent = hostWindow()
  const picked = parent
    ? await dialog.showSaveDialog(parent, {
        title: 'Export GoalTrail backup',
        defaultPath: 'goaltrail-backup.zip',
        filters: [{ name: 'Zip archive', extensions: ['zip'] }]
      })
    : await dialog.showSaveDialog({
        title: 'Export GoalTrail backup',
        defaultPath: 'goaltrail-backup.zip',
        filters: [{ name: 'Zip archive', extensions: ['zip'] }]
      })
  const filePath = picked.filePath
  if (!filePath) return { canceled: true }
  writeBackup(filePath)
  return { canceled: false }
}

export async function importBackup(): Promise<BackupResult> {
  // Test hook: a path skips the native open dialog.
  const override = process.env['GOALTRAIL_IMPORT_PATH']
  if (override && override.length > 0) {
    restoreBackup(override)
    return { canceled: false }
  }
  const parent = hostWindow()
  const options = {
    title: 'Import GoalTrail backup',
    filters: [{ name: 'Zip archive', extensions: ['zip'] }],
    properties: ['openFile'] as 'openFile'[]
  }
  const picked = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  const filePath = picked.filePaths[0]
  if (!filePath) return { canceled: true }
  restoreBackup(filePath)
  return { canceled: false }
}

function writeBackup(filePath: string): void {
  const db = getDatabase()
  const images = db.prepare<[], { file_path: string }>('SELECT file_path FROM note_images').all()
  const files: Record<string, Uint8Array> = {
    [BACKUP_NAME]: strToU8(
      JSON.stringify({
        format: 'goaltrail-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        spaces: db.prepare('SELECT * FROM spaces ORDER BY sort_order ASC').all(),
        sessions: db
          .prepare('SELECT * FROM sessions')
          .all()
          .map((row) => exportSession(row)),
        notes: db.prepare('SELECT * FROM notes').all(),
        noteImages: db.prepare('SELECT * FROM note_images').all(),
        tags: db.prepare('SELECT * FROM tags').all(),
        noteTags: db.prepare('SELECT * FROM note_tags').all(),
        milestones: db.prepare('SELECT * FROM milestones').all(),
        settings: db.prepare('SELECT key, value FROM settings').all()
      })
    )
  }

  for (const image of images) {
    const bytes = readFileSync(resolveImagePath(image.file_path))
    files[image.file_path] = new Uint8Array(bytes)
  }

  writeFileSync(filePath, zipSync(files))
}

function exportSession(row: unknown): unknown {
  if (!isRecord(row) || row.is_open !== 1 || typeof row.resumed_at !== 'string') return row
  const extra = Math.max(0, Math.floor((Date.now() - Date.parse(row.resumed_at)) / 1000))
  const duration = typeof row.duration_sec === 'number' ? row.duration_sec : 0
  return { ...row, duration_sec: duration + extra, resumed_at: null }
}

function restoreBackup(filePath: string): void {
  const packed = readFileSync(filePath)
  if (packed.byteLength > BACKUP_BYTES_MAX) throw new Error('That backup is too large.')
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(packed))
  } catch {
    throw new Error('This file is not a GoalTrail backup.')
  }
  const jsonEntry = entries[BACKUP_NAME]
  if (!jsonEntry) throw new Error('This file is not a GoalTrail backup.')
  let parsed: unknown
  try {
    parsed = JSON.parse(strFromU8(jsonEntry))
  } catch {
    throw new Error('This file is not a GoalTrail backup.')
  }
  const backup = parseBackup(parsed)
  const images = new Map<string, Uint8Array>()
  for (const [name, bytes] of Object.entries(entries)) {
    if (name === BACKUP_NAME) continue
    if (!IMAGE_PATH.test(name)) throw new Error('This backup contains an unsafe file.')
    if (bytes.byteLength > NOTE_IMAGE_BYTES_MAX)
      throw new Error('An image in this backup is too large.')
    images.set(name, bytes)
  }
  for (const image of backup.noteImages) {
    const path = image.file_path
    if (typeof path !== 'string' || !images.has(path)) {
      throw new Error('This backup is missing an image.')
    }
  }

  const userData = app.getPath('userData')
  const staging = join(userData, 'images-next')
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  for (const image of backup.noteImages) {
    const path = image.file_path
    if (typeof path !== 'string') throw new Error('This backup is missing an image.')
    const name = path.slice('images/'.length)
    writeFileSync(join(staging, name), images.get(path) ?? new Uint8Array())
  }

  const db = getDatabase()
  const apply = db.transaction(() => {
    db.exec(`
      DELETE FROM notes_fts;
      DELETE FROM spaces;
      DELETE FROM tags;
      DELETE FROM settings;
    `)
    insertRows(
      'spaces',
      [
        'id',
        'name',
        'description',
        'color',
        'icon',
        'status',
        'target_hours',
        'target_date',
        'daily_goal_min',
        'weekly_goal_min',
        'sort_order',
        'created_at',
        'updated_at'
      ],
      backup.spaces
    )
    insertRows('tags', ['id', 'name'], backup.tags)
    insertRows(
      'notes',
      ['id', 'space_id', 'title', 'content', 'pinned', 'created_at', 'updated_at'],
      backup.notes
    )
    insertRows('note_images', ['id', 'note_id', 'file_path', 'created_at'], backup.noteImages)
    insertRows('note_tags', ['note_id', 'tag_id'], backup.noteTags)
    insertRows(
      'milestones',
      ['id', 'space_id', 'title', 'done', 'done_at', 'sort_order'],
      backup.milestones
    )
    insertRows(
      'sessions',
      ['id', 'space_id', 'started_at', 'ended_at', 'duration_sec', 'resumed_at', 'note', 'is_open'],
      backup.sessions
    )
    insertRows('settings', ['key', 'value'], backup.settings)
    reindexAllNotes()
  })

  try {
    apply()
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error instanceof Error ? error : new Error('This backup could not be restored.')
  }

  swapImageFolder(staging)
}

function swapImageFolder(staging: string): void {
  const current = noteImagesDir()
  const previous = join(app.getPath('userData'), 'images-previous')
  rmSync(previous, { recursive: true, force: true })
  mkdirSync(current, { recursive: true })
  renameSync(current, previous)
  try {
    renameSync(staging, current)
  } catch (error) {
    if (existsSync(previous)) renameSync(previous, current)
    throw error
  }
  rmSync(previous, { recursive: true, force: true })
}

interface BackupData {
  spaces: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  noteImages: Record<string, unknown>[]
  tags: Record<string, unknown>[]
  noteTags: Record<string, unknown>[]
  milestones: Record<string, unknown>[]
  settings: Record<string, unknown>[]
}

function parseBackup(input: unknown): BackupData {
  if (!isRecord(input) || input.format !== 'goaltrail-backup' || input.version !== 1) {
    throw new Error('This file is not a GoalTrail backup.')
  }
  const spaces = rows(input.spaces, 'spaces')
  const notes = rows(input.notes, 'notes')
  const tags = rows(input.tags, 'tags')
  const sessions = rows(input.sessions, 'sessions')
  const noteImages = rows(input.noteImages, 'images')
  const noteTags = rows(input.noteTags, 'note tags')
  const milestones = rows(input.milestones, 'milestones')
  const settings = rows(input.settings, 'settings')

  const spaceIds = ids(spaces, 'id')
  const noteIds = ids(notes, 'id')
  const tagIds = ids(tags, 'id')
  let openSessions = 0
  for (const session of sessions) {
    requireMember(session.space_id, spaceIds, 'A time entry points at a missing space.')
    if (session.is_open === 1) {
      openSessions += 1
      session.resumed_at = null
      if (session.ended_at != null) throw new Error('This backup has an invalid timer.')
    }
  }
  if (openSessions > 1) throw new Error('This backup has more than one running timer.')
  for (const note of notes)
    requireMember(note.space_id, spaceIds, 'A note points at a missing space.')
  for (const milestone of milestones) {
    requireMember(milestone.space_id, spaceIds, 'A milestone points at a missing space.')
  }
  for (const image of noteImages) {
    requireMember(image.note_id, noteIds, 'An image points at a missing note.')
    if (typeof image.file_path !== 'string' || !IMAGE_PATH.test(image.file_path)) {
      throw new Error('This backup contains an unsafe image path.')
    }
  }
  for (const link of noteTags) {
    requireMember(link.note_id, noteIds, 'A tag points at a missing note.')
    requireMember(link.tag_id, tagIds, 'A tag link is missing its tag.')
  }
  const settingKeys = new Set<string>()
  for (const setting of settings) {
    if (
      typeof setting.key !== 'string' ||
      typeof setting.value !== 'string' ||
      settingKeys.has(setting.key)
    ) {
      throw new Error('This backup has invalid settings.')
    }
    settingKeys.add(setting.key)
    if (setting.key === 'theme' && !isTheme(setting.value))
      throw new Error('The backup theme is invalid.')
    if (
      setting.key === 'week_starts_on' &&
      (typeof setting.value !== 'string' || !/^[0-6]$/.test(setting.value))
    ) {
      throw new Error('The backup week start is invalid.')
    }
  }

  return {
    spaces,
    sessions,
    notes,
    noteImages,
    tags,
    noteTags,
    milestones,
    settings
  }
}

function insertRows(table: string, columns: string[], records: Record<string, unknown>[]): void {
  if (records.length === 0) return
  const names = columns.join(', ')
  const params = columns.map((column) => `@${column}`).join(', ')
  const statement = getDatabase().prepare(`INSERT INTO ${table} (${names}) VALUES (${params})`)
  for (const record of records) {
    const values: Record<string, unknown> = {}
    for (const column of columns) values[column] = record[column] ?? null
    statement.run(values)
  }
}

function rows(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord))
    throw new Error(`Backup ${label} are invalid.`)
  return value
}

function ids(records: Record<string, unknown>[], key: string): Set<string> {
  const values = new Set<string>()
  for (const record of records) {
    const id = record[key]
    if (typeof id !== 'string' || id.length === 0 || values.has(id)) {
      throw new Error('This backup contains an invalid id.')
    }
    values.add(id)
  }
  return values
}

function requireMember(value: unknown, known: Set<string>, message: string): void {
  if (typeof value !== 'string' || !known.has(value)) throw new Error(message)
}

function hostWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
