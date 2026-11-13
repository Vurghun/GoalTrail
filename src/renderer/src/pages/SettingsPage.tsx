import { useEffect, useState } from 'react'
import { ACCENTS, IDLE_PAUSE_CHOICES, WEEKDAY_LABELS, type Accent } from '@shared/settings'
import type { AutomaticBackup, BackupStatus } from '@shared/backup'
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
  const [pendingBackup, setPendingBackup] = useState<AutomaticBackup | null>(null)
  const [section, setSection] = useState<'appearance' | 'timer' | 'data' | 'about'>('appearance')
  const [version, setVersion] = useState('0.1.0')
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null)

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

  useEffect(() => {
    let active = true
    const apply = (status: BackupStatus): void => {
      if (active) setBackupStatus(status)
    }
    void window.api.getBackupStatus().then(apply)
    const off = window.api.onBackupUpdated(apply)
    return () => {
      active = false
      off()
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
    const chosen = pendingBackup
    setConfirmImport(false)
    setPendingBackup(null)
    setBusy(true)
    setError(null)
    try {
      if (chosen) {
        await window.api.restoreAutomaticBackup(chosen.name)
      } else {
        const result = await window.api.importBackup()
        if (result.canceled) return
      }
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
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

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

        <Setting
          label="Week starts on"
          help="Used for weekly totals, the streak week, and the activity grid."
        >
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
        <Setting label="Pomodoro focus" help="Shown as a ring in Focus mode. Saved when you leave the field.">
          <MinutesField
            label="Pomodoro focus minutes"
            value={settings.pomodoroFocusMin}
            onCommit={(minutes) => save({ pomodoroFocusMin: minutes })}
          />
        </Setting>
        <Setting label="Pomodoro break" help="The short rest after a focus block. Saved when you leave the field.">
          <MinutesField
            label="Pomodoro break minutes"
            value={settings.pomodoroBreakMin}
            onCommit={(minutes) => save({ pomodoroBreakMin: minutes })}
          />
        </Setting>
        <Setting
          label="Pause when away"
          help="If you step away during a session, the timer pauses and asks whether to keep that time."
        >
          <select
            className={fieldClass}
            value={settings.idlePauseMin === null ? 'off' : String(settings.idlePauseMin)}
            onChange={(event) => {
              const value = event.target.value
              void save({ idlePauseMin: value === 'off' ? null : Number(value) })
            }}
          >
            <option value="off">Off</option>
            {IDLE_PAUSE_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </Setting>
        <Setting
          label="Desktop notifications"
          help="When a focus block or break ends, when a daily goal is reached, and when the timer pauses because you stepped away."
        >
          <Switch
            label="Desktop notifications"
            checked={settings.notifications}
            onChange={(next) => {
              void save({ notifications: next })
            }}
          />
        </Setting>
        <Setting
          label="End-of-day reminder"
          help="Around 8:00 PM, one quiet note if today's goal is still open and the timer is stopped."
        >
          <Switch
            label="End-of-day reminder"
            checked={settings.endOfDayNudge}
            disabled={!settings.notifications}
            onChange={(next) => {
              void save({ endOfDayNudge: next })
            }}
          />
        </Setting>
      </section>
      ) : null}

      {section === 'data' ? (
      <section className="space-y-5 rounded-lg border border-border bg-surface p-5 shadow-card">
        <Setting
          label="Automatic backups"
          help="About once a day, GoalTrail saves a zip in a backups folder on this computer and keeps the latest 7. Restore one here, or keep using manual export and import."
        >
          <p className="break-all text-sm text-muted">
            {backupStatus?.directory ?? 'Looking up the folder…'}
          </p>
          <p className="text-sm text-muted">
            {backupStatus?.lastBackupAt
              ? `Last backup ${formatBackupWhen(backupStatus.lastBackupAt)}.`
              : 'No automatic backup yet.'}
          </p>
          {backupStatus && backupStatus.backups.length > 0 ? (
            <ul className="space-y-2">
              {backupStatus.backups.map((backup) => (
                <li
                  key={backup.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm">
                    {formatBackupWhen(backup.modifiedAt)}
                    <span className="text-muted"> · {formatBytes(backup.bytes)}</span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent-soft disabled:opacity-50"
                    disabled={busy}
                    onClick={() => {
                      setPendingBackup(backup)
                      setConfirmImport(true)
                    }}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent-soft"
            onClick={() => {
              void window.api.showBackupsFolder()
            }}
          >
            Open backups folder
          </button>
        </Setting>
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
              setPendingBackup(null)
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
          body={
            pendingBackup
              ? `Restoring the backup from ${formatBackupWhen(pendingBackup.modifiedAt)} replaces every space, note, and time entry on this computer.`
              : 'Importing a backup replaces every space, note, and time entry on this computer.'
          }
          confirmLabel={pendingBackup ? 'Restore' : 'Import'}
          onConfirm={() => {
            void onImport()
          }}
          onCancel={() => {
            setConfirmImport(false)
            setPendingBackup(null)
          }}
        />
      ) : null}
      </div>
    </div>
  )
}

function MinutesField({
  value,
  label,
  onCommit
}: {
  value: number
  label: string
  onCommit: (minutes: number) => Promise<boolean>
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(value)

  function commit(current: string): void {
    const raw = current.trim()
    const clearIfCurrent = (): void => {
      setDraft((existing) => (existing === current ? null : existing))
    }
    if (raw === String(value)) {
      clearIfCurrent()
      return
    }
    void onCommit(Number(raw)).then((saved) => {
      if (saved) clearIfCurrent()
    })
  }

  return (
    <input
      className={fieldClass}
      inputMode="numeric"
      aria-label={label}
      value={shown}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={(event) => {
        commit(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.currentTarget.blur()
      }}
    />
  )
}

function formatBackupWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Switch({
  label,
  checked,
  disabled = false,
  onChange
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition duration-150 ${checked ? 'bg-accent' : 'bg-line'} disabled:opacity-50`}
      onClick={() => {
        onChange(!checked)
      }}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition duration-150 ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
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
