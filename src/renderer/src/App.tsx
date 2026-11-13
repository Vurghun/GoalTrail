import { useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { PictureInPicture2, Search, Timer } from 'lucide-react'
import type { IdlePrompt } from '@shared/idle'
import type { SessionWrapUp } from '@shared/ipc'
import { emptySpaceDraft, type SpaceDraft } from '@shared/spaces'
import { CommandPalette } from '@renderer/components/CommandPalette'
import { FocusMode } from '@renderer/components/FocusMode'
import { IdlePromptDialog } from '@renderer/components/IdlePromptDialog'
import { WrapUpDialog } from '@renderer/components/WrapUpDialog'
import { ShortcutsModal } from '@renderer/components/ShortcutsModal'
import { TemplateModal } from '@renderer/components/TemplateModal'
import { NoteSearch } from '@renderer/components/NoteSearch'
import { ToastHost } from '@renderer/components/ToastHost'
import { SpaceSidebar } from '@renderer/components/SpaceSidebar'
import { TimerBar } from '@renderer/components/TimerBar'
import { ViewTransition } from '@renderer/components/ViewTransition'
import { SettingsProvider } from '@renderer/components/SettingsProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useSpaces } from '@renderer/hooks/useSpaces'
import { useTheme } from '@renderer/hooks/useTheme'
import { useTimer } from '@renderer/hooks/useTimer'
import { errorMessage } from '@renderer/lib/errors'
import { pushToast } from '@renderer/lib/toast'
import { DashboardPage } from '@renderer/pages/DashboardPage'
import { HistoryPage } from '@renderer/pages/HistoryPage'
import { NotesPage } from '@renderer/pages/NotesPage'
import { MilestonesPage } from '@renderer/pages/MilestonesPage'
import { ReviewPage } from '@renderer/pages/ReviewPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { SpaceEditor } from '@renderer/pages/SpaceEditor'
import { SpacePage, type SpaceSection } from '@renderer/pages/SpacePage'

export function App(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
      <SettingsProvider setTheme={setTheme}>
        <AppShell theme={theme} />
      </SettingsProvider>
    </MotionConfig>
  )
}

function AppShell({ theme }: { theme: ReturnType<typeof useTheme>['theme'] }): React.JSX.Element {
  const { settings, update: updateSettings } = useSettings()
  const {
    spaces,
    loading,
    error,
    createSpace,
    updateSpace,
    deleteSpace,
    moveSpace,
    placeSpace,
    setSpaceGoals
  } = useSpaces()
  const timer = useTimer()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [section, setSection] = useState<SpaceSection>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTag, setSearchTag] = useState<string | null>(null)
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const [noteReloadToken, setNoteReloadToken] = useState(0)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [home, setHome] = useState<
    'dashboard' | 'review' | 'milestones' | 'notes' | 'history' | 'settings'
  >('dashboard')
  const [historySpaceId, setHistorySpaceId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<SpaceDraft | null>(null)
  const [idlePrompt, setIdlePrompt] = useState<IdlePrompt | null>(null)
  const [wrapUp, setWrapUp] = useState<SessionWrapUp | null>(null)
  const chordRef = useRef<string | null>(null)
  const idlePromptRef = useRef<IdlePrompt | null>(null)
  const wrapQueue = useRef<SessionWrapUp | null>(null)
  const selected = spaces.find((space) => space.id === selectedId) ?? null
  const timingSpace = spaces.find((space) => space.id === timer.session?.spaceId)
  const searching = searchQuery.trim().length > 0 || searchTag !== null

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent): void => {
      if (![...(event.dataTransfer?.types ?? [])].includes('Files')) return
      event.preventDefault()
    }
    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => {
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  }, [])

  useEffect(() => {
    const offIdle = window.api.onIdlePrompt((prompt) => {
      idlePromptRef.current = prompt
      setIdlePrompt(prompt)
    })
    const offWrap = window.api.onSessionWrapUp((session) => {
      if (idlePromptRef.current) wrapQueue.current = session
      else setWrapUp(session)
    })
    const offGoal = window.api.onGoalReached((goal) => {
      if (!document.hidden) pushToast(`${goal.spaceName} is at today's goal`)
    })
    return () => {
      offIdle()
      offWrap()
      offGoal()
    }
  }, [])

  function closeIdlePrompt(): void {
    idlePromptRef.current = null
    setIdlePrompt(null)
    const queued = wrapQueue.current
    wrapQueue.current = null
    if (queued) setWrapUp(queued)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (idlePrompt || wrapUp) return
      const key = event.key.toLowerCase()
      const command = event.ctrlKey || event.metaKey
      if (key === 'escape') {
        setFocusOpen(false)
        setPaletteOpen(false)
        setShortcutsOpen(false)
        setTemplatesOpen(false)
        return
      }
      if (command && !event.altKey && key === 'k' && !event.shiftKey) {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.altKey || isTextEntry(event.target)) return
      if (command && key !== 'n' && key !== 't') return

      if (key === 'n') {
        if (chordRef.current === 'g') {
          event.preventDefault()
          chordRef.current = null
          setHome('notes')
          setCreating(false)
          setSelectedId(null)
          setSearchQuery('')
          setSearchTag(null)
          return
        }
        if (!selected || creating) {
          if (home === 'notes') {
            event.preventDefault()
            window.dispatchEvent(new Event('goaltrail-new-note'))
          }
          return
        }
        event.preventDefault()
        setShortcutError(null)
        setSearchQuery('')
        setSearchTag(null)
        setCreating(false)
        setSection('notes')
        void window.api
          .createNote(selected.id)
          .then((note) => {
            setFocusNoteId(note.id)
            setNoteReloadToken((value) => value + 1)
          })
          .catch((createError: unknown) => {
            setShortcutError(errorMessage(createError))
          })
        return
      }

      if (key === 't') {
        event.preventDefault()
        if (timer.session?.running) {
          void timer.stop()
        } else if (timer.session) {
          void timer.start(timer.session.spaceId)
        } else if (selected && !creating) {
          void timer.start(selected.id)
        }
        return
      }

      if (key === '?' || (key === '/' && event.shiftKey)) {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }

      if (key === 'g') {
        chordRef.current = 'g'
        window.setTimeout(() => {
          if (chordRef.current === 'g') chordRef.current = null
        }, 800)
        return
      }

      if (key === 'd' && chordRef.current === 'g') {
        event.preventDefault()
        chordRef.current = null
        setHome('dashboard')
        setCreating(false)
        setSelectedId(null)
        setSearchQuery('')
        setSearchTag(null)
      }

      if (key === 'm' && chordRef.current === 'g') {
        event.preventDefault()
        chordRef.current = null
        setHome('milestones')
        setCreating(false)
        setSelectedId(null)
        setSearchQuery('')
        setSearchTag(null)
      }

      if (key === 'r' && chordRef.current === 'g') {
        event.preventDefault()
        chordRef.current = null
        setHome('review')
        setCreating(false)
        setSelectedId(null)
        setSearchQuery('')
        setSearchTag(null)
      }

      if (key === 'h' && chordRef.current === 'g') {
        event.preventDefault()
        chordRef.current = null
        setHome('history')
        setHistorySpaceId(null)
        setCreating(false)
        setSelectedId(null)
        setSearchQuery('')
        setSearchTag(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [
    creating,
    home,
    selected,
    timer,
    focusOpen,
    paletteOpen,
    shortcutsOpen,
    templatesOpen,
    idlePrompt,
    wrapUp
  ])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      <div className="window-spacer shrink-0 bg-bg" />
      <div className="flex min-h-0 flex-1">
        <SpaceSidebar
          spaces={spaces}
          loading={loading}
          error={error}
          selectedId={creating || searching ? null : selectedId}
          creating={creating}
          onSelect={(id) => {
            setCreating(false)
            setSelectedId(id)
            setSection('overview')
            setFocusNoteId(null)
            setSearchQuery('')
            setSearchTag(null)
            setPaletteOpen(false)
          }}
          onStartCreate={() => {
            setTemplatesOpen(true)
          }}
          onMove={(id, direction) => {
            void moveSpace(id, direction)
          }}
          onPlace={(id, beforeId) => {
            void placeSpace(id, beforeId)
          }}
          timingSpaceId={timer.session?.spaceId ?? null}
          timingRunning={timer.session?.running ?? false}
          showingDashboard={home === 'dashboard' && selectedId === null && !creating && !searching}
          showingReview={home === 'review' && selectedId === null && !creating && !searching}
          showingMilestones={
            home === 'milestones' && selectedId === null && !creating && !searching
          }
          showingNotes={home === 'notes' && selectedId === null && !creating && !searching}
          showingHistory={home === 'history' && selectedId === null && !creating && !searching}
          showingSettings={home === 'settings' && selectedId === null && !creating && !searching}
          onShowDashboard={() => {
            setHome('dashboard')
            setCreating(false)
            setSelectedId(null)
            setSearchQuery('')
            setSearchTag(null)
          }}
          onShowReview={() => {
            setHome('review')
            setCreating(false)
            setSelectedId(null)
            setSearchQuery('')
            setSearchTag(null)
          }}
          onShowMilestones={() => {
            setHome('milestones')
            setCreating(false)
            setSelectedId(null)
            setSearchQuery('')
            setSearchTag(null)
          }}
          onShowNotes={() => {
            setHome('notes')
            setCreating(false)
            setSelectedId(null)
            setSearchQuery('')
            setSearchTag(null)
          }}
          onShowHistory={() => {
            setHome('history')
            setHistorySpaceId(null)
            setCreating(false)
            setSelectedId(null)
            setSearchQuery('')
            setSearchTag(null)
          }}
          onShowSettings={() => {
            setHome('settings')
            setCreating(false)
            setSelectedId(null)
            setSearchQuery('')
            setSearchTag(null)
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border bg-bg px-5 py-3">
            <button
              type="button"
              className="titlebar-no-drag flex w-full max-w-xl items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-faint transition duration-150 ease-out hover:border-line"
              onClick={() => {
                setPaletteOpen(true)
              }}
            >
              <Search size={15} />
              <span className="flex-1 text-left">Search</span>
              <span className="rounded border border-border px-1.5 py-0.5 text-[11px]">Ctrl K</span>
            </button>
            <div className="titlebar-no-drag flex items-center gap-2">
              {timer.session ? (
                <TimerBar
                  session={timer.session}
                  space={timingSpace}
                  elapsed={timer.elapsed}
                  onSelect={() => {
                    setCreating(false)
                    setSearchQuery('')
                    setSearchTag(null)
                    setSelectedId(timer.session?.spaceId ?? null)
                    setSection('overview')
                  }}
                  onPause={() => {
                    void timer.pause()
                  }}
                  onResume={() => {
                    if (timer.session) void timer.start(timer.session.spaceId)
                  }}
                  onStop={() => {
                    void timer.stop()
                  }}
                />
              ) : null}
              {timer.session ? (
                <>
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted hover:bg-accent-soft hover:text-text"
                    aria-label="Focus mode"
                    onClick={() => {
                      setFocusOpen(true)
                    }}
                  >
                    <Timer size={16} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted hover:bg-accent-soft hover:text-text"
                    aria-label="Open mini timer"
                    onClick={() => {
                      void window.api.openMiniTimer()
                    }}
                  >
                    <PictureInPicture2 size={16} />
                  </button>
                </>
              ) : null}
            </div>
          </header>
          {shortcutError ? (
            <p className="border-b border-border px-6 py-2 text-sm text-danger">{shortcutError}</p>
          ) : null}
          <div className="relative min-h-0 flex-1">
            <ViewTransition
              viewKey={
                searching
                  ? 'search'
                  : creating
                    ? 'create'
                    : selected
                      ? `${selected.id}:${section}`
                      : home
              }
            >
              {searching ? (
                <NoteSearch
                  text={searchQuery.trim()}
                  spaceId={selected?.id ?? null}
                  spaceName={selected?.name ?? null}
                  tag={searchTag}
                  onTag={setSearchTag}
                  onOpen={(spaceId, noteId) => {
                    setSearchQuery('')
                    setSearchTag(null)
                    setCreating(false)
                    setSelectedId(spaceId)
                    setSection('notes')
                    setFocusNoteId(noteId)
                    setNoteReloadToken((value) => value + 1)
                  }}
                />
              ) : creating ? (
                <SpaceEditor
                  key="new-space"
                  mode="create"
                  initial={createDraft ?? emptySpaceDraft()}
                  onSubmit={async (draft) => {
                    const created = await createSpace(draft)
                    setCreating(false)
                    setSelectedId(created.id)
                  }}
                />
              ) : selected ? (
                <SpacePage
                  space={selected}
                  section={section}
                  onSection={setSection}
                  timer={timer}
                  focusNoteId={focusNoteId}
                  noteReloadToken={noteReloadToken}
                  onUpdate={async (draft) => {
                    await updateSpace(selected.id, draft)
                    await timer.refresh()
                  }}
                  onDelete={async () => {
                    await deleteSpace(selected.id)
                    setSelectedId(null)
                    await timer.refresh()
                  }}
                  onGoals={async (goals) => {
                    await setSpaceGoals(selected.id, goals)
                  }}
                  onOpenHistory={() => {
                    setHistorySpaceId(selected.id)
                    setSelectedId(null)
                    setHome('history')
                    setSearchQuery('')
                    setSearchTag(null)
                  }}
                />
              ) : home === 'settings' ? (
                <SettingsPage />
              ) : home === 'review' ? (
                <ReviewPage />
              ) : home === 'notes' ? (
                <NotesPage spaces={spaces} />
              ) : home === 'history' ? (
                <HistoryPage spaces={spaces} spaceId={historySpaceId} onSpace={setHistorySpaceId} />
              ) : home === 'milestones' ? (
                <MilestonesPage
                  spaces={spaces}
                  onOpenSpace={(spaceId) => {
                    setCreating(false)
                    setSelectedId(spaceId)
                    setSection('milestones')
                    setSearchQuery('')
                    setSearchTag(null)
                  }}
                />
              ) : (
                <DashboardPage
                  hasSpaces={spaces.length > 0}
                  spaces={spaces}
                  timer={timer}
                  onCreateSpace={() => {
                    setTemplatesOpen(true)
                  }}
                  onOpenSpace={(spaceId, next = 'overview') => {
                    setCreating(false)
                    setSelectedId(spaceId)
                    setSection(next)
                    setSearchQuery('')
                    setSearchTag(null)
                  }}
                  onOpenMilestones={() => {
                    setHome('milestones')
                    setCreating(false)
                    setSelectedId(null)
                    setSearchQuery('')
                    setSearchTag(null)
                  }}
                  onOpenReview={() => {
                    setHome('review')
                    setCreating(false)
                    setSelectedId(null)
                    setSearchQuery('')
                    setSearchTag(null)
                  }}
                  onOpenNote={(spaceId, noteId) => {
                    setCreating(false)
                    setSelectedId(spaceId)
                    setSection('notes')
                    setFocusNoteId(noteId)
                    setNoteReloadToken((value) => value + 1)
                  }}
                />
              )}
            </ViewTransition>
          </div>
        </div>
      </div>
      <CommandPalette
        key={paletteOpen ? 'open' : 'closed'}
        open={paletteOpen}
        spaces={spaces}
        onClose={() => {
          setPaletteOpen(false)
        }}
        onNewSpace={() => {
          setPaletteOpen(false)
          setTemplatesOpen(true)
        }}
        onDashboard={() => {
          setPaletteOpen(false)
          setHome('dashboard')
          setCreating(false)
          setSelectedId(null)
          setSearchQuery('')
          setSearchTag(null)
        }}
        onMilestones={() => {
          setPaletteOpen(false)
          setHome('milestones')
          setCreating(false)
          setSelectedId(null)
          setSearchQuery('')
          setSearchTag(null)
        }}
        onNotes={() => {
          setPaletteOpen(false)
          setHome('notes')
          setCreating(false)
          setSelectedId(null)
          setSearchQuery('')
          setSearchTag(null)
        }}
        onReview={() => {
          setPaletteOpen(false)
          setHome('review')
          setCreating(false)
          setSelectedId(null)
          setSearchQuery('')
          setSearchTag(null)
        }}
        onHistory={() => {
          setPaletteOpen(false)
          setHome('history')
          setHistorySpaceId(null)
          setCreating(false)
          setSelectedId(null)
          setSearchQuery('')
          setSearchTag(null)
        }}
        onSettings={() => {
          setPaletteOpen(false)
          setHome('settings')
          setCreating(false)
          setSelectedId(null)
          setSearchQuery('')
          setSearchTag(null)
        }}
        onCycleTheme={() => {
          const order = ['system', 'light', 'dark'] as const
          const next = order[(order.indexOf(theme) + 1) % order.length] ?? 'system'
          void updateSettings({ theme: next }).catch((reason: unknown) => {
            setShortcutError(errorMessage(reason))
          })
        }}
        onFocus={() => {
          setPaletteOpen(false)
          if (timer.session) setFocusOpen(true)
        }}
        onShortcuts={() => {
          setPaletteOpen(false)
          setShortcutsOpen(true)
        }}
        onOpenSpace={(spaceId) => {
          setPaletteOpen(false)
          setCreating(false)
          setSearchQuery('')
          setSearchTag(null)
          setSelectedId(spaceId)
          setSection('overview')
        }}
        onOpenNote={(spaceId, noteId) => {
          setPaletteOpen(false)
          setSearchQuery('')
          setSearchTag(null)
          setCreating(false)
          setSelectedId(spaceId)
          setSection('notes')
          setFocusNoteId(noteId)
          setNoteReloadToken((value) => value + 1)
        }}
        onStartTimer={(spaceId) => {
          setPaletteOpen(false)
          void timer.start(spaceId)
        }}
        onSearchAll={(text) => {
          setPaletteOpen(false)
          setSearchTag(null)
          setSearchQuery(text)
        }}
      />
      <ToastHost />
      {templatesOpen ? (
        <TemplateModal
          onClose={() => {
            setTemplatesOpen(false)
          }}
          onPick={(template) => {
            setCreateDraft(template.draft)
            setTemplatesOpen(false)
            setHome('dashboard')
            setSelectedId(null)
            setSearchQuery('')
            setSearchTag(null)
            setCreating(true)
          }}
        />
      ) : null}
      {shortcutsOpen ? (
        <ShortcutsModal
          onClose={() => {
            setShortcutsOpen(false)
          }}
        />
      ) : null}
      {focusOpen && timer.session ? (
        <FocusMode
          key={timer.session.id}
          space={timingSpace}
          timer={timer}
          focusMin={settings.pomodoroFocusMin}
          breakMin={settings.pomodoroBreakMin}
          onClose={() => {
            setFocusOpen(false)
          }}
        />
      ) : null}
      {idlePrompt ? (
        <IdlePromptDialog
          prompt={idlePrompt}
          onDone={closeIdlePrompt}
          onRemoved={() => {
            if (wrapQueue.current?.id === idlePrompt.sessionId) wrapQueue.current = null
          }}
        />
      ) : null}
      {wrapUp && !idlePrompt ? (
        <WrapUpDialog
          session={wrapUp}
          onDone={() => {
            setWrapUp(null)
          }}
        />
      ) : null}
    </div>
  )
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
