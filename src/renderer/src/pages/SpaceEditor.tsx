import { useState } from 'react'
import { Check } from 'lucide-react'
import {
  SPACE_COLORS,
  SPACE_DESCRIPTION_MAX,
  SPACE_ICON_MAX,
  SPACE_NAME_MAX,
  SPACE_STATUS_LABELS,
  SPACE_STATUSES,
  parseSpaceDraft,
  type SpaceDraft,
  type SpaceStatus
} from '@shared/spaces'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { Button } from '@renderer/components/ui/Button'
import { IconTile } from '@renderer/components/ui/IconTile'
import { SPACE_ICON_OPTIONS } from '@renderer/components/ui/icons'
import { fieldClass, labelClass } from '@renderer/components/ui/styles'
import { errorMessage } from '@renderer/lib/errors'
import { pushToast } from '@renderer/lib/toast'

interface SpaceEditorProps {
  mode: 'create' | 'edit'
  embedded?: boolean
  initial: SpaceDraft
  onSubmit: (draft: SpaceDraft) => Promise<void>
  onDelete?: () => Promise<void>
}

const INK_COLORS = ['#111111', '#525252', '#a3a3a3'] as const

export function SpaceEditor({
  mode,
  embedded = false,
  initial,
  onSubmit,
  onDelete
}: SpaceEditorProps): React.JSX.Element {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [icon, setIcon] = useState(initial.icon)
  const [color, setColor] = useState(initial.color)
  const [status, setStatus] = useState<SpaceStatus>(initial.status)
  const [targetHours, setTargetHours] = useState(
    initial.targetHours === null ? '' : String(initial.targetHours)
  )
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function submit(nextStatus: SpaceStatus = status): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const hours = targetHours.trim()
      const draft = parseSpaceDraft({
        name,
        description,
        icon,
        color,
        status: nextStatus,
        targetHours: hours === '' ? null : Number(hours),
        targetDate: targetDate.trim() === '' ? null : targetDate
      })
      await onSubmit(draft)
      pushToast(
        mode === 'create'
          ? 'Space created'
          : nextStatus === 'archived' && status !== 'archived'
            ? 'Space archived'
            : status === 'archived' && nextStatus !== 'archived'
              ? 'Space restored'
              : 'Space saved'
      )
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  const dirty =
    name !== initial.name ||
    description !== initial.description ||
    icon !== initial.icon ||
    color !== initial.color ||
    status !== initial.status ||
    (targetHours.trim() === '' ? null : Number(targetHours)) !== initial.targetHours ||
    (targetDate.trim() === '' ? null : targetDate) !== initial.targetDate

  return (
    <main className={embedded ? '' : 'mx-auto flex w-full max-w-[720px] flex-col gap-6 px-6 py-8'}>
      {embedded ? null : (
        <div className="flex items-center gap-3">
          <IconTile icon={icon || 'target'} color={color} size="lg" />
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">New space</h1>
            <p className="text-sm text-muted">A space is one goal or subject.</p>
          </div>
        </div>
      )}

      <form
        className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-card"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {dirty && mode === 'edit' ? <p className="text-xs text-warning">Unsaved changes</p> : null}
        <label className="block text-sm">
          <span className={labelClass}>Name</span>
          <input
            className={fieldClass}
            value={name}
            maxLength={SPACE_NAME_MAX}
            autoComplete="off"
            required
            onChange={(event) => {
              setName(event.target.value)
            }}
          />
        </label>

        <label className="block text-sm">
          <span className={labelClass}>Description</span>
          <textarea
            className={fieldClass}
            value={description}
            maxLength={SPACE_DESCRIPTION_MAX}
            rows={4}
            placeholder="What are you working toward?"
            onChange={(event) => {
              setDescription(event.target.value)
            }}
          />
        </label>

        <div className="text-sm">
          <span className={labelClass}>Icon</span>
          <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Icon">
            {SPACE_ICON_OPTIONS.map((option) => {
              const selected = icon === option.id
              const Icon = option.icon
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  aria-selected={selected}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border transition duration-150 ${
                    selected
                      ? 'border-text bg-text text-surface'
                      : 'border-border text-muted hover:border-line hover:text-text'
                  }`}
                  onClick={() => {
                    setIcon(option.id)
                  }}
                >
                  <Icon size={15} strokeWidth={1.75} />
                </button>
              )
            })}
          </div>
          <input
            className={`${fieldClass} mt-2`}
            value={icon}
            maxLength={SPACE_ICON_MAX}
            aria-label="Custom icon or emoji"
            placeholder="Or type an emoji"
            onChange={(event) => {
              setIcon(event.target.value)
            }}
          />
        </div>
        <div className="text-sm">
          <span className={labelClass}>Color</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {[...INK_COLORS, ...SPACE_COLORS].map((swatch) => {
              const selected = swatch === color
              return (
                <button
                  key={swatch}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={swatch}
                  className={`flex h-6 w-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-text ${
                    selected ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''
                  }`}
                  style={{ backgroundColor: swatch }}
                  onClick={() => {
                    setColor(swatch)
                  }}
                >
                  {selected ? <Check size={12} className="text-white" /> : null}
                </button>
              )
            })}
          </div>
        </div>

        {embedded ? null : (
          <label className="block text-sm">
            <span className={labelClass}>Status</span>
            <select
              className={fieldClass}
              value={status}
              onChange={(event) => {
                const next = event.target.value
                if (isStatus(next)) setStatus(next)
              }}
            >
              {SPACE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {SPACE_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={labelClass}>Target hours</span>
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.25"
              value={targetHours}
              placeholder="Optional"
              onChange={(event) => {
                setTargetHours(event.target.value)
              }}
            />
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Target date</span>
            <input
              className={fieldClass}
              type="date"
              value={targetDate}
              onChange={(event) => {
                setTargetDate(event.target.value)
              }}
            />
          </label>
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" disabled={saving || (mode === 'edit' && !dirty)}>
            {mode === 'create' ? 'Create space' : 'Save'}
          </Button>
          {mode === 'edit' ? (
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                void submit(status === 'archived' ? 'active' : 'archived')
              }}
            >
              {status === 'archived' ? 'Restore' : 'Archive'}
            </Button>
          ) : null}
          {mode === 'edit' && onDelete ? (
            <Button
              variant="danger"
              onClick={() => {
                setConfirmingDelete(true)
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </form>

      {confirmingDelete && onDelete ? (
        <ConfirmDialog
          title={`Delete ${name.trim() || 'this space'}?`}
          body="This permanently removes the space, its time entries, and its notes. This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => {
            setConfirmingDelete(false)
          }}
          onConfirm={() => {
            setConfirmingDelete(false)
            void onDelete().catch((deleteError: unknown) => {
              setError(errorMessage(deleteError))
            })
          }}
        />
      ) : null}
    </main>
  )
}

function isStatus(value: string): value is SpaceStatus {
  return (SPACE_STATUSES as readonly string[]).includes(value)
}
