import { createContext, useContext } from 'react'
import type { AppSettings } from '@shared/settings'

export interface SettingsContextValue {
  settings: AppSettings
  error: string | null
  update: (patch: Partial<AppSettings>) => Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('Settings are unavailable.')
  return value
}
