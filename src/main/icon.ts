import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { nativeImage, nativeTheme, type NativeImage } from 'electron'
import appIconFile from '../../resources/icon.png?asset'
import idleDark16 from '../../resources/tray/idle-dark-16.png?asset'
import idleDark32 from '../../resources/tray/idle-dark-32.png?asset'
import idleHalo16 from '../../resources/tray/idle-halo-16.png?asset'
import idleHalo32 from '../../resources/tray/idle-halo-32.png?asset'
import idleLight16 from '../../resources/tray/idle-light-16.png?asset'
import idleLight32 from '../../resources/tray/idle-light-32.png?asset'
import runDark16 from '../../resources/tray/run-dark-16.png?asset'
import runDark32 from '../../resources/tray/run-dark-32.png?asset'
import runHalo16 from '../../resources/tray/run-halo-16.png?asset'
import runHalo32 from '../../resources/tray/run-halo-32.png?asset'
import runLight16 from '../../resources/tray/run-light-16.png?asset'
import runLight32 from '../../resources/tray/run-light-32.png?asset'

// macOS templates are black and let the menu bar tint them.
// Windows picks ink or paper from the taskbar theme, and falls back to a rimmed mark
// that stays visible when that theme cannot be read.
type TrayVariant = 'template' | 'dark' | 'light' | 'halo'

const TRAY_FILES: Record<string, readonly [string, string]> = {
  'idle-dark': [idleDark16, idleDark32],
  'run-dark': [runDark16, runDark32],
  'idle-light': [idleLight16, idleLight32],
  'run-light': [runLight16, runLight32],
  'idle-halo': [idleHalo16, idleHalo32],
  'run-halo': [runHalo16, runHalo32]
}

const cache = new Map<string, NativeImage>()
let applicationIcon: NativeImage | null = null
let taskbarLight: boolean | null = null
let taskbarCheckedAt = 0

export function appIcon(): NativeImage {
  applicationIcon ??= nativeImage.createFromPath(appIconFile)
  return applicationIcon
}

export function trayIconKey(running: boolean): string {
  return `${trayVariant()}:${running ? 'run' : 'idle'}`
}

export function trayImage(running: boolean): NativeImage {
  const variant = trayVariant()
  const key = `${variant}:${running ? 'run' : 'idle'}`
  const cached = cache.get(key)
  if (cached) return cached
  const image = loadTray(fileBase(running, variant), variant === 'template')
  cache.set(key, image)
  return image
}

function fileBase(running: boolean, variant: TrayVariant): string {
  const state = running ? 'run' : 'idle'
  if (variant === 'light') return `${state}-light`
  if (variant === 'halo') return `${state}-halo`
  return `${state}-dark`
}

function trayVariant(): TrayVariant {
  if (process.platform === 'darwin') return 'template'
  if (process.platform === 'win32') {
    const lightTaskbar = windowsTaskbarIsLight()
    if (lightTaskbar === null) return 'halo'
    return lightTaskbar ? 'dark' : 'light'
  }
  return nativeTheme.shouldUseDarkColors ? 'light' : 'dark'
}

function windowsTaskbarIsLight(): boolean | null {
  const now = Date.now()
  if (now - taskbarCheckedAt < 3000) return taskbarLight
  taskbarCheckedAt = now
  try {
    const output = execFileSync(
      'reg',
      [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
        '/v',
        'SystemUsesLightTheme'
      ],
      { windowsHide: true, timeout: 1500 }
    )
    const text = output.includes(0) ? output.toString('utf16le') : output.toString('utf8')
    const match = /SystemUsesLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(text)
    taskbarLight = match ? Number.parseInt(match[1], 16) !== 0 : null
  } catch {
    taskbarLight = null
  }
  return taskbarLight
}

function loadTray(base: string, template: boolean): NativeImage {
  const [file16, file32] = TRAY_FILES[base]
  const image = nativeImage.createEmpty()
  image.addRepresentation({ scaleFactor: 1, dataURL: pngDataUrl(file16) })
  image.addRepresentation({ scaleFactor: 2, dataURL: pngDataUrl(file32) })
  if (template) image.setTemplateImage(true)
  return image
}

function pngDataUrl(filePath: string): string {
  return `data:image/png;base64,${readFileSync(filePath).toString('base64')}`
}
