import { nativeImage, type NativeImage } from 'electron'
import { crc32, deflateSync } from 'zlib'

let idleIcon: NativeImage | null = null
let runningIcon: NativeImage | null = null

export function trayImage(running: boolean): NativeImage {
  if (running) {
    runningIcon ??= renderTrayIcon(true)
    return runningIcon
  }
  idleIcon ??= renderTrayIcon(false)
  return idleIcon
}

function renderTrayIcon(running: boolean): NativeImage {
  const template = process.platform === 'darwin'
  const image = nativeImage.createEmpty()
  image.addRepresentation({
    scaleFactor: 1,
    dataURL: pngDataUrl(16, drawIcon(16, running, template))
  })
  image.addRepresentation({
    scaleFactor: 2,
    dataURL: pngDataUrl(32, drawIcon(32, running, template))
  })
  if (template) image.setTemplateImage(true)
  return image
}

function pngDataUrl(size: number, rgba: Buffer): string {
  return `data:image/png;base64,${encodePng(size, size, rgba).toString('base64')}`
}

function drawIcon(size: number, running: boolean, template: boolean): Buffer {
  const rgba = Buffer.alloc(size * size * 4)
  const center = (size - 1) / 2
  const outer = size * 0.4
  const inner = size * 0.26
  const hand = Math.max(0.8, size * 0.07)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center
      const dy = y - center
      const dist = Math.hypot(dx, dy)
      let alpha = inside(outer, dist) - inside(inner, dist)
      if (Math.abs(dx) <= hand && dy <= 0.5 && dy >= -inner + 0.4) alpha = Math.max(alpha, 1)
      if (running && dist <= size * 0.11) alpha = 1
      alpha = Math.min(1, Math.max(0, alpha))
      if (alpha <= 0) continue
      const offset = (y * size + x) * 4
      const channel = Math.round(alpha * 255)
      if (template) {
        rgba[offset] = 0
        rgba[offset + 1] = 0
        rgba[offset + 2] = 0
        rgba[offset + 3] = channel
      } else {
        rgba[offset] = 0x4f
        rgba[offset + 1] = 0x46
        rgba[offset + 2] = 0xe5
        rgba[offset + 3] = channel
      }
    }
  }
  return rgba
}

function inside(edge: number, dist: number): number {
  const delta = edge - dist
  if (delta >= 0.75) return 1
  if (delta <= -0.75) return 0
  return (delta + 0.75) / 1.5
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1)
    raw[start] = 0
    rgba.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4)
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', pngHeader(width, height)),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function pngHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return header
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const name = Buffer.from(type)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 0)
  return Buffer.concat([length, name, data, checksum])
}
