import { useEffect, useState } from 'react'
import type { NoteSearchHit } from '@shared/notes'
import { errorMessage } from '@renderer/lib/errors'

interface NoteSearchProps {
  text: string
  spaceId: string | null
  spaceName: string | null
  tag: string | null
  onTag: (tag: string | null) => void
  onOpen: (spaceId: string, noteId: string) => void
}

export function NoteSearch({
  text,
  spaceId,
  spaceName,
  tag,
  onTag,
  onOpen
}: NoteSearchProps): React.JSX.Element {
  const [hits, setHits] = useState<NoteSearchHit[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [onlySpace, setOnlySpace] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.api
      .listTags()
      .then((names) => {
        if (active) setTags(names)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [text, tag])

  useEffect(() => {
    let active = true
    const handle = setTimeout(() => {
      void window.api
        .searchNotes({
          text,
          spaceId: onlySpace ? spaceId : null,
          tag
        })
        .then((next) => {
          if (!active) return
          setHits(next)
          setError(null)
        })
        .catch((searchError: unknown) => {
          if (active) setError(errorMessage(searchError))
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [text, tag, onlySpace, spaceId])

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">
          {text ? `Notes matching "${text}"` : 'Notes'}
        </h1>
        {spaceId && spaceName ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={onlySpace}
              onChange={(event) => {
                setOnlySpace(event.target.checked)
              }}
            />
            Only {spaceName}
          </label>
        ) : null}
      </div>
      {tag ? (
        <button
          type="button"
          className="w-fit rounded-md bg-accent px-3 py-1 text-xs text-white dark:text-[#14161c]"
          onClick={() => {
            onTag(null)
          }}
        >
          Tag: {tag} ×
        </button>
      ) : null}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((name) => (
            <button
              key={name}
              type="button"
              className={`rounded-full px-2.5 py-1 text-xs ${
                name === tag
                  ? 'bg-accent text-white dark:text-[#14161c]'
                  : 'bg-bg'
              }`}
              onClick={() => {
                onTag(name === tag ? null : name)
              }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {hits.length === 0 ? (
        <p className="text-sm text-muted">No notes matched.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-left shadow-card"
                onClick={() => {
                  onOpen(hit.spaceId, hit.id)
                }}
              >
                <span className="block text-sm font-medium">{hit.title.trim() || 'Untitled'}</span>
                <span className="text-xs text-muted">
                  {hit.spaceName}
                  {hit.pinned ? ' · Pinned' : ''}
                  {hit.tags.length > 0 ? ` · ${hit.tags.join(', ')}` : ''}
                </span>
                {hit.excerpt ? (
                  <span className="mt-1 block text-sm text-muted">
                    {hit.excerpt}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
