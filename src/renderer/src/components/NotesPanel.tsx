import { useEffect, useRef, useState } from 'react'
import type { Note, NoteSummary } from '@shared/notes'
import { noteExcerpt } from '@shared/notes'
import type { Space } from '@shared/spaces'
import { NoteEditor } from '@renderer/components/NoteEditor'
import { Button } from '@renderer/components/ui/Button'
import { errorMessage } from '@renderer/lib/errors'

interface NotesPanelProps {
  space: Space
  focusNoteId: string | null
  reloadToken: number
}

export function NotesPanel({
  space,
  focusNoteId,
  reloadToken
}: NotesPanelProps): React.JSX.Element {
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(focusNoteId)
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    let active = true
    void window.api
      .listNotes(space.id)
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
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [space.id, reloadToken, focusNoteId])

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

  async function createNote(): Promise<void> {
    const request = ++requestRef.current
    try {
      const created = await window.api.createNote(space.id)
      if (request !== requestRef.current) return
      setNotes((current) => [
        toSummary(created),
        ...current.filter((item) => item.id !== created.id)
      ])
      setSelectedId(created.id)
      setNote(created)
      setError(null)
    } catch (createError: unknown) {
      if (request === requestRef.current) setError(errorMessage(createError))
    }
  }

  return (
    <section className="py-6">
      <div className="mb-4 flex justify-end">
        <Button
          title="New note (N)"
          onClick={() => {
            void createNote()
          }}
        >
          New note
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {loading && notes.length === 0 ? (
        <p className="text-sm text-muted">Loading notes…</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
                No notes in this space yet.
              </p>
            ) : (
              notes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left ${
                    item.id === selectedId ? 'border-accent bg-surface' : 'border-border'
                  }`}
                  onClick={() => {
                    setSelectedId(item.id)
                  }}
                >
                  <span className="block truncate text-sm font-medium">
                    {item.title.trim() || 'Untitled'}
                  </span>
                  {item.pinned ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Pinned</span>
                  ) : null}
                  {item.excerpt ? (
                    <span className="mt-1 line-clamp-2 block text-xs text-muted">
                      {item.excerpt}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
          {note && note.id === selectedId ? (
            <NoteEditor
              key={note.id}
              note={note}
              onMeta={(saved) => {
                setNotes((current) =>
                  current
                    .map((item) => (item.id === saved.id ? toSummary(saved) : item))
                    .sort(compareNotes)
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
      )}
    </section>
  )
}

function toSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    spaceId: note.spaceId,
    title: note.title,
    pinned: note.pinned,
    tags: note.tags,
    updatedAt: note.updatedAt,
    excerpt: noteExcerpt(note.content)
  }
}

function compareNotes(a: NoteSummary, b: NoteSummary): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return b.updatedAt.localeCompare(a.updatedAt)
}
