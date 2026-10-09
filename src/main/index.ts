import { app, BrowserWindow, dialog, protocol } from 'electron'
import { closeDatabase, openDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { registerNoteImageProtocol } from './note-images'
import { pauseInterruptedTimer, pauseTimerForQuit } from './sessions'
import { createMainWindow } from './windows'

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
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.goaltrail.desktop')
  }

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
  registerNoteImageProtocol()
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('before-quit', () => {
  pauseTimerForQuit()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
