import { randomUUID } from 'crypto'
import type { Note, NoteSearchHit, NoteSummary, SavedNoteImage } from '@shared/notes'
import {
  noteExcerpt,
  noteImagePaths,
  parseNoteDraft,
  parseNoteSearch,
  plainTextFromHtml,
  toFtsQuery
} from '@shared/notes'
import { getDatabase } from './db'
import {
  deleteNoteImageFile,
  noteImageSrc,
  removeUnreferencedImageFiles,
  saveNoteImageFile
} from './note-images'

interface NoteRow {
  id: string
  space_id: string
  title: string
  content: string
  pinned: number
  created_at: string
  updated_at: string
  space_name?: string
}

const NOTE_COLUMNS = 'id, space_id, title, content, pinned, created_at, updated_at'

export function listNotes(spaceId: string): NoteSummary[] {
  requireSpace(spaceId)
  const rows = getDatabase()
    .prepare<[string], NoteRow>(
      `SELECT ${NOTE_COLUMNS} FROM notes
       WHERE space_id = ?
       ORDER BY pinned DESC, updated_at DESC`
    )
    .all(spaceId)
  const tags = tagsByNote(rows.map((row) => row.id))
  return rows.map((row) => toSummary(row, tags.get(row.id) ?? []))
}

export function getNote(id: string): Note {
  const row = getDatabase()
    .prepare<[string], NoteRow>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`)
    .get(id)
  if (!row) throw new Error('Note was not found.')
  return toNote(row, tagsByNote([id]).get(id) ?? [])
}

export function createNote(spaceId: string): Note {
  requireSpace(spaceId)
  const now = new Date().toISOString()
  const id = randomUUID()
  const db = getDatabase()
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO notes (id, space_id, title, content, pinned, created_at, updated_at)
       VALUES (@id, @space_id, '', '', 0, @created_at, @updated_at)`
    ).run({ id, space_id: spaceId, created_at: now, updated_at: now })
    replaceSearch(id, '')
  })
  tx()
  return getNote(id)
}

export function updateNote(id: string, input: unknown): Note {
  const draft = parseNoteDraft(input)
  const db = getDatabase()
  const existing = db
    .prepare<[string], NoteRow>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`)
    .get(id)
  if (!existing) throw new Error('Note was not found.')

  const removedImages = imagePathsToRemove(id, draft.content)
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE notes
       SET title = @title, content = @content, updated_at = @updated_at
       WHERE id = @id`
    ).run({ id, title: draft.title, content: draft.content, updated_at: now })
    replaceTags(id, draft.tags)
    deleteImageRows(id, removedImages)
    replaceSearch(id, searchText(draft.title, draft.content, draft.tags))
    deleteUnusedTags()
  })
  tx()
  for (const filePath of removedImages) deleteNoteImageFile(filePath)
  return getNote(id)
}

export function setNotePinned(id: string, pinned: boolean): Note {
  const result = getDatabase()
    .prepare('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?')
    .run(pinned ? 1 : 0, new Date().toISOString(), id)
  if (result.changes === 0) throw new Error('Note was not found.')
  return getNote(id)
}

export function deleteNote(id: string): void {
  const db = getDatabase()
  const existing = db.prepare<[string], { id: string }>('SELECT id FROM notes WHERE id = ?').get(id)
  if (!existing) throw new Error('Note was not found.')
  const files = imagePathsForNote(id)
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id)
    db.prepare('DELETE FROM notes WHERE id = ?').run(id)
    deleteUnusedTags()
  })
  tx()
  for (const filePath of files) deleteNoteImageFile(filePath)
}

export function saveNoteImage(noteId: string, bytes: Uint8Array, mime: string): SavedNoteImage {
  const db = getDatabase()
  const note = db.prepare<[string], { id: string }>('SELECT id FROM notes WHERE id = ?').get(noteId)
  if (!note) throw new Error('Note was not found.')

  const relativePath = saveNoteImageFile(bytes, mime)
  try {
    db.prepare(
      `INSERT INTO note_images (id, note_id, file_path, created_at)
       VALUES (@id, @note_id, @file_path, @created_at)`
    ).run({
      id: randomUUID(),
      note_id: noteId,
      file_path: relativePath,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    deleteNoteImageFile(relativePath)
    throw error
  }
  return { src: noteImageSrc(relativePath) }
}

export function searchNotes(input: unknown): NoteSearchHit[] {
  const query = parseNoteSearch(input)
  const fts = toFtsQuery(query.text)
  if (!fts && !query.tag && !query.spaceId) return []

  const filters: string[] = []
  const params: string[] = []
  if (query.spaceId) {
    filters.push('n.space_id = ?')
    params.push(query.spaceId)
  }
  if (query.tag) {
    filters.push(
      `EXISTS (
        SELECT 1 FROM note_tags nt
        JOIN tags t ON t.id = nt.tag_id
        WHERE nt.note_id = n.id AND t.name = ?
      )`
    )
    params.push(query.tag)
  }
  const extra = filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''

  const sql = fts
    ? `SELECT n.id, n.space_id, n.title, n.content, n.pinned, n.created_at, n.updated_at,
              s.name AS space_name
       FROM notes_fts
       JOIN notes n ON n.id = notes_fts.note_id
       JOIN spaces s ON s.id = n.space_id
       WHERE notes_fts MATCH ?
       ${extra}
       ORDER BY n.pinned DESC, n.updated_at DESC
       LIMIT 50`
    : `SELECT n.id, n.space_id, n.title, n.content, n.pinned, n.created_at, n.updated_at,
              s.name AS space_name
       FROM notes n
       JOIN spaces s ON s.id = n.space_id
       WHERE 1 = 1
       ${extra}
       ORDER BY n.pinned DESC, n.updated_at DESC
       LIMIT 50`

  const rows = getDatabase()
    .prepare<string[], NoteRow>(sql)
    .all(...(fts ? [fts, ...params] : params))
  const tags = tagsByNote(rows.map((row) => row.id))
  return rows.map((row) => ({
    ...toSummary(row, tags.get(row.id) ?? []),
    spaceName: row.space_name ?? ''
  }))
}

export function listTags(): string[] {
  const rows = getDatabase()
    .prepare<[], { name: string }>('SELECT name FROM tags ORDER BY name ASC')
    .all()
  return rows.map((row) => row.name)
}

export function listSpaceNoteFiles(spaceId: string): string[] {
  const rows = getDatabase()
    .prepare<[string], { file_path: string }>(
      `SELECT ni.file_path AS file_path
       FROM note_images ni
       JOIN notes n ON n.id = ni.note_id
       WHERE n.space_id = ?`
    )
    .all(spaceId)
  return rows.map((row) => row.file_path)
}

export function clearSpaceNoteSearch(spaceId: string): void {
  const db = getDatabase()
  const ids = db
    .prepare<[string], { id: string }>('SELECT id FROM notes WHERE space_id = ?')
    .all(spaceId)
  const remove = db.prepare('DELETE FROM notes_fts WHERE note_id = ?')
  for (const row of ids) remove.run(row.id)
}

export function reindexAllNotes(): void {
  const db = getDatabase()
  const notes = db
    .prepare<[], { id: string; title: string; content: string }>(
      'SELECT id, title, content FROM notes'
    )
    .all()
  const tags = tagsByNote(notes.map((note) => note.id))
  db.prepare('DELETE FROM notes_fts').run()
  for (const note of notes) {
    replaceSearch(note.id, searchText(note.title, note.content, tags.get(note.id) ?? []))
  }
}

function requireSpace(spaceId: string): void {
  const row = getDatabase()
    .prepare<[string], { id: string }>('SELECT id FROM spaces WHERE id = ?')
    .get(spaceId)
  if (!row) throw new Error('Space was not found.')
}

function replaceSearch(noteId: string, text: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId)
  db.prepare('INSERT INTO notes_fts (note_id, search_text) VALUES (?, ?)').run(noteId, text)
}

function replaceTags(noteId: string, tags: string[]): void {
  const db = getDatabase()
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)
  const find = db.prepare<[string], { id: string }>('SELECT id FROM tags WHERE name = ?')
  const insertTag = db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)')
  const link = db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)')
  for (const name of tags) {
    const found = find.get(name)
    const tagId = found?.id ?? randomUUID()
    if (!found) insertTag.run(tagId, name)
    link.run(noteId, tagId)
  }
}

function deleteUnusedTags(): void {
  getDatabase()
    .prepare(
      `DELETE FROM tags
       WHERE NOT EXISTS (SELECT 1 FROM note_tags WHERE note_tags.tag_id = tags.id)`
    )
    .run()
}

function imagePathsForNote(noteId: string): string[] {
  return getDatabase()
    .prepare<[string], { file_path: string }>('SELECT file_path FROM note_images WHERE note_id = ?')
    .all(noteId)
    .map((row) => row.file_path)
}

function imagePathsToRemove(noteId: string, content: string): string[] {
  const keep = new Set(noteImagePaths(content))
  return imagePathsForNote(noteId).filter((filePath) => !keep.has(filePath))
}

function deleteImageRows(noteId: string, filePaths: string[]): void {
  const statement = getDatabase().prepare(
    'DELETE FROM note_images WHERE note_id = ? AND file_path = ?'
  )
  for (const filePath of filePaths) statement.run(noteId, filePath)
}

function tagsByNote(noteIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (noteIds.length === 0) return map
  const placeholders = noteIds.map(() => '?').join(', ')
  const rows = getDatabase()
    .prepare<string[], { note_id: string; name: string }>(
      `SELECT nt.note_id AS note_id, t.name AS name
       FROM note_tags nt
       JOIN tags t ON t.id = nt.tag_id
       WHERE nt.note_id IN (${placeholders})
       ORDER BY t.name ASC`
    )
    .all(...noteIds)
  for (const row of rows) {
    const tags = map.get(row.note_id) ?? []
    tags.push(row.name)
    map.set(row.note_id, tags)
  }
  return map
}

function searchText(title: string, content: string, tags: string[]): string {
  return [title, plainTextFromHtml(content), tags.join(' ')]
    .filter((part) => part.length > 0)
    .join('\n')
}

export function listAllNotes(): NoteSearchHit[] {
  const rows = getDatabase()
    .prepare<[], NoteRow>(
      `SELECT n.id, n.space_id, n.title, n.content, n.pinned, n.created_at, n.updated_at,
              s.name AS space_name
       FROM notes n
       JOIN spaces s ON s.id = n.space_id
       ORDER BY n.pinned DESC, n.updated_at DESC`
    )
    .all()
  const tags = tagsByNote(rows.map((row) => row.id))
  return rows.map((row) => ({
    ...toSummary(row, tags.get(row.id) ?? []),
    spaceName: row.space_name ?? ''
  }))
}

export function sweepOrphanNoteImages(): void {
  const db = getDatabase()
  const contents = db.prepare<[], { content: string }>('SELECT content FROM notes').all()
  const referenced = new Set<string>()
  for (const row of contents) {
    for (const filePath of noteImagePaths(row.content)) referenced.add(filePath)
  }

  const stored = db
    .prepare<[], { id: string; file_path: string }>('SELECT id, file_path FROM note_images')
    .all()
  const removeRow = db.prepare('DELETE FROM note_images WHERE id = ?')
  for (const row of stored) {
    if (referenced.has(row.file_path)) continue
    removeRow.run(row.id)
    deleteNoteImageFile(row.file_path)
  }
  removeUnreferencedImageFiles(referenced)
}

function toSummary(row: NoteRow, tags: string[]): NoteSummary {
  const images = noteImagePaths(row.content)
  const cover = images[0]
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    pinned: row.pinned === 1,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    excerpt: noteExcerpt(row.content),
    imageCount: images.length,
    coverSrc: cover ? noteImageSrc(cover) : null
  }
}

function toNote(row: NoteRow, tags: string[]): Note {
  return {
    ...toSummary(row, tags),
    content: row.content
  }
}
