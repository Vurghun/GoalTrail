import { useEffect, useState } from 'react'
import { subscribeToasts } from '@renderer/lib/toast'

export function ToastHost(): React.JSX.Element | null {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToasts((next) => {
      setMessage(next)
    })
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => {
      setMessage(null)
    }, 2400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [message])

  if (!message) return null

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40">
      <p
        role="status"
        className="rise rounded-md border border-border bg-raised px-4 py-2.5 text-sm font-medium text-text shadow-card"
      >
        {message}
      </p>
    </div>
  )
}
