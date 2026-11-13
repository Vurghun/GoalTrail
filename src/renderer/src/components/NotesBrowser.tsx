import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Note, NoteSearchHit } from '@shared/notes'
import { noteExcerpt } from '@shared/notes'
import type { Space } from '@shared/spaces'
import { NoteEditor } from '@renderer/components/NoteEditor'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { Button } from '@renderer/components/ui/Button'
import { fieldClass } from '@renderer/components/ui/styles'
import { errorMessage } from '@renderer/lib/errors'

type NoteSort = 'edited' | 'created' | 'title'

interface NotesBrowserProps {
  spaces: Space[]
  lockedSpaceId: string | null
  focusNoteId: string | null
  reloadToken: number
  variant: 'page' | 'section'
}

export function NotesBrowser({
  spaces,
  lockedSpaceId,
  focusNoteId,
  reloadToken,
  variant
}: NotesBrowserProps): React.JSX.Element {
  const [notes, setNotes] = useState<NoteSearchHit[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(focusNoteId)
  const [note, setNote] = useState<Note | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<NoteSort>('edited')
  const [spaceChoice, setSpaceChoice] = useState<string | null>(null)
  const spaceFilter = lockedSpaceId ?? spaceChoice
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<NoteSearchHit | null>(null)
  const activeSpaces = spaces.filter((space) => space.status !== 'archived')
  const [createIn, setCreateIn] = useState(lockedSpaceId ?? activeSpaces[0]?.id ?? '')
  const createSpaceId = spaceFilter ?? createIn

  useEffect(() => {
    let active = true
    const handle = window.setTimeout(() => {
      const text = query.trim()
      const load =
        text.length > 0
          ? window.api.searchNotes({ text, spaceId: spaceFilter, tag: null })
          : spaceFilter
            ? window.api
                .listNotes(spaceFilter)
                .then((list) => list.map((item) => ({ ...item, spaceName: '' })))
            : window.api.listAllNotes()
      void load
        .then((list) => {
          if (!active) return
          setNotes(list)
          setSelectedId((current) => {
            if (focusNoteId && list.some((item) => item.id === focusNoteId)) return focusNoteId
            if (current && list.some((item) => item.id === current)) return current
            return list[0]?.id ?? null
          })
          setError(null)
        })
        .catch((loadError: unknown) => {
          if (active) setError(errorMessage(loadError))
        })
    }, textDelay(query))
    return () => {
      active = false
      window.clearTimeout(handle)
    }
  }, [query, spaceFilter, reloadToken, focusNoteId])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    void window.api
      .getNote(selectedId)
      .then((next) => {
        if (active) setNote(next)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const visible = useMemo(
    () =>
      sortNotes(
        notes.map((item) => ({
          ...item,
          spaceName: item.spaceName || spaces.find((space) => space.id === item.spaceId)?.name || ''
        })),
        sort
      ),
    [notes, sort, spaces]
  )

  const createNote = useCallback(async (): Promise<void> => {
    if (!createSpaceId) return
    try {
      const created = await window.api.createNote(createSpaceId)
      const row = toHit(created, spaces)
      setNotes((current) => [row, ...current.filter((item) => item.id !== created.id)])
      setSelectedId(created.id)
      setNote(created)
      setError(null)
    } catch (createError: unknown) {
      setError(errorMessage(createError))
    }
  }, [createSpaceId, spaces])

  useEffect(() => {
    const onNew = (): void => {
      void createNote()
    }
    window.addEventListener('goaltrail-new-note', onNew)
    return () => {
      window.removeEventListener('goaltrail-new-note', onNew)
    }
  }, [createNote])

  return (
    <section className={variant === 'page' ? 'mx-auto w-full max-w-[1080px] px-8 py-10' : 'py-6'}>
      {variant === 'page' ? (
        <header className="mb-8">
          <p className="text-sm text-faint">Writing</p>
          <h1 className="mt-2 text-[40px] font-semibold tracking-tight">Notes</h1>
        </header>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          aria-label="Search notes"
          placeholder="Search notes"
          className={`${fieldClass} max-w-xs`}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
        />
        <SortControl sort={sort} onSort={setSort} />
        <div className="ml-auto flex items-center gap-2">
          {variant === 'page' && !spaceFilter && activeSpaces.length > 1 ? (
            <select
              className={`${fieldClass} w-auto`}
              aria-label="Space for a new note"
              value={createIn}
              onChange={(event) => {
                setCreateIn(event.target.value)
              }}
            >
              {activeSpaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            title="New note (N)"
            disabled={!createSpaceId}
            onClick={() => {
              void createNote()
            }}
          >
            New note
          </Button>
        </div>
      </div>

      {variant === 'page' ? (
        <div
          className="mb-4 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter notes by space"
        >
          <FilterChip
            label="All"
            selected={spaceFilter === null}
            onClick={() => {
              setSpaceChoice(null)
            }}
          />
          {activeSpaces.map((space) => (
            <FilterChip
              key={space.id}
              label={space.name}
              selected={spaceFilter === space.id}
              onClick={() => {
                setSpaceChoice(space.id)
              }}
            />
          ))}
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted">
              {query.trim() ? 'Nothing matches that.' : 'No notes yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {visible.map((item) => (
                <li key={item.id}>
                  <div
                    className={`flex gap-3 py-3 ${item.id === selectedId ? 'bg-accent-soft' : ''}`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 gap-3 text-left"
                      onClick={() => {
                        setSelectedId(item.id)
                      }}
                    >
                      {item.coverSrc ? (
                        <img
                          src={item.coverSrc}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-md object-cover"
                        />
                      ) : null}
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium">
                            {item.title.trim() || 'Untitled'}
                          </span>
                          {item.pinned ? (
                            <span className="text-[11px] text-faint">Pinned</span>
                          ) : null}
                        </span>
                        {variant === 'page' ? (
                          <span className="mt-0.5 block text-[11px] text-faint">
                            {item.spaceName}
                          </span>
                        ) : null}
                        {item.excerpt ? (
                          <span className="mt-1 line-clamp-2 block text-xs text-muted">
                            {item.excerpt}
                          </span>
                        ) : null}
                        {item.imageCount > 0 ? (
                          <span className="mt-1 block text-[11px] text-faint">
                            {item.imageCount === 1 ? '1 image' : `${item.imageCount} images`}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        type="button"
                        className="text-[11px] text-muted hover:text-text"
                        onClick={() => {
                          void window.api
                            .setNotePinned(item.id, !item.pinned)
                            .then((saved) => {
                              setNotes((current) =>
                                current.map((row) =>
                                  row.id === saved.id ? { ...row, ...toHit(saved, spaces) } : row
                                )
                              )
                              if (note?.id === saved.id) setNote(saved)
                            })
                            .catch((pinError: unknown) => {
                              setError(errorMessage(pinError))
                            })
                        }}
                      >
                        {item.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-muted hover:text-danger"
                        onClick={() => {
                          setPendingDelete(item)
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {note && note.id === selectedId ? (
          <NoteEditor
            key={note.id}
            note={note}
            onMeta={(saved) => {
              setNote(saved)
              setNotes((current) =>
                sortNotes(
                  current.map((item) =>
                    item.id === saved.id ? { ...item, ...toHit(saved, spaces) } : item
                  ),
                  sort
                )
              )
            }}
            onDeleted={(id) => {
              const remaining = notes.filter((item) => item.id !== id)
              setNotes(remaining)
              setSelectedId(remaining[0]?.id ?? null)
              setNote(null)
            }}
          />
        ) : (
          <p className="text-sm text-muted">Select a note, or create one.</p>
        )}
      </div>

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete ${pendingDelete.title.trim() || 'this note'}?`}
          body="This permanently removes the note and its images."
          confirmLabel="Delete"
          onCancel={() => {
            setPendingDelete(null)
          }}
          onConfirm={() => {
            const target = pendingDelete
            setPendingDelete(null)
            void window.api
              .deleteNote(target.id)
              .then(() => {
                const remaining = notes.filter((item) => item.id !== target.id)
                setNotes(remaining)
                if (selectedId === target.id) {
                  setSelectedId(remaining[0]?.id ?? null)
                  setNote(null)
                }
              })
              .catch((deleteError: unknown) => {
                setError(errorMessage(deleteError))
              })
          }}
        />
      ) : null}
    </section>
  )
}

function SortControl({
  sort,
  onSort
}: {
  sort: NoteSort
  onSort: (sort: NoteSort) => void
}): React.JSX.Element {
  const options: { id: NoteSort; label: string }[] = [
    { id: 'edited', label: 'Edited' },
    { id: 'created', label: 'Created' },
    { id: 'title', label: 'Title' }
  ]
  return (
    <div
      className="flex rounded-md border border-border p-0.5"
      role="tablist"
      aria-label="Sort notes"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={sort === option.id}
          className={`rounded-sm px-2.5 py-1 text-xs font-medium ${
            sort === option.id ? 'bg-text text-surface' : 'text-muted hover:text-text'
          }`}
          onClick={() => {
            onSort(option.id)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function FilterChip({
  label,
  selected,
  onClick
}: {
  label: string
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`rounded-full px-3 py-1 text-sm ${
        selected
          ? 'bg-text font-medium text-surface'
          : 'text-muted hover:bg-accent-soft hover:text-text'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function sortNotes(notes: NoteSearchHit[], sort: NoteSort): NoteSearchHit[] {
  return notes.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sort === 'title') {
      return (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, {
        sensitivity: 'base'
      })
    }
    if (sort === 'created') return b.createdAt.localeCompare(a.createdAt)
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

function toHit(note: Note, spaces: Space[]): NoteSearchHit {
  return {
    id: note.id,
    spaceId: note.spaceId,
    title: note.title,
    pinned: note.pinned,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    excerpt: noteExcerpt(note.content),
    imageCount: note.imageCount,
    coverSrc: note.coverSrc,
    spaceName: spaces.find((space) => space.id === note.spaceId)?.name ?? ''
  }
}

function textDelay(query: string): number {
  return query.trim().length > 0 ? 180 : 0
}
