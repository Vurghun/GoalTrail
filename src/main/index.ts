import { app, dialog, protocol } from 'electron'
import { IpcEvent } from '@shared/ipc'
import { closeDatabase, openDatabase } from './db'
import { sweepOrphanNoteImages } from './notes'
import { registerIpcHandlers } from './ipc'
import { registerNoteImageProtocol } from './note-images'
import { pauseInterruptedTimer, pauseTimerForQuit } from './sessions'
import {
  createMainWindow,
  sendToAll,
  sendToMain,
  setMainWindowHideHandler,
  showMainWindow
} from './windows'
import { createTray, hasTray, refreshTray } from './tray'
import { trayImage } from './icon'
import { notify, setNotificationIcon } from './notify'
import { startIdleWatch } from './idle'
import { checkDailyGoals, startGoalWatch } from './goals'
import { startAutomaticBackups } from './backup'
import { stopPomodoro } from './pomodoro'
import { isQuitting, markQuitting, onSessionsMutated, onTimerMutated } from './runtime'

// Windows toasts use this id. It matches electron-builder's appId.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.goaltrail.desktop')
}

// The installer uses the display name GoalTrail. Keep the data folder named goaltrail.
app.setName('goaltrail')

// Lets a second profile keep its own database folder.
const userDataOverride = process.env['GOALTRAIL_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)

// Note images load through this scheme. The database stores a relative path only.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'goaltrail',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

app.whenReady().then(() => {
  try {
    openDatabase()
  } catch (error) {
    dialog.showErrorBox(
      'GoalTrail could not open its database',
      error instanceof Error ? error.message : 'Unknown database error'
    )
    app.quit()
    return
  }

  pauseInterruptedTimer()
  try {
    sweepOrphanNoteImages()
  } catch (error) {
    console.error(error)
  }
  registerNoteImageProtocol()
  registerIpcHandlers()
  setNotificationIcon(trayImage(false))
  try {
    createTray()
  } catch (error) {
    console.error(error)
  }
  let toldAboutTray = false
  setMainWindowHideHandler(() => {
    if (toldAboutTray) return
    toldAboutTray = true
    notify(
      'GoalTrail is still open',
      'The window is in the tray. Quit from the tray menu when you want to leave.',
      'low'
    )
  })
  onTimerMutated(() => {
    refreshTray()
    sendToAll(IpcEvent.timerChanged)
    try {
      checkDailyGoals()
    } catch (error) {
      console.error(error)
    }
  })
  onSessionsMutated(() => {
    sendToAll(IpcEvent.sessionsChanged)
  })
  createMainWindow()
  startIdleWatch()
  startGoalWatch()
  startAutomaticBackups((status) => {
    sendToMain(IpcEvent.backupUpdated, status)
  })

  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('before-quit', () => {
  markQuitting()
  stopPomodoro()
  pauseTimerForQuit()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  if (hasTray()) return
  if (!isQuitting()) app.quit()
})
