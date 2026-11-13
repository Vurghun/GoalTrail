export const SPACE_STATUSES = ['active', 'paused', 'completed', 'archived'] as const

export type SpaceStatus = (typeof SPACE_STATUSES)[number]

export const SPACE_STATUS_LABELS: Record<SpaceStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived'
}

export const SPACE_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#ca8a04',
  '#475569'
] as const

export const SPACE_NAME_MAX = 80
export const SPACE_DESCRIPTION_MAX = 2000
export const SPACE_ICON_MAX = 16
export const SPACE_HOURS_MAX = 100_000

export interface Space {
  id: string
  name: string
  description: string
  color: string
  icon: string
  status: SpaceStatus
  targetHours: number | null
  targetDate: string | null
  dailyGoalMin: number | null
  weeklyGoalMin: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SpaceDraft {
  name: string
  description: string
  color: string
  icon: string
  status: SpaceStatus
  targetHours: number | null
  targetDate: string | null
}

export function emptySpaceDraft(): SpaceDraft {
  return {
    name: '',
    description: '',
    color: '#111111',
    icon: 'target',
    status: 'active',
    targetHours: null,
    targetDate: null
  }
}

export function toSpaceDraft(space: Space): SpaceDraft {
  return {
    name: space.name,
    description: space.description,
    color: space.color,
    icon: space.icon,
    status: space.status,
    targetHours: space.targetHours,
    targetDate: space.targetDate
  }
}

export function isSpaceStatus(value: unknown): value is SpaceStatus {
  return typeof value === 'string' && (SPACE_STATUSES as readonly string[]).includes(value)
}

export function parseSpaceDraft(input: unknown): SpaceDraft {
  if (!isRecord(input)) throw new Error('Space details are invalid.')

  const name = readString(input.name, 'Name')
  const trimmedName = name.trim()
  if (trimmedName.length === 0) throw new Error('Name is required.')
  if ([...trimmedName].length > SPACE_NAME_MAX) {
    throw new Error(`Name must be ${SPACE_NAME_MAX} characters or fewer.`)
  }

  const description = readString(input.description, 'Description').trim()
  if ([...description].length > SPACE_DESCRIPTION_MAX) {
    throw new Error(`Description must be ${SPACE_DESCRIPTION_MAX} characters or fewer.`)
  }

  const icon = readString(input.icon, 'Icon').trim()
  if (icon.length === 0) throw new Error('Add an icon.')
  if ([...icon].length > SPACE_ICON_MAX) throw new Error('Icon is too long.')

  const color = readString(input.color, 'Color').trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(color)) throw new Error('Choose a color.')

  if (!isSpaceStatus(input.status)) throw new Error('Choose a status.')

  return {
    name: trimmedName,
    description,
    color,
    icon,
    status: input.status,
    targetHours: readTargetHours(input.targetHours),
    targetDate: readTargetDate(input.targetDate)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} is invalid.`)
  return value
}

function readTargetHours(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Target hours must be a number.')
  }
  if (value < 0 || value > SPACE_HOURS_MAX) {
    throw new Error(`Target hours must be between 0 and ${SPACE_HOURS_MAX}.`)
  }
  return Math.round(value * 100) / 100
}

function readTargetDate(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('Target date is invalid.')
  const date = value.trim()
  if (date.length === 0) return null
  if (!isRealIsoDate(date)) throw new Error('Target date must be a real calendar date.')
  return date
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}
