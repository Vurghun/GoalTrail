import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { isQuitting, isTrayReady } from './runtime'

let mainWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let onHide: (() => void) | null = null

const LIGHT = '#f5f6fa'
const DARK = '#0f1115'

function rendererUrl(view?: 'mini'): string | null {
  const base = process.env['ELECTRON_RENDERER_URL']
  if (!base) return null
  return view ? `${base}${base.includes('?') ? '&' : '?'}view=${view}` : base
}

function loadRenderer(win: BrowserWindow, view?: 'mini'): void {
  const url = rendererUrl(view)
  if (url) {
    void win.loadURL(url)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), {
    query: view ? { view } : undefined
  })
}

export function setMainWindowHideHandler(handler: () => void): void {
  onHide = handler
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'GoalTrail',
    backgroundColor: LIGHT,
    titleBarStyle: process.platform === 'win32' ? 'hidden' : 'default',
    titleBarOverlay:
      process.platform === 'win32'
        ? { color: LIGHT, symbolColor: '#17191f', height: 40 }
        : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow = win
  win.webContents.setBackgroundThrottling(false)

  win.on('ready-to-show', () => {
    win.show()
  })

  // Closing hides the window so a running timer survives. Quit is explicit.
  win.on('close', (event) => {
    if (isQuitting() || !isTrayReady()) return
    event.preventDefault()
    win.hide()
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.show()
    onHide?.()
  })

  win.on('closed', () => {
    mainWindow = null
    closeMiniTimer()
  })

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const base = process.env['ELECTRON_RENDERER_URL']
    if (base && url.startsWith(base)) return
    if (url.startsWith('file:') && url.includes('index.html')) return
    event.preventDefault()
  })

  loadRenderer(win)
  return win
}

export function setWindowChrome(dark: boolean): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  const color = dark ? DARK : LIGHT
  win.setBackgroundColor(color)
  if (process.platform === 'win32') {
    win.setTitleBarOverlay({
      color,
      symbolColor: dark ? '#f4f5f8' : '#17191f',
      height: 40
    })
  }
}

export function openMiniTimer(): void {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show()
    miniWindow.focus()
    return
  }
  const win = new BrowserWindow({
    width: 300,
    height: 92,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: DARK,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  miniWindow = win
  win.webContents.setBackgroundThrottling(false)
  win.on('ready-to-show', () => {
    win.show()
  })
  win.on('closed', () => {
    miniWindow = null
  })
  loadRenderer(win, 'mini')
}

export function closeMiniTimer(): void {
  if (!miniWindow || miniWindow.isDestroyed()) return
  miniWindow.close()
  miniWindow = null
}

export function sendToMain(channel: string, payload?: unknown): void {
  const win = getMainWindow()
  if (!win) return
  if (payload === undefined) win.webContents.send(channel)
  else win.webContents.send(channel, payload)
}

export function sendToAll(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (payload === undefined) win.webContents.send(channel)
    else win.webContents.send(channel, payload)
  }
}
