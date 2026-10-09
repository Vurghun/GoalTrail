import { DAILY_GOAL_MAX } from './progress'
import { isTheme, type Theme } from './theme'
import { WEEK_STARTS_ON } from './time'

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const

export const ACCENTS = ['indigo', 'emerald', 'rose', 'amber'] as const
export type Accent = (typeof ACCENTS)[number]

export const DENSITIES = ['comfortable', 'compact'] as const
export type Density = (typeof DENSITIES)[number]

export interface AppSettings {
  theme: Theme
  weekStartsOn: number
  dailyGoalMin: number | null
  accent: Accent
  density: Density
  pomodoroFocusMin: number
  pomodoroBreakMin: number
}

export interface SettingsSnapshot extends AppSettings {
  themeSaved: boolean
}

export function defaultSettings(): AppSettings {
  return {
    theme: 'system',
    weekStartsOn: WEEK_STARTS_ON,
    dailyGoalMin: null,
    accent: 'indigo',
    density: 'comfortable',
    pomodoroFocusMin: 25,
    pomodoroBreakMin: 5
  }
}

export function isAccent(value: unknown): value is Accent {
  return typeof value === 'string' && (ACCENTS as readonly string[]).includes(value)
}

export function isDensity(value: unknown): value is Density {
  return typeof value === 'string' && (DENSITIES as readonly string[]).includes(value)
}

export function parseSettingsPatch(input: unknown): Partial<AppSettings> {
  if (!isRecord(input)) throw new Error('Settings are invalid.')
  const patch: Partial<AppSettings> = {}

  if ('theme' in input) {
    if (!isTheme(input.theme)) throw new Error('Choose a theme.')
    patch.theme = input.theme
  }

  if ('weekStartsOn' in input) {
    if (
      typeof input.weekStartsOn !== 'number' ||
      !Number.isInteger(input.weekStartsOn) ||
      input.weekStartsOn < 0 ||
      input.weekStartsOn > 6
    ) {
      throw new Error('Choose a week start day.')
    }
    patch.weekStartsOn = input.weekStartsOn
  }

  if ('dailyGoalMin' in input) {
    if (input.dailyGoalMin === null) {
      patch.dailyGoalMin = null
    } else if (
      typeof input.dailyGoalMin !== 'number' ||
      !Number.isInteger(input.dailyGoalMin) ||
      input.dailyGoalMin < 1 ||
      input.dailyGoalMin > DAILY_GOAL_MAX
    ) {
      throw new Error(`Default daily goal must be between 1 and ${DAILY_GOAL_MAX} minutes.`)
    } else {
      patch.dailyGoalMin = input.dailyGoalMin
    }
  }

  if ('accent' in input) {
    if (!isAccent(input.accent)) throw new Error('Choose an accent color.')
    patch.accent = input.accent
  }

  if ('density' in input) {
    if (!isDensity(input.density)) throw new Error('Choose a density.')
    patch.density = input.density
  }

  if ('pomodoroFocusMin' in input) {
    patch.pomodoroFocusMin = readMinutes(input.pomodoroFocusMin, 'Focus length')
  }

  if ('pomodoroBreakMin' in input) {
    patch.pomodoroBreakMin = readMinutes(input.pomodoroBreakMin, 'Break length')
  }

  return patch
}

function readMinutes(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 120) {
    throw new Error(`${label} must be between 1 and 120 minutes.`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
