import { app, Menu, Tray, type MenuItemConstructorOptions } from 'electron'
import { formatClock } from '@shared/time'
import { trayImage } from './icon'
import { markQuitting, setTrayReady } from './runtime'
import { describeTimer } from './sessions'
import { userPauseTimer, userStartTimer, userStopTimer } from './timer-actions'
import { showMainWindow } from './windows'

type TimerDescription = NonNullable<ReturnType<typeof describeTimer>>

let tray: Tray | null = null
let menuKey = ''
let iconKey = ''

export function createTray(): void {
  tray = new Tray(trayImage(false))
  tray.setToolTip('GoalTrail')
  tray.on('click', () => {
    showMainWindow()
  })
  if (process.platform === 'darwin') {
    tray.on('right-click', () => {
      if (!tray || tray.isDestroyed()) return
      tray.popUpContextMenu(buildMenu(readTimer()))
    })
  } else {
    tray.setContextMenu(buildMenu(null))
  }
  setTrayReady(true)
  refreshTray()
  setInterval(refreshTray, 1000)
}

export function hasTray(): boolean {
  return tray !== null && !tray.isDestroyed()
}

export function refreshTray(): void {
  if (!tray || tray.isDestroyed()) return
  const described = readTimer()
  const running = described?.session.running ?? false
  tray.setToolTip(tooltip(described))
  if (process.platform === 'darwin') {
    tray.setTitle(running && described ? ` ${formatClock(described.elapsed)}` : '')
  }
  const nextIcon = running ? 'run' : 'idle'
  if (nextIcon !== iconKey) {
    iconKey = nextIcon
    tray.setImage(trayImage(running))
  }
  const key = described
    ? `${described.session.id}:${running ? 'run' : 'pause'}`
    : 'none'
  if (process.platform !== 'darwin' && key !== menuKey) {
    menuKey = key
    tray.setContextMenu(buildMenu(described))
  }
}

function readTimer(): TimerDescription | null {
  try {
    return describeTimer()
  } catch {
    return null
  }
}

function tooltip(described: TimerDescription | null): string {
  if (!described) return 'GoalTrail'
  const time = formatClock(described.elapsed)
  if (described.session.running) return `${described.spaceName} · ${time}`
  return `${described.spaceName} paused · ${time}`
}

function buildMenu(described: TimerDescription | null): Menu {
  const items: MenuItemConstructorOptions[] = [
    {
      label: 'Open GoalTrail',
      click: () => {
        showMainWindow()
      }
    }
  ]
  if (described?.session.running) {
    items.push({
      label: 'Pause timer',
      click: () => {
        try {
          userPauseTimer()
        } catch (error) {
          console.error(error)
        }
      }
    })
  } else if (described) {
    items.push({
      label: 'Resume timer',
      click: () => {
        try {
          userStartTimer(described.session.spaceId)
        } catch (error) {
          console.error(error)
        }
      }
    })
  }
  if (described) {
    items.push({
      label: 'Stop timer',
      click: () => {
        try {
          userStopTimer()
        } catch (error) {
          console.error(error)
        }
      }
    })
  }
  items.push(
    { type: 'separator' },
    {
      label: 'Quit GoalTrail',
      click: () => {
        markQuitting()
        app.quit()
      }
    }
  )
  return Menu.buildFromTemplate(items)
}
