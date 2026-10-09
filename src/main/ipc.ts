import { app, ipcMain } from 'electron'
import { APP_NAME, IpcChannel, type AppInfo } from '@shared/ipc'
import { getDatabasePath } from './db'
import { exportBackup, importBackup } from './backup'
import { exportData } from './export-data'
import { closeMiniTimer, openMiniTimer, setWindowChrome } from './windows'
import { getDashboard } from './dashboard'
import {
  createMilestone,
  deleteMilestone,
  getProgress,
  listMilestones,
  reorderMilestones,
  setMilestoneDone,
  updateMilestone
} from './progress'
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  listTags,
  saveNoteImage,
  searchNotes,
  setNotePinned,
  updateNote
} from './notes'
import {
  createSession,
  deleteSession,
  getTimer,
  listSessions,
  pauseTimer,
  startTimer,
  stopTimer,
  updateSession
} from './sessions'
import { getSettings, showDataFolder, updateSettings } from './settings'
import {
  createSpace,
  deleteSpace,
  listSpaces,
  reorderSpaces,
  setSpaceGoals,
  updateSpace
} from './spaces'

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.appGetInfo, (): AppInfo => {
    return {
      name: APP_NAME,
      version: app.getVersion(),
      platform: process.platform,
      databasePath: getDatabasePath()
    }
  })

  ipcMain.handle(IpcChannel.spacesList, () => listSpaces())

  ipcMain.handle(IpcChannel.spacesCreate, (_event, input: unknown) => createSpace(input))

  ipcMain.handle(IpcChannel.spacesUpdate, (_event, id: unknown, input: unknown) => {
    return updateSpace(readSpaceId(id), input)
  })

  ipcMain.handle(IpcChannel.spacesDelete, (_event, id: unknown) => {
    deleteSpace(readSpaceId(id))
  })

  ipcMain.handle(IpcChannel.spacesReorder, (_event, ids: unknown) => {
    if (!isStringArray(ids)) throw new Error('Reorder list is invalid.')
    return reorderSpaces(ids)
  })

  ipcMain.handle(IpcChannel.timerGet, () => getTimer())
  ipcMain.handle(IpcChannel.timerStart, (_event, spaceId: unknown) =>
    startTimer(readId(spaceId, 'Space id'))
  )
  ipcMain.handle(IpcChannel.timerPause, () => pauseTimer())
  ipcMain.handle(IpcChannel.timerStop, () => stopTimer())
  ipcMain.handle(IpcChannel.sessionsList, (_event, spaceId: unknown) =>
    listSessions(readId(spaceId, 'Space id'))
  )
  ipcMain.handle(IpcChannel.sessionsCreate, (_event, spaceId: unknown, input: unknown) => {
    return createSession(readId(spaceId, 'Space id'), input)
  })
  ipcMain.handle(IpcChannel.sessionsUpdate, (_event, id: unknown, input: unknown) => {
    return updateSession(readId(id, 'Time entry id'), input)
  })
  ipcMain.handle(IpcChannel.sessionsDelete, (_event, id: unknown) => {
    deleteSession(readId(id, 'Time entry id'))
  })

  ipcMain.handle(IpcChannel.notesList, (_event, spaceId: unknown) => {
    return listNotes(readId(spaceId, 'Space id'))
  })
  ipcMain.handle(IpcChannel.notesGet, (_event, id: unknown) => getNote(readId(id, 'Note id')))
  ipcMain.handle(IpcChannel.notesCreate, (_event, spaceId: unknown) => {
    return createNote(readId(spaceId, 'Space id'))
  })
  ipcMain.handle(IpcChannel.notesUpdate, (_event, id: unknown, input: unknown) => {
    return updateNote(readId(id, 'Note id'), input)
  })
  ipcMain.handle(IpcChannel.notesSetPinned, (_event, id: unknown, pinned: unknown) => {
    if (typeof pinned !== 'boolean') throw new Error('Pin value is invalid.')
    return setNotePinned(readId(id, 'Note id'), pinned)
  })
  ipcMain.handle(IpcChannel.notesDelete, (_event, id: unknown) => {
    deleteNote(readId(id, 'Note id'))
  })
  ipcMain.handle(
    IpcChannel.notesSaveImage,
    (_event, noteId: unknown, bytes: unknown, mime: unknown) => {
      if (typeof mime !== 'string') throw new Error('Image type is invalid.')
      return saveNoteImage(readId(noteId, 'Note id'), readImageBytes(bytes), mime)
    }
  )
  ipcMain.handle(IpcChannel.notesSearch, (_event, input: unknown) => searchNotes(input))
  ipcMain.handle(IpcChannel.notesListTags, () => listTags())

  ipcMain.handle(IpcChannel.milestonesList, (_event, spaceId: unknown) => {
    return listMilestones(readId(spaceId, 'Space id'))
  })
  ipcMain.handle(IpcChannel.milestonesCreate, (_event, spaceId: unknown, title: unknown) => {
    return createMilestone(readId(spaceId, 'Space id'), title)
  })
  ipcMain.handle(IpcChannel.milestonesUpdate, (_event, id: unknown, title: unknown) => {
    return updateMilestone(readId(id, 'Milestone id'), title)
  })
  ipcMain.handle(IpcChannel.milestonesSetDone, (_event, id: unknown, done: unknown) => {
    if (typeof done !== 'boolean') throw new Error('Milestone state is invalid.')
    return setMilestoneDone(readId(id, 'Milestone id'), done)
  })
  ipcMain.handle(IpcChannel.milestonesDelete, (_event, id: unknown) => {
    deleteMilestone(readId(id, 'Milestone id'))
  })
  ipcMain.handle(IpcChannel.milestonesReorder, (_event, spaceId: unknown, ids: unknown) => {
    if (!isStringArray(ids)) throw new Error('Reorder list is invalid.')
    return reorderMilestones(readId(spaceId, 'Space id'), ids)
  })
  ipcMain.handle(IpcChannel.spacesSetGoals, (_event, spaceId: unknown, goals: unknown) => {
    return setSpaceGoals(readId(spaceId, 'Space id'), goals)
  })
  ipcMain.handle(IpcChannel.progressGet, (_event, spaceId: unknown) => {
    return getProgress(readId(spaceId, 'Space id'))
  })
  ipcMain.handle(IpcChannel.dashboardGet, () => getDashboard())
  ipcMain.handle(IpcChannel.settingsGet, () => getSettings())
  ipcMain.handle(IpcChannel.settingsUpdate, (_event, input: unknown) => updateSettings(input))
  ipcMain.handle(IpcChannel.backupExport, () => exportBackup())
  ipcMain.handle(IpcChannel.backupImport, () => importBackup())
  ipcMain.handle(IpcChannel.dataExport, (_event, format: unknown) => exportData(format))
  ipcMain.handle(IpcChannel.dataFolderShow, () => {
    showDataFolder()
  })
  ipcMain.handle(IpcChannel.windowChrome, (_event, dark: unknown) => {
    if (typeof dark !== 'boolean') throw new Error('Theme chrome is invalid.')
    setWindowChrome(dark)
  })
  ipcMain.handle(IpcChannel.windowMiniOpen, () => {
    openMiniTimer()
  })
  ipcMain.handle(IpcChannel.windowMiniClose, () => {
    closeMiniTimer()
  })
}

function readSpaceId(id: unknown): string {
  return readId(id, 'Space id')
}

function readId(id: unknown, label: string): string {
  if (typeof id !== 'string' || id.length === 0) throw new Error(`${label} is invalid.`)
  return id
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function readImageBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  throw new Error('Image data is invalid.')
}
