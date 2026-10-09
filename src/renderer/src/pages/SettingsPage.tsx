import { useEffect, useState } from 'react'
import { ACCENTS, WEEKDAY_LABELS, type Accent } from '@shared/settings'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { ThemeToggle } from '@renderer/components/ThemeToggle'
import { useSettings } from '@renderer/hooks/useSettings'
import { fieldClass } from '@renderer/components/ui/styles'
import { errorMessage } from '@renderer/lib/errors'
import { pushToast } from '@renderer/lib/toast'
import { storeTheme } from '@renderer/lib/theme'

export function SettingsPage(): React.JSX.Element {
  const { settings, update } = useSettings()
  const [databasePath, setDatabasePath] = useState<string | null>(null)
  const [goal, setGoal] = useState<string | null>(null)
  const goalText = goal ?? (settings.dailyGoalMin === null ? '' : String(settings.dailyGoalMin))
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const [section, setSection] = useState<'appearance' | 'timer' | 'data' | 'about'>('appearance')
  const [version, setVersion] = useState('0.1.0')

  useEffect(() => {
    let active = true
    void window.api.getAppInfo().then((info) => {
      if (!active) return
      setDatabasePath(info.databasePath)
      setVersion(info.version)
    })
    return () => {
      active = false
    }
  }, [])

  async function save(patch: Parameters<typeof update>[0]): Promise<boolean> {
    setError(null)
    setMessage(null)
    try {
      await update(patch)
      return true
    } catch (reason) {
      setError(errorMessage(reason))
      return false
    }
  }

  async function onExport(): Promise<void> {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.exportBackup()
      if (!result.canceled) {
        setMessage('Backup saved.')
        pushToast('Backup saved')
      }
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function onImport(): Promise<void> {
    setConfirmImport(false)
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.importBackup()
      if (result.canceled) return
      const next = await window.api.getSettings()
      storeTheme(next.theme)
      window.location.reload()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function onExportTable(format: 'json' | 'csv'): Promise<void> {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.exportData(format)
      if (!result.canceled) {
        setMessage(format === 'json' ? 'JSON export saved.' : 'CSV export saved.')
        pushToast('Export saved')
      }
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const sections = [
    ['appearance', 'Appearance'],
    ['timer', 'Timer'],
    ['data', 'Data'],
    ['about', 'About']
  ] as const

  return (
    <div className="mx-auto grid w-full max-w-[960px] gap-8 px-6 py-8 lg:grid-cols-[180px_minmax(0,1fr)]">
      <nav className="flex gap-1 lg:sticky lg:top-6 lg:flex-col lg:self-start" aria-label="Settings">
        {sections.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-md px-3 py-2 text-left text-sm ${section === id ? 'bg-accent-soft font-medium text-text' : 'text-muted hover:bg-accent-soft'}`}
            onClick={() => {
              setSection(id)
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">How GoalTrail looks, times, and keeps your data.</p>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Theme, week, and a copy of everything on this computer.
        </p>
      </div>

      {section === 'appearance' ? (
      <section className="space-y-5 rounded-lg border border-border bg-surface p-5 shadow-card">
        <Setting label="Theme" help="Follow the system, or pick light or dark.">
          <ThemeToggle
            theme={settings.theme}
            onChange={(next) => {
              void save({ theme: next })
            }}
          />
        </Setting>
        <Setting label="Accent" help="Used for buttons, focus, and the activity heatmap.">
          <div className="flex gap-2">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                aria-label={accent}
                aria-pressed={settings.accent === accent}
                className={`h-8 w-8 rounded-full ${settings.accent === accent ? 'ring-2 ring-offset-2 ring-offset-surface ring-text' : ''}`}
                style={{ background: accentColor(accent) }}
                onClick={() => {
                  void save({ accent })
                }}
              />
            ))}
          </div>
        </Setting>
        <Setting label="Density" help="Compact tightens card padding.">
          <div className="flex gap-2">
            {(['comfortable', 'compact'] as const).map((density) => (
              <button
                key={density}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm capitalize ${settings.density === density ? 'border-accent bg-accent-soft' : 'border-border'}`}
                onClick={() => {
                  void save({ density })
                }}
              >
                {density}
              </button>
            ))}
          </div>
        </Setting>
      </section>
      ) : null}

      {section === 'timer' ? (
      <section className="space-y-5 rounded-lg border border-border bg-surface p-5 shadow-card">

        <Setting label="Week starts on" help="Used for weekly totals and streaks.">
        <select
          className={fieldClass}
          value={settings.weekStartsOn}
          onChange={(event) => {
            void save({ weekStartsOn: Number(event.target.value) })
          }}
        >
          {WEEKDAY_LABELS.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
        </Setting>
        <Setting label="Default daily goal" help="New spaces start with this many minutes. Existing spaces stay as they are.">
        <input
          className={fieldClass}
          inputMode="numeric"
          placeholder="None"
          value={goalText}
          onChange={(event) => {
            setGoal(event.target.value)
          }}
          onBlur={() => {
            const raw = goalText.trim()
            void save({ dailyGoalMin: raw === '' ? null : Number(raw) }).then((saved) => {
              if (saved) setGoal(null)
            })
          }}
        />
        </Setting>
        <Setting label="Pomodoro focus" help="Shown as a ring in Focus mode.">
          <input
            className={fieldClass}
            inputMode="numeric"
            value={settings.pomodoroFocusMin}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isInteger(value)) void save({ pomodoroFocusMin: value })
            }}
          />
        </Setting>
        <Setting label="Pomodoro break" help="The short rest after a focus block.">
          <input
            className={fieldClass}
            inputMode="numeric"
            value={settings.pomodoroBreakMin}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isInteger(value)) void save({ pomodoroBreakMin: value })
            }}
          />
        </Setting>
      </section>
      ) : null}

      {section === 'data' ? (
      <section className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-card">
        <Setting label="Backup" help="A full copy of spaces, notes, and time. Import replaces everything on this computer.">
        <p className="break-all text-sm text-muted">{databasePath ?? 'Looking up the folder…'}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent-soft"
            onClick={() => {
              void window.api.showDataFolder()
            }}
          >
            Open folder
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:text-[#14161c]"
            disabled={busy}
            onClick={() => {
              void onExport()
            }}
          >
            Export backup
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent-soft disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              setConfirmImport(true)
            }}
          >
            Import backup
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent-soft disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              void onExportTable('json')
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent-soft disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              void onExportTable('csv')
            }}
          >
            Export CSV
          </button>
        </div>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        </Setting>
      </section>
      ) : null}

      {section === 'about' ? (
        <section className="space-y-2 rounded-lg border border-border bg-surface p-5 shadow-card">
          <h2 className="text-sm font-medium">GoalTrail {version}</h2>
          <p className="text-sm text-muted">
            A local study tracker. Your database never leaves this computer unless you export it.
          </p>
          <p className="text-sm text-muted">Made by GoalTrail contributors.</p>
        </section>
      ) : null}

      {confirmImport ? (
        <ConfirmDialog
          title="Replace all data?"
          body="Importing a backup replaces every space, note, and time entry on this computer."
          confirmLabel="Import"
          onConfirm={() => {
            void onImport()
          }}
          onCancel={() => {
            setConfirmImport(false)
          }}
        />
      ) : null}
      </div>
    </div>
  )
}

function Setting({
  label,
  help,
  children
}: {
  label: string
  help: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted">{help}</p>
      </div>
      {children}
    </div>
  )
}

function accentColor(accent: Accent): string {
  if (accent === 'emerald') return '#047857'
  if (accent === 'rose') return '#be123c'
  if (accent === 'amber') return '#b45309'
  return '#4f46e5'
}
