import { useState } from 'react'
import { motion } from 'motion/react'
import { Pause, Pencil, Play, Square } from 'lucide-react'
import type { SpaceGoals } from '@shared/progress'
import { SPACE_STATUS_LABELS, toSpaceDraft, type Space, type SpaceDraft } from '@shared/spaces'
import { formatClock } from '@shared/time'
import { MilestoneBoard } from '@renderer/components/MilestoneBoard'
import { NotesPanel } from '@renderer/components/NotesPanel'
import { ProgressPanel } from '@renderer/components/ProgressPanel'
import { SpaceHome } from '@renderer/components/SpaceHome'
import { Button } from '@renderer/components/ui/Button'
import { IconTile } from '@renderer/components/ui/IconTile'
import type { useTimer } from '@renderer/hooks/useTimer'
import { pushToast } from '@renderer/lib/toast'
import { SpaceEditor } from '@renderer/pages/SpaceEditor'

type TimerApi = ReturnType<typeof useTimer>

export type SpaceSection = 'overview' | 'notes' | 'milestones' | 'progress'

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
  onOpenHistory: () => void
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
  onGoals,
  onOpenHistory
}: SpacePageProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const openHere = timer.session?.spaceId === space.id ? timer.session : null
  const running = openHere?.running ?? false

  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-8">
      <header className="flex flex-wrap items-center gap-4">
        <IconTile icon={space.icon} color={space.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-3 truncate text-3xl font-semibold tracking-tight">
            {running ? <span className="timer-dot" aria-hidden /> : null}
            <span className="truncate">{space.name}</span>
          </h1>
          {space.description ? (
            <p className="mt-2 truncate text-sm text-muted">{space.description}</p>
          ) : null}
        </div>
        <span className="text-sm text-muted">{SPACE_STATUS_LABELS[space.status]}</span>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(true)
          }}
        >
          <Pencil size={15} />
          Edit
        </Button>
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

      <div className="mt-8 flex gap-1 border-b border-border" role="tablist" aria-label="Space">
        <SectionTab
          selected={section === 'overview'}
          label="Overview"
          onClick={() => {
            onSection('overview')
          }}
        />
        <SectionTab
          selected={section === 'milestones'}
          label="Milestones"
          onClick={() => {
            onSection('milestones')
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
        <SpaceHome
          space={space}
          timer={timer}
          onOpenHistory={onOpenHistory}
          onOpenMilestones={() => {
            onSection('milestones')
          }}
        />
      ) : null}
      {section === 'milestones' ? (
        <MilestoneBoard key={space.id} spaces={[space]} variant="section" />
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
          onOpenMilestones={() => {
            onSection('milestones')
          }}
          onGoals={async (dailyGoalMin, weeklyGoalMin) => {
            await onGoals({ dailyGoalMin, weeklyGoalMin })
          }}
        />
      ) : null}
      {editing ? (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-black/40 px-4 py-10">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-3 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false)
                }}
              >
                Close
              </Button>
            </div>
            <SpaceEditor
              key={`${space.id}:${space.updatedAt}`}
              mode="edit"
              embedded
              initial={toSpaceDraft(space)}
              onSubmit={async (draft) => {
                await onUpdate(draft)
                setEditing(false)
              }}
              onDelete={onDelete}
            />
          </div>
        </div>
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
      className={`relative px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
        selected ? 'text-text' : 'text-muted hover:text-text'
      }`}
      onClick={onClick}
    >
      {label}
      {selected ? (
        <motion.span
          layoutId="space-section"
          className="absolute inset-x-3 -bottom-px h-0.5 bg-text"
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
    </button>
  )
}
