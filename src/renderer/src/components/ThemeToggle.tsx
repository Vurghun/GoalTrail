import { Monitor, Moon, Sun } from 'lucide-react'
import type { Theme } from '@shared/theme'

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
]

export function ThemeToggle({
  theme,
  onChange
}: {
  theme: Theme
  onChange: (theme: Theme) => void
}): React.JSX.Element {
  return (
    <div
      className="inline-flex rounded-md border border-border bg-surface p-1"
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.label}
            title={option.label}
            className={`rounded-sm p-1.5 transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              selected ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text'
            }`}
            onClick={() => {
              onChange(option.value)
            }}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        )
      })}
    </div>
  )
}
