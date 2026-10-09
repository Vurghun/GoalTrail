import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type AppInfo, type GoalTrailApi } from '@shared/ipc'
import type { DashboardSource } from '@shared/dashboard'
import type { SettingsSnapshot } from '@shared/settings'
import type { Note, NoteSearchHit, NoteSummary, SavedNoteImage } from '@shared/notes'
import type { Milestone, ProgressSource } from '@shared/progress'
import type { Space } from '@shared/spaces'
import type { Session } from '@shared/time'

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

const api: GoalTrailApi = {
  getAppInfo: () => invoke<AppInfo>(IpcChannel.appGetInfo),
  listSpaces: () => invoke<Space[]>(IpcChannel.spacesList),
  createSpace: (draft) => invoke<Space>(IpcChannel.spacesCreate, draft),
  updateSpace: (id, draft) => invoke<Space>(IpcChannel.spacesUpdate, id, draft),
  deleteSpace: (id) => invoke<void>(IpcChannel.spacesDelete, id),
  reorderSpaces: (ids) => invoke<Space[]>(IpcChannel.spacesReorder, ids),
  getTimer: () => invoke<Session | null>(IpcChannel.timerGet),
  startTimer: (spaceId) => invoke<Session>(IpcChannel.timerStart, spaceId),
  pauseTimer: () => invoke<Session>(IpcChannel.timerPause),
  stopTimer: () => invoke<Session | null>(IpcChannel.timerStop),
  listSessions: (spaceId) => invoke<Session[]>(IpcChannel.sessionsList, spaceId),
  createSession: (spaceId, draft) => invoke<Session>(IpcChannel.sessionsCreate, spaceId, draft),
  updateSession: (id, draft) => invoke<Session>(IpcChannel.sessionsUpdate, id, draft),
  deleteSession: (id) => invoke<void>(IpcChannel.sessionsDelete, id),
  listNotes: (spaceId) => invoke<NoteSummary[]>(IpcChannel.notesList, spaceId),
  getNote: (id) => invoke<Note>(IpcChannel.notesGet, id),
  createNote: (spaceId) => invoke<Note>(IpcChannel.notesCreate, spaceId),
  updateNote: (id, draft) => invoke<Note>(IpcChannel.notesUpdate, id, draft),
  setNotePinned: (id, pinned) => invoke<Note>(IpcChannel.notesSetPinned, id, pinned),
  deleteNote: (id) => invoke<void>(IpcChannel.notesDelete, id),
  saveNoteImage: (noteId, bytes, mime) =>
    invoke<SavedNoteImage>(IpcChannel.notesSaveImage, noteId, bytes, mime),
  searchNotes: (query) => invoke<NoteSearchHit[]>(IpcChannel.notesSearch, query),
  listTags: () => invoke<string[]>(IpcChannel.notesListTags),
  listMilestones: (spaceId) => invoke<Milestone[]>(IpcChannel.milestonesList, spaceId),
  createMilestone: (spaceId, title) =>
    invoke<Milestone>(IpcChannel.milestonesCreate, spaceId, title),
  updateMilestone: (id, title) => invoke<Milestone>(IpcChannel.milestonesUpdate, id, title),
  setMilestoneDone: (id, done) => invoke<Milestone>(IpcChannel.milestonesSetDone, id, done),
  deleteMilestone: (id) => invoke<void>(IpcChannel.milestonesDelete, id),
  reorderMilestones: (spaceId, ids) =>
    invoke<Milestone[]>(IpcChannel.milestonesReorder, spaceId, ids),
  setSpaceGoals: (spaceId, goals) => invoke<Space>(IpcChannel.spacesSetGoals, spaceId, goals),
  getProgress: (spaceId) => invoke<ProgressSource>(IpcChannel.progressGet, spaceId),
  getDashboard: () => invoke<DashboardSource>(IpcChannel.dashboardGet),
  getSettings: () => invoke<SettingsSnapshot>(IpcChannel.settingsGet),
  updateSettings: (patch) => invoke<SettingsSnapshot>(IpcChannel.settingsUpdate, patch),
  exportBackup: () => invoke<{ canceled: boolean }>(IpcChannel.backupExport),
  importBackup: () => invoke<{ canceled: boolean }>(IpcChannel.backupImport),
  exportData: (format) => invoke<{ canceled: boolean }>(IpcChannel.dataExport, format),
  showDataFolder: () => invoke<void>(IpcChannel.dataFolderShow),
  setWindowChrome: (dark) => invoke<void>(IpcChannel.windowChrome, dark),
  openMiniTimer: () => invoke<void>(IpcChannel.windowMiniOpen),
  closeMiniTimer: () => invoke<void>(IpcChannel.windowMiniClose)
}

if (!process.contextIsolated) {
  throw new Error('GoalTrail requires context isolation.')
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
