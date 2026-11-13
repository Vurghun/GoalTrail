import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, IpcEvent, type AppInfo, type GoalTrailApi } from '@shared/ipc'
import type { BackupStatus } from '@shared/backup'
import type { DashboardSource } from '@shared/dashboard'
import type { PomodoroSnapshot } from '@shared/pomodoro'
import type { SettingsSnapshot } from '@shared/settings'
import type { Note, NoteSearchHit, NoteSummary, SavedNoteImage } from '@shared/notes'
import type { Milestone, ProgressSource } from '@shared/progress'
import type { WeeklyReview } from '@shared/review'
import type { Space } from '@shared/spaces'
import type { HistorySession, Session } from '@shared/time'

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
  discardIdle: (sessionId, idleSec) =>
    invoke<Session | null>(IpcChannel.timerDiscardIdle, sessionId, idleSec),
  setSessionNote: (id, note) => invoke<Session>(IpcChannel.sessionsSetNote, id, note),
  listSessions: (spaceId) => invoke<Session[]>(IpcChannel.sessionsList, spaceId),
  listSessionHistory: (spaceId) => invoke<HistorySession[]>(IpcChannel.sessionsHistory, spaceId),
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
  createMilestone: (spaceId, draft) =>
    invoke<Milestone>(IpcChannel.milestonesCreate, spaceId, draft),
  updateMilestone: (id, draft) => invoke<Milestone>(IpcChannel.milestonesUpdate, id, draft),
  setMilestoneDone: (id, done) => invoke<Milestone>(IpcChannel.milestonesSetDone, id, done),
  deleteMilestone: (id) => invoke<void>(IpcChannel.milestonesDelete, id),
  reorderMilestones: (spaceId, ids) =>
    invoke<Milestone[]>(IpcChannel.milestonesReorder, spaceId, ids),
  setSpaceGoals: (spaceId, goals) => invoke<Space>(IpcChannel.spacesSetGoals, spaceId, goals),
  getProgress: (spaceId) => invoke<ProgressSource>(IpcChannel.progressGet, spaceId),
  getDashboard: () => invoke<DashboardSource>(IpcChannel.dashboardGet),
  getWeeklyReview: () => invoke<WeeklyReview>(IpcChannel.reviewGet),
  getSettings: () => invoke<SettingsSnapshot>(IpcChannel.settingsGet),
  updateSettings: (patch) => invoke<SettingsSnapshot>(IpcChannel.settingsUpdate, patch),
  exportBackup: () => invoke<{ canceled: boolean }>(IpcChannel.backupExport),
  importBackup: () => invoke<{ canceled: boolean }>(IpcChannel.backupImport),
  getBackupStatus: () => invoke<BackupStatus>(IpcChannel.backupStatus),
  showBackupsFolder: () => invoke<void>(IpcChannel.backupShowFolder),
  restoreAutomaticBackup: (name) => invoke<void>(IpcChannel.backupRestore, name),
  startPomodoro: (input) => invoke<PomodoroSnapshot>(IpcChannel.pomodoroStart, input),
  stopPomodoro: () => invoke<void>(IpcChannel.pomodoroStop),
  getPomodoro: () => invoke<PomodoroSnapshot | null>(IpcChannel.pomodoroGet),
  exportData: (format) => invoke<{ canceled: boolean }>(IpcChannel.dataExport, format),
  showDataFolder: () => invoke<void>(IpcChannel.dataFolderShow),
  setWindowChrome: (dark) => invoke<void>(IpcChannel.windowChrome, dark),
  openMiniTimer: () => invoke<void>(IpcChannel.windowMiniOpen),
  closeMiniTimer: () => invoke<void>(IpcChannel.windowMiniClose),
  onTimerChanged: (listener) => subscribe(IpcEvent.timerChanged, listener),
  onSessionsChanged: (listener) => subscribe(IpcEvent.sessionsChanged, listener),
  onIdlePrompt: (listener) => subscribe(IpcEvent.idlePrompt, listener),
  onSessionWrapUp: (listener) => subscribe(IpcEvent.sessionWrapUp, listener),
  onPomodoroComplete: (listener) => subscribe(IpcEvent.pomodoroComplete, listener),
  onBackupUpdated: (listener) => subscribe(IpcEvent.backupUpdated, listener),
  onGoalReached: (listener) => subscribe(IpcEvent.goalReached, listener)
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => {
    listener(payload)
  }
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

if (!process.contextIsolated) {
  throw new Error('GoalTrail requires context isolation.')
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
