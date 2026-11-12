import { DAILY_GOAL_MAX } from '@shared/progress'
import {
  IDLE_PAUSE_CHOICES,
  defaultSettings,
  isAccent,
  isDensity,
  parseSettingsPatch,
  type AppSettings,
  type SettingsSnapshot
} from '@shared/settings'
import { isTheme } from '@shared/theme'
import { app, shell } from 'electron'
import { getDatabase } from './db'

const THEME_KEY = 'theme'
const WEEK_KEY = 'week_starts_on'
const GOAL_KEY = 'daily_goal_min'
const ACCENT_KEY = 'accent'
const DENSITY_KEY = 'density'
const FOCUS_KEY = 'pomodoro_focus_min'
const BREAK_KEY = 'pomodoro_break_min'
const NOTIFY_KEY = 'notifications'
const NUDGE_KEY = 'end_of_day_nudge'
const IDLE_KEY = 'idle_pause_min'
const NUDGE_DATE_KEY = 'nudge_date'

export function getSettings(): SettingsSnapshot {
  const rows = getDatabase()
    .prepare<[], { key: string; value: string }>('SELECT key, value FROM settings')
    .all()
  const stored = new Map(rows.map((row) => [row.key, row.value]))
  const defaults = defaultSettings()
  const themeValue = stored.get(THEME_KEY)
  const weekValue = stored.get(WEEK_KEY)
  const goalValue = stored.get(GOAL_KEY)
  const week = weekValue === undefined ? defaults.weekStartsOn : Number(weekValue)
  const goal = goalValue !== undefined && /^\d+$/.test(goalValue) ? Number(goalValue) : null
  const accentValue = stored.get(ACCENT_KEY)
  const densityValue = stored.get(DENSITY_KEY)
  const focus = readStoredMinutes(stored.get(FOCUS_KEY), defaults.pomodoroFocusMin)
  const breakMin = readStoredMinutes(stored.get(BREAK_KEY), defaults.pomodoroBreakMin)

  return {
    theme: isTheme(themeValue) ? themeValue : defaults.theme,
    weekStartsOn: Number.isInteger(week) && week >= 0 && week <= 6 ? week : defaults.weekStartsOn,
    dailyGoalMin: goal !== null && goal >= 1 && goal <= DAILY_GOAL_MAX ? goal : null,
    accent: isAccent(accentValue) ? accentValue : defaults.accent,
    density: isDensity(densityValue) ? densityValue : defaults.density,
    pomodoroFocusMin: focus,
    pomodoroBreakMin: breakMin,
    notifications: readFlag(stored.get(NOTIFY_KEY), defaults.notifications),
    endOfDayNudge: readFlag(stored.get(NUDGE_KEY), defaults.endOfDayNudge),
    idlePauseMin: readIdle(stored.get(IDLE_KEY), defaults.idlePauseMin),
    themeSaved: isTheme(themeValue)
  }
}

export function updateSettings(input: unknown): SettingsSnapshot {
  const patch = parseSettingsPatch(input)
  const db = getDatabase()
  const write = db.transaction(() => {
    if (patch.theme !== undefined) writeSetting(THEME_KEY, patch.theme)
    if (patch.weekStartsOn !== undefined) writeSetting(WEEK_KEY, String(patch.weekStartsOn))
    if ('dailyGoalMin' in patch) {
      writeSetting(GOAL_KEY, patch.dailyGoalMin === null ? null : String(patch.dailyGoalMin))
    }
    if (patch.accent !== undefined) writeSetting(ACCENT_KEY, patch.accent)
    if (patch.density !== undefined) writeSetting(DENSITY_KEY, patch.density)
    if (patch.pomodoroFocusMin !== undefined) writeSetting(FOCUS_KEY, String(patch.pomodoroFocusMin))
    if (patch.pomodoroBreakMin !== undefined) writeSetting(BREAK_KEY, String(patch.pomodoroBreakMin))
    if (patch.notifications !== undefined) writeSetting(NOTIFY_KEY, patch.notifications ? '1' : '0')
    if (patch.endOfDayNudge !== undefined) writeSetting(NUDGE_KEY, patch.endOfDayNudge ? '1' : '0')
    if ('idlePauseMin' in patch) {
      writeSetting(IDLE_KEY, patch.idlePauseMin === null ? 'off' : String(patch.idlePauseMin))
    }
  })
  write()
  return getSettings()
}

export function showDataFolder(): void {
  void shell.openPath(app.getPath('userData'))
}

export function currentSettings(): AppSettings {
  const snapshot = getSettings()
  return {
    theme: snapshot.theme,
    weekStartsOn: snapshot.weekStartsOn,
    dailyGoalMin: snapshot.dailyGoalMin,
    accent: snapshot.accent,
    density: snapshot.density,
    pomodoroFocusMin: snapshot.pomodoroFocusMin,
    pomodoroBreakMin: snapshot.pomodoroBreakMin,
    notifications: snapshot.notifications,
    endOfDayNudge: snapshot.endOfDayNudge,
    idlePauseMin: snapshot.idlePauseMin
  }
}

export function getNudgeDate(): string | null {
  const value = readSetting(NUDGE_DATE_KEY)
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export function setNudgeDate(date: string): void {
  writeSetting(NUDGE_DATE_KEY, date)
}

function readFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === '1') return true
  if (value === '0') return false
  return fallback
}

function readIdle(value: string | undefined, fallback: number | null): number | null {
  if (value === undefined) return fallback
  if (value === 'off') return null
  if (!/^\d+$/.test(value)) return fallback
  const minutes = Number(value)
  return (IDLE_PAUSE_CHOICES as readonly number[]).includes(minutes) ? minutes : fallback
}

function readSetting(key: string): string | undefined {
  const row = getDatabase()
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get(key)
  return row?.value
}

function readStoredMinutes(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d+$/.test(value)) return fallback
  const minutes = Number(value)
  return minutes >= 1 && minutes <= 120 ? minutes : fallback
}

function writeSetting(key: string, value: string | null): void {
  const db = getDatabase()
  if (value === null) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    return
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}
