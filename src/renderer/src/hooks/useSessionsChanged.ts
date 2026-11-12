import { useEffect, useRef } from 'react'

export function useSessionsChanged(onChange: () => void): void {
  const saved = useRef(onChange)
  useEffect(() => {
    saved.current = onChange
  }, [onChange])
  useEffect(() => {
    return window.api.onSessionsChanged(() => {
      saved.current()
    })
  }, [])
}
