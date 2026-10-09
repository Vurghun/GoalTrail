import { isTheme, THEME_STORAGE_KEY, type Theme } from '@shared/theme'

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme): void {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  document.documentElement.classList.toggle('dark', dark)
  void window.api?.setWindowChrome(dark).catch(() => {
    /* Chrome styling is optional when the preload bridge is unavailable. */
  })
}

export function storeTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}
