import { useEffect } from 'react'

const BITS = [
  ['-80px', '-70px'],
  ['70px', '-80px'],
  ['-40px', '60px'],
  ['90px', '30px'],
  ['10px', '-90px'],
  ['-90px', '20px']
]

export function Celebration({
  message,
  onDone
}: {
  message: string
  onDone: () => void
}): React.JSX.Element {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [onDone])

  return (
    <div className="celebrate pointer-events-none fixed inset-0 z-50" role="status">
      {BITS.map(([x, y], index) => (
        <i
          key={index}
          style={{ ['--x' as string]: x, ['--y' as string]: y, background: 'var(--text)' }}
        />
      ))}
      <p className="rise absolute top-1/3 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium shadow-card">
        {message}
      </p>
    </div>
  )
}
