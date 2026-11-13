import type {
  Note,
  NoteDraft,
  NoteSearchHit,
  NoteSearchQuery,
  NoteSummary,
  SavedNoteImage
} from './notes'
import type { BackupStatus } from './backup'
import type { DashboardSource } from './dashboard'
import type { IdlePrompt } from './idle'
import type { PomodoroComplete, PomodoroSnapshot, PomodoroStart } from './pomodoro'
import type { AppSettings, SettingsSnapshot } from './settings'
import type { Milestone, ProgressSource, SpaceGoals } from './progress'
import type { Space, SpaceDraft } from './spaces'
import type { Session, SessionDraft } from './time'

export const APP_NAME = 'GoalTrail'

export const IpcChannel = {
  appGetInfo: 'app:get-info',
  spacesList: 'spaces:list',
  spacesCreate: 'spaces:create',
  spacesUpdate: 'spaces:update',
  spacesDelete: 'spaces:delete',
  spacesReorder: 'spaces:reorder',
  timerGet: 'timer:get',
  timerStart: 'timer:start',
  timerPause: 'timer:pause',
  timerStop: 'timer:stop',
  timerDiscardIdle: 'timer:discard-idle',
  sessionsList: 'sessions:list',
  sessionsCreate: 'sessions:create',
  sessionsUpdate: 'sessions:update',
  sessionsDelete: 'sessions:delete',
  sessionsSetNote: 'sessions:set-note',
  notesList: 'notes:list',
  notesGet: 'notes:get',
  notesCreate: 'notes:create',
  notesUpdate: 'notes:update',
  notesSetPinned: 'notes:set-pinned',
  notesDelete: 'notes:delete',
  notesSaveImage: 'notes:save-image',
  notesSearch: 'notes:search',
  notesListTags: 'notes:list-tags',
  milestonesList: 'milestones:list',
  milestonesCreate: 'milestones:create',
  milestonesUpdate: 'milestones:update',
  milestonesSetDone: 'milestones:set-done',
  milestonesDelete: 'milestones:delete',
  milestonesReorder: 'milestones:reorder',
  spacesSetGoals: 'spaces:set-goals',
  progressGet: 'progress:get',
  dashboardGet: 'dashboard:get',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  backupExport: 'backup:export',
  backupImport: 'backup:import',
  backupStatus: 'backup:status',
  backupShowFolder: 'backup:show-folder',
  backupRestore: 'backup:restore',
  pomodoroStart: 'pomodoro:start',
  pomodoroStop: 'pomodoro:stop',
  pomodoroGet: 'pomodoro:get',
  dataExport: 'data:export',
  dataFolderShow: 'data-folder:show',
  windowChrome: 'window:chrome',
  windowMiniOpen: 'window:mini-open',
  windowMiniClose: 'window:mini-close'
} as const

export const IpcEvent = {
  timerChanged: 'timer:changed',
  sessionsChanged: 'sessions:changed',
  idlePrompt: 'idle:prompt',
  sessionWrapUp: 'session:wrap-up',
  pomodoroComplete: 'pomodoro:complete',
  backupUpdated: 'backup:updated',
  goalReached: 'goal:reached'
} as const

export interface GoalReached {
  spaceName: string
}

export interface SessionWrapUp {
  id: string
  spaceId: string
  spaceName: string
  durationSec: number
}

export interface AppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  databasePath: string
}

export interface GoalTrailApi {
  getAppInfo: () => Promise<AppInfo>
  listSpaces: () => Promise<Space[]>
  createSpace: (draft: SpaceDraft) => Promise<Space>
  updateSpace: (id: string, draft: SpaceDraft) => Promise<Space>
  deleteSpace: (id: string) => Promise<void>
  reorderSpaces: (ids: string[]) => Promise<Space[]>
  getTimer: () => Promise<Session | null>
  startTimer: (spaceId: string) => Promise<Session>
  pauseTimer: () => Promise<Session>
  stopTimer: () => Promise<Session | null>
  discardIdle: (sessionId: string, idleSec: number) => Promise<Session | null>
  setSessionNote: (id: string, note: string) => Promise<Session>
  listSessions: (spaceId: string) => Promise<Session[]>
  createSession: (spaceId: string, draft: SessionDraft) => Promise<Session>
  updateSession: (id: string, draft: SessionDraft) => Promise<Session>
  deleteSession: (id: string) => Promise<void>
  listNotes: (spaceId: string) => Promise<NoteSummary[]>
  getNote: (id: string) => Promise<Note>
  createNote: (spaceId: string) => Promise<Note>
  updateNote: (id: string, draft: NoteDraft) => Promise<Note>
  setNotePinned: (id: string, pinned: boolean) => Promise<Note>
  deleteNote: (id: string) => Promise<void>
  saveNoteImage: (noteId: string, bytes: Uint8Array, mime: string) => Promise<SavedNoteImage>
  searchNotes: (query: NoteSearchQuery) => Promise<NoteSearchHit[]>
  listTags: () => Promise<string[]>
  listMilestones: (spaceId: string) => Promise<Milestone[]>
  createMilestone: (spaceId: string, title: string) => Promise<Milestone>
  updateMilestone: (id: string, title: string) => Promise<Milestone>
  setMilestoneDone: (id: string, done: boolean) => Promise<Milestone>
  deleteMilestone: (id: string) => Promise<void>
  reorderMilestones: (spaceId: string, ids: string[]) => Promise<Milestone[]>
  setSpaceGoals: (spaceId: string, goals: SpaceGoals) => Promise<Space>
  getProgress: (spaceId: string) => Promise<ProgressSource>
  getDashboard: () => Promise<DashboardSource>
  getSettings: () => Promise<SettingsSnapshot>
  updateSettings: (patch: Partial<AppSettings>) => Promise<SettingsSnapshot>
  exportBackup: () => Promise<{ canceled: boolean }>
  importBackup: () => Promise<{ canceled: boolean }>
  getBackupStatus: () => Promise<BackupStatus>
  showBackupsFolder: () => Promise<void>
  restoreAutomaticBackup: (name: string) => Promise<void>
  startPomodoro: (input: PomodoroStart) => Promise<PomodoroSnapshot>
  stopPomodoro: () => Promise<void>
  getPomodoro: () => Promise<PomodoroSnapshot | null>
  exportData: (format: 'json' | 'csv') => Promise<{ canceled: boolean }>
  showDataFolder: () => Promise<void>
  setWindowChrome: (dark: boolean) => Promise<void>
  openMiniTimer: () => Promise<void>
  closeMiniTimer: () => Promise<void>
  onTimerChanged: (listener: () => void) => () => void
  onSessionsChanged: (listener: () => void) => () => void
  onIdlePrompt: (listener: (prompt: IdlePrompt) => void) => () => void
  onSessionWrapUp: (listener: (session: SessionWrapUp) => void) => () => void
  onPomodoroComplete: (listener: (event: PomodoroComplete) => void) => () => void
  onBackupUpdated: (listener: (status: BackupStatus) => void) => () => void
  onGoalReached: (listener: (goal: GoalReached) => void) => () => void
}
