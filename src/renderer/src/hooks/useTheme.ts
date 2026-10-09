import { useEffect, useState } from 'react'
import type { Theme } from '@shared/theme'
import { applyTheme, readStoredTheme, storeTheme } from '@renderer/lib/theme'

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    storeTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      applyTheme('system')
    }

    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [theme])

  return { theme, setTheme }
}
