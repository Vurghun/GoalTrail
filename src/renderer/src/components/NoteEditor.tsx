import { useEffect, useRef, useState } from 'react'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { Note, NoteDraft } from '@shared/notes'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { fieldClass } from '@renderer/components/ui/styles'
import { errorMessage } from '@renderer/lib/errors'

interface NoteEditorProps {
  note: Note
  onMeta: (note: Note) => void
  onDeleted: (id: string) => void
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const NoteImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView)
  }
})

export function NoteEditor({ note, onMeta, onDeleted }: NoteEditorProps): React.JSX.Element {
  const [title, setTitle] = useState(note.title)
  const [tags, setTags] = useState(note.tags)
  const [tagDraft, setTagDraft] = useState('')
  const [pinned, setPinned] = useState(note.pinned)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef<NoteDraft>({ title: note.title, content: note.content, tags: note.tags })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteIdRef = useRef(note.id)
  const onMetaRef = useRef(onMeta)
  const insertRef = useRef<(files: File[]) => Promise<void>>(async () => {})
  const saveRef = useRef<() => void>(() => {})

  const editor = useEditor({
    extensions: [
      StarterKit,
      NoteImage.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: 'Write here. Paste, drop, or insert images.' })
    ],
    content: note.content,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => {
      draftRef.current = { ...draftRef.current, content: current.getHTML() }
      saveRef.current()
    },
    editorProps: {
      attributes: { class: 'note-body' },
      transformPastedHTML: (html) => html.replace(/<img\b[^>]*>/gi, ''),
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData)
        if (files.length === 0) return false
        event.preventDefault()
        void insertRef.current(files)
        return true
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false
        const files = imageFiles(event.dataTransfer)
        if (files.length === 0) return false
        event.preventDefault()
        void insertRef.current(files)
        return true
      }
    }
  })

  useEffect(() => {
    noteIdRef.current = note.id
    onMetaRef.current = onMeta

    async function persist(draft: NoteDraft): Promise<void> {
      setSaveState('saving')
      setSaveError(null)
      try {
        const saved = await window.api.updateNote(noteIdRef.current, draft)
        setPinned(saved.pinned)
        setSaveState('saved')
        window.setTimeout(() => {
          setSaveState((current) => (current === 'saved' ? 'idle' : current))
        }, 1600)
        onMetaRef.current(saved)
      } catch (saveFailure: unknown) {
        setSaveState('error')
        setSaveError(errorMessage(saveFailure))
      }
    }

    saveRef.current = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setSaveState('pending')
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void persist(draftRef.current)
      }, 700)
    }

    insertRef.current = async (files) => {
      if (!editor) return
      const srcs: string[] = []
      let failure: unknown = null
      for (const file of files) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const saved = await window.api.saveNoteImage(noteIdRef.current, bytes, mimeOf(file))
          srcs.push(saved.src)
        } catch (imageError: unknown) {
          failure = imageError
        }
      }
      if (srcs.length > 0) {
        editor
          .chain()
          .focus()
          .insertContent(srcs.map((src) => ({ type: 'image', attrs: { src } })))
          .run()
        draftRef.current = { ...draftRef.current, content: editor.getHTML() }
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        await persist(draftRef.current)
      }
      if (failure) {
        setSaveState('error')
        setSaveError(errorMessage(failure))
      }
    }
  }, [editor, note.id, onMeta])

  useEffect(() => {
    const onView = (event: Event): void => {
      const src = (event as CustomEvent<string>).detail
      if (typeof src === 'string') setViewing(src)
    }
    window.addEventListener('goaltrail-view-image', onView)
    return () => {
      window.removeEventListener('goaltrail-view-image', onView)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (!timerRef.current) return
      clearTimeout(timerRef.current)
      void window.api.updateNote(noteIdRef.current, draftRef.current)
    }
  }, [])

  function updateDraft(next: NoteDraft): void {
    draftRef.current = next
    saveRef.current()
  }

  function addTag(): void {
    const name = tagDraft.trim()
    setTagDraft('')
    if (!name) return
    if (tags.some((tag) => tag.toLowerCase() === name.toLowerCase())) return
    const nextTags = [...tags, name]
    setTags(nextTags)
    updateDraft({ ...draftRef.current, tags: nextTags })
  }

  const saveLabel =
    saveState === 'pending' || saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'error'
          ? (saveError ?? 'Could not save')
          : ''

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <input
          value={title}
          aria-label="Note title"
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-faint"
          onChange={(event) => {
            const nextTitle = event.target.value
            setTitle(nextTitle)
            updateDraft({ ...draftRef.current, title: nextTitle })
          }}
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-accent-soft hover:text-text"
            onClick={() => {
              void window.api
                .setNotePinned(note.id, !pinned)
                .then((saved) => {
                  setPinned(saved.pinned)
                  onMeta(saved)
                })
                .catch((pinError: unknown) => {
                  setSaveState('error')
                  setSaveError(errorMessage(pinError))
                })
            }}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-muted hover:text-danger"
            onClick={() => {
              setConfirmingDelete(true)
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <p className={`min-h-4 text-xs ${saveState === 'error' ? 'text-danger' : 'text-faint'}`}>
        {saveLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => {
            editor.chain().focus().toggleBold().run()
          }}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => {
            editor.chain().focus().toggleItalic().run()
          }}
        />
        <ToolbarButton
          label="Heading"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => {
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }}
        />
        <ToolbarButton
          label="List"
          active={editor.isActive('bulletList')}
          onClick={() => {
            editor.chain().focus().toggleBulletList().run()
          }}
        />
        <ToolbarButton
          label="Image"
          active={false}
          onClick={() => {
            fileRef.current?.click()
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            event.target.value = ''
            if (files.length > 0) void insertRef.current(files)
          }}
        />
      </div>
      <div className="rounded-lg border border-border bg-surface px-3 py-2">
        <EditorContent editor={editor} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="rounded-md bg-bg px-2.5 py-1 text-xs"
            onClick={() => {
              const nextTags = tags.filter((item) => item !== tag)
              setTags(nextTags)
              updateDraft({ ...draftRef.current, tags: nextTags })
            }}
          >
            {tag} ×
          </button>
        ))}
        <input
          value={tagDraft}
          aria-label="Add a tag"
          placeholder="Add a tag"
          className={`${fieldClass} w-32 px-3 py-1 text-xs`}
          onChange={(event) => {
            setTagDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTag()
            }
          }}
          onBlur={() => {
            addTag()
          }}
        />
      </div>
      {viewing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-10"
          onClick={() => {
            setViewing(null)
          }}
        >
          <img
            src={viewing}
            alt=""
            className="max-h-[80vh] max-w-[90vw] rounded-md object-contain"
            onClick={(event) => {
              event.stopPropagation()
            }}
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-surface px-3 py-2 text-sm font-medium"
              onClick={(event) => {
                event.stopPropagation()
                const src = viewing
                editor
                  .chain()
                  .focus()
                  .command(({ tr, state }) => {
                    let removed = false
                    state.doc.descendants((node, pos) => {
                      if (removed || node.type.name !== 'image' || node.attrs.src !== src) return
                      tr.delete(pos, pos + node.nodeSize)
                      removed = true
                      return false
                    })
                    return removed
                  })
                  .run()
                setViewing(null)
              }}
            >
              Remove
            </button>
            <button
              type="button"
              className="rounded-md bg-surface px-3 py-2 text-sm font-medium"
              onClick={(event) => {
                event.stopPropagation()
                setViewing(null)
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
      {confirmingDelete ? (
        <ConfirmDialog
          title={`Delete ${title.trim() || 'this note'}?`}
          body="This permanently removes the note and its images. This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => {
            setConfirmingDelete(false)
          }}
          onConfirm={() => {
            setConfirmingDelete(false)
            void window.api
              .deleteNote(note.id)
              .then(() => {
                onDeleted(note.id)
              })
              .catch((deleteError: unknown) => {
                setSaveState('error')
                setSaveError(errorMessage(deleteError))
              })
          }}
        />
      ) : null}
    </div>
  )
}

function NoteImageView({ node, deleteNode }: NodeViewProps): React.JSX.Element {
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : ''
  return (
    <NodeViewWrapper className="note-image">
      <button
        type="button"
        className="note-image-open"
        aria-label="View image"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('goaltrail-view-image', { detail: src }))
        }}
      >
        <img src={src} alt="" draggable={false} />
      </button>
      <button
        type="button"
        className="note-image-remove"
        aria-label="Remove image"
        onMouseDown={(event) => {
          event.preventDefault()
        }}
        onClick={() => {
          deleteNode()
        }}
      >
        Remove
      </button>
    </NodeViewWrapper>
  )
}

function ToolbarButton({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-sm ${
        active ? 'bg-accent text-on-accent' : 'border border-border'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  const fromFiles = [...data.files].filter(
    (file) => file.type.startsWith('image/') || file.name.length > 0
  )
  const images = fromFiles.filter(
    (file) => file.type.startsWith('image/') || hasImageExtension(file.name)
  )
  if (images.length > 0) return images
  return [...data.items]
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
}

function hasImageExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  )
}

function mimeOf(file: File): string {
  if (file.type === 'image/jpg') return 'image/jpeg'
  if (file.type.startsWith('image/')) return file.type
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  return file.type
}
