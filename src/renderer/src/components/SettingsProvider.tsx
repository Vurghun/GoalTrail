import { useEffect, useState, type ReactNode } from 'react'
import { defaultSettings, type Accent, type AppSettings, type Density } from '@shared/settings'
import type { Theme } from '@shared/theme'
import { SettingsContext } from '@renderer/hooks/useSettings'
import { errorMessage } from '@renderer/lib/errors'
import { readStoredTheme } from '@renderer/lib/theme'

export function SettingsProvider({
  setTheme,
  children
}: {
  setTheme: (theme: Theme) => void
  children: ReactNode
}): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.api
      .getSettings()
      .then((snapshot) => {
        if (!active) return
        if (snapshot.themeSaved) {
          setTheme(snapshot.theme)
          setSettings(snapshot)
          applyAppearance(snapshot.accent, snapshot.density)
          return
        }
        const theme = readStoredTheme()
        setTheme(theme)
        void window.api.updateSettings({ theme }).then((saved) => {
          if (!active) return
          setSettings(saved)
          applyAppearance(saved.accent, saved.density)
        })
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason))
      })
    return () => {
      active = false
    }
  }, [setTheme])

  async function update(patch: Partial<AppSettings>): Promise<void> {
    const saved = await window.api.updateSettings(patch)
    setSettings(saved)
    applyAppearance(saved.accent, saved.density)
    if (patch.theme) setTheme(saved.theme)
  }

  return (
    <SettingsContext.Provider value={{ settings, error, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

function applyAppearance(accent: Accent, density: Density): void {
  document.documentElement.dataset.accent = accent
  document.documentElement.dataset.density = density
  localStorage.setItem('goaltrail.accent', accent)
  localStorage.setItem('goaltrail.density', density)
}
