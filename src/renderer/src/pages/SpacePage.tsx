import { Pause, Play, Square } from 'lucide-react'
import type { SpaceGoals } from '@shared/progress'
import {
  SPACE_STATUS_LABELS,
  SPACE_STATUSES,
  toSpaceDraft,
  type Space,
  type SpaceDraft,
  type SpaceStatus
} from '@shared/spaces'
import { formatClock } from '@shared/time'
import { NotesPanel } from '@renderer/components/NotesPanel'
import { ProgressPanel } from '@renderer/components/ProgressPanel'
import { TimePanel } from '@renderer/components/TimePanel'
import { Button } from '@renderer/components/ui/Button'
import { IconTile } from '@renderer/components/ui/IconTile'
import { fieldClass } from '@renderer/components/ui/styles'
import type { useTimer } from '@renderer/hooks/useTimer'
import { pushToast } from '@renderer/lib/toast'
import { SpaceEditor } from '@renderer/pages/SpaceEditor'

type TimerApi = ReturnType<typeof useTimer>

export type SpaceSection = 'overview' | 'notes' | 'progress'

interface SpacePageProps {
  space: Space
  section: SpaceSection
  onSection: (section: SpaceSection) => void
  timer: TimerApi
  focusNoteId: string | null
  noteReloadToken: number
  onUpdate: (draft: SpaceDraft) => Promise<void>
  onDelete: () => Promise<void>
  onGoals: (goals: SpaceGoals) => Promise<void>
}

export function SpacePage({
  space,
  section,
  onSection,
  timer,
  focusNoteId,
  noteReloadToken,
  onUpdate,
  onDelete,
  onGoals
}: SpacePageProps): React.JSX.Element {
  const openHere = timer.session?.spaceId === space.id ? timer.session : null
  const running = openHere?.running ?? false

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <header
        className={`flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-card ${running ? 'timer-glow' : ''}`}
        style={running ? ({ '--timer': space.color } as React.CSSProperties) : undefined}
      >
        <IconTile icon={space.icon} color={space.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] font-semibold leading-none tracking-tight">{space.name}</h1>
          <p className="mt-2 truncate text-sm text-muted">{space.description || 'No description'}</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Status</span>
          <select
            className={`${fieldClass} w-auto`}
            value={space.status}
            aria-label="Status"
            onChange={(event) => {
              const next = event.target.value
              if (!isStatus(next) || next === space.status) return
              void onUpdate({ ...toSpaceDraft(space), status: next }).then(() => {
                pushToast(next === 'archived' ? 'Space archived' : 'Status updated')
              })
            }}
          >
            {SPACE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {SPACE_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        {space.status === 'archived' ? null : openHere ? (
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold tabular-nums">{formatClock(timer.elapsed)}</span>
            <Button
              variant="secondary"
              onClick={() => {
                void (running ? timer.pause() : timer.start(space.id)).then((ok) => {
                  if (ok) pushToast(running ? 'Timer paused' : 'Timer resumed')
                })
              }}
            >
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? 'Pause' : 'Resume'}
            </Button>
            <Button
              variant="secondary"
              aria-label="Stop timer"
              onClick={() => {
                void timer.stop().then((ok) => {
                  if (ok) pushToast('Timer stopped')
                })
              }}
            >
              <Square size={14} />
              Stop
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => {
              void timer.start(space.id).then((ok) => {
                if (ok) pushToast('Timer started')
              })
            }}
          >
            <Play size={16} />
            Start session
          </Button>
        )}
      </header>

      <div className="mt-5 flex gap-1 border-b border-border" role="tablist" aria-label="Space">
        <SectionTab
          selected={section === 'overview'}
          label="Overview"
          onClick={() => {
            onSection('overview')
          }}
        />
        <SectionTab
          selected={section === 'notes'}
          label="Notes"
          onClick={() => {
            onSection('notes')
          }}
        />
        <SectionTab
          selected={section === 'progress'}
          label="Progress"
          onClick={() => {
            onSection('progress')
          }}
        />
      </div>

      {section === 'notes' && timer.error ? (
        <p className="pt-4 text-sm text-danger">{timer.error}</p>
      ) : null}
      {section === 'overview' ? (
        <div className="pt-6">
          <TimePanel space={space} timer={timer}>
            <SpaceEditor
              key={`${space.id}:${space.updatedAt}`}
              mode="edit"
              embedded
              initial={toSpaceDraft(space)}
              onSubmit={onUpdate}
              onDelete={onDelete}
            />
          </TimePanel>
        </div>
      ) : null}
      {section === 'notes' ? (
        <NotesPanel
          key={space.id}
          space={space}
          focusNoteId={focusNoteId}
          reloadToken={noteReloadToken}
        />
      ) : null}
      {section === 'progress' ? (
        <ProgressPanel
          key={space.id}
          space={space}
          timer={timer}
          onGoals={async (dailyGoalMin, weeklyGoalMin) => {
            await onGoals({ dailyGoalMin, weeklyGoalMin })
          }}
        />
      ) : null}
    </div>
  )
}

function SectionTab({
  selected,
  label,
  onClick
}: {
  selected: boolean
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`relative px-3 py-2 text-sm font-medium transition duration-150 ${
        selected ? 'text-text' : 'text-muted hover:text-text'
      }`}
      onClick={onClick}
    >
      {label}
      {selected ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
    </button>
  )
}

function isStatus(value: string): value is SpaceStatus {
  return (SPACE_STATUSES as readonly string[]).includes(value)
}
