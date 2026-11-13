export const NOTE_TITLE_MAX = 200
export const NOTE_CONTENT_MAX = 200_000
export const NOTE_TAG_MAX = 40
export const NOTE_TAGS_MAX = 12
export const NOTE_IMAGE_BYTES_MAX = 8 * 1024 * 1024
export const NOTE_IMAGE_URL_PREFIX = 'goaltrail://media/'

const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}+_-]{0,39}$/u
const IMAGE_SRC_PATTERN =
  /goaltrail:\/\/media\/(images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|gif|webp))/gi

export const NOTE_IMAGE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
} as const

export type NoteImageMime = keyof typeof NOTE_IMAGE_EXTENSIONS

export interface NoteDraft {
  title: string
  content: string
  tags: string[]
}

export interface NoteSummary {
  id: string
  spaceId: string
  title: string
  pinned: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  excerpt: string
  imageCount: number
  coverSrc: string | null
}

export interface Note extends NoteSummary {
  content: string
  createdAt: string
}

export interface NoteSearchHit extends NoteSummary {
  spaceName: string
}

export interface NoteSearchQuery {
  text: string
  spaceId: string | null
  tag: string | null
}

export interface SavedNoteImage {
  src: string
}

export function parseNoteDraft(input: unknown): NoteDraft {
  if (!isRecord(input)) throw new Error('Note is invalid.')
  if (typeof input.title !== 'string') throw new Error('Title is invalid.')
  if (typeof input.content !== 'string') throw new Error('Note body is invalid.')

  const title = input.title.trim()
  if (title.length > NOTE_TITLE_MAX) {
    throw new Error(`Title must be ${NOTE_TITLE_MAX} characters or fewer.`)
  }

  const content = sanitizeNoteContent(input.content)
  if (content.length > NOTE_CONTENT_MAX) {
    throw new Error('This note is too long.')
  }

  return { title, content, tags: parseTags(input.tags) }
}

export function parseNoteSearch(input: unknown): NoteSearchQuery {
  if (!isRecord(input)) throw new Error('Search is invalid.')
  if (typeof input.text !== 'string') throw new Error('Search text is invalid.')
  const text = input.text.trim()
  if (text.length > 200) throw new Error('Search text is too long.')

  let spaceId: string | null = null
  if (input.spaceId !== null && input.spaceId !== undefined) {
    if (typeof input.spaceId !== 'string' || input.spaceId.length === 0) {
      throw new Error('Space filter is invalid.')
    }
    spaceId = input.spaceId
  }

  let tag: string | null = null
  if (typeof input.tag === 'string' && input.tag.trim().length > 0) {
    tag = normalizeTag(input.tag)
    if (!TAG_PATTERN.test(tag)) throw new Error('Tag filter is invalid.')
  }

  return { text, spaceId, tag }
}

export function toFtsQuery(text: string): string | null {
  const tokens = text
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/["*^():]/g, ''))
    .filter((token) => token.length > 0)
    .slice(0, 12)
  if (tokens.length === 0) return null
  return tokens.map((token) => `"${token}"*`).join(' AND ')
}

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function noteExcerpt(content: string): string {
  const plain = plainTextFromHtml(content)
  if (plain.length <= 160) return plain
  return `${plain.slice(0, 159)}…`
}

export function noteImagePaths(html: string): string[] {
  const paths: string[] = []
  for (const match of html.matchAll(IMAGE_SRC_PATTERN)) {
    const path = match[1]
    if (path && !paths.includes(path)) paths.push(path)
  }
  return paths
}

export function sanitizeNoteContent(html: string): string {
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  return withoutScripts.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = /\bsrc=(["'])([^"']+)\1/i.exec(tag)
    const path = srcMatch ? noteImagePaths(srcMatch[2] ?? '')[0] : undefined
    if (!path) return ''
    return `<img src="${NOTE_IMAGE_URL_PREFIX}${path}">`
  })
}

export function isNoteImageMime(value: string): value is NoteImageMime {
  return Object.prototype.hasOwnProperty.call(NOTE_IMAGE_EXTENSIONS, value)
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Tags are invalid.')
  if (value.length > NOTE_TAGS_MAX) throw new Error(`Use at most ${NOTE_TAGS_MAX} tags.`)

  const tags: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') throw new Error('Tags are invalid.')
    const name = normalizeTag(item)
    if (!name) continue
    if (name.length > NOTE_TAG_MAX) throw new Error('Tags must be 40 characters or fewer.')
    if (!TAG_PATTERN.test(name)) throw new Error(`Tag "${name}" is invalid.`)
    if (!tags.includes(name)) tags.push(name)
  }
  return tags
}

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
