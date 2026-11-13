import type { Space } from '@shared/spaces'
import { NotesBrowser } from '@renderer/components/NotesBrowser'

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
  return (
    <NotesBrowser
      spaces={[space]}
      lockedSpaceId={space.id}
      focusNoteId={focusNoteId}
      reloadToken={reloadToken}
      variant="section"
    />
  )
}
