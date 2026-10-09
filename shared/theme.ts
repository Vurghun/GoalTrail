export const THEMES = ['light', 'dark', 'system'] as const

export type Theme = (typeof THEMES)[number]

/** Keep this key identical to the inline script in src/renderer/index.html. */
export const THEME_STORAGE_KEY = 'goaltrail.theme'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}
