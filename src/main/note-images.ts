import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { basename, join, resolve, sep } from 'path'
import { app, protocol } from 'electron'
import {
  NOTE_IMAGE_BYTES_MAX,
  NOTE_IMAGE_EXTENSIONS,
  NOTE_IMAGE_URL_PREFIX,
  isNoteImageMime
} from '@shared/notes'

const FILE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|gif|webp)$/i

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

let protocolRegistered = false

export function noteImagesDir(): string {
  return join(app.getPath('userData'), 'images')
}

export function noteImageSrc(relativePath: string): string {
  return `${NOTE_IMAGE_URL_PREFIX}${relativePath}`
}

export function saveNoteImageFile(bytes: Uint8Array, mime: string): string {
  if (!isNoteImageMime(mime)) throw new Error('Use a PNG, JPEG, GIF, or WebP image.')
  if (bytes.byteLength === 0) throw new Error('That image is empty.')
  if (bytes.byteLength > NOTE_IMAGE_BYTES_MAX) throw new Error('Images must be 8 MB or smaller.')
  const ext = NOTE_IMAGE_EXTENSIONS[mime]
  if (!matchesMagic(bytes, ext)) throw new Error('That file is not a valid image.')

  const relativePath = `images/${randomUUID()}.${ext}`
  mkdirSync(noteImagesDir(), { recursive: true })
  writeFileSync(resolveImagePath(relativePath), bytes)
  return relativePath
}

export function deleteNoteImageFile(relativePath: string): void {
  try {
    unlinkSync(resolveImagePath(relativePath))
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
    if (code !== 'ENOENT') throw error
  }
}

export function resolveImagePath(relativePath: string): string {
  const name = basename(relativePath)
  if (relativePath !== `images/${name}` || !FILE_NAME.test(name)) {
    throw new Error('Image path is invalid.')
  }

  const root = resolve(noteImagesDir())
  const full = resolve(root, name)
  const prefix = root.endsWith(sep) ? root : root + sep
  if (!full.startsWith(prefix)) throw new Error('Image path is invalid.')
  return full
}

export function registerNoteImageProtocol(): void {
  if (protocolRegistered) return
  protocolRegistered = true

  protocol.handle('goaltrail', (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'media') return new Response(null, { status: 404 })
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const data = readFileSync(resolveImagePath(relativePath))
      const ext = basename(relativePath).split('.').pop()?.toLowerCase() ?? ''
      return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream' }
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

function matchesMagic(bytes: Uint8Array, ext: string): boolean {
  if (ext === 'png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])
  if (ext === 'jpg') return startsWith(bytes, [0xff, 0xd8, 0xff])
  if (ext === 'gif') return startsWith(bytes, [0x47, 0x49, 0x46])
  if (ext === 'webp') {
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes.length >= 12 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
  }
  return false
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((value, index) => bytes[index] === value)
}
