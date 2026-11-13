import type { Space } from '@shared/spaces'
import { NotesBrowser } from '@renderer/components/NotesBrowser'

export function NotesPage({ spaces }: { spaces: Space[] }): React.JSX.Element {
  return (
    <NotesBrowser
      spaces={spaces}
      lockedSpaceId={null}
      focusNoteId={null}
      reloadToken={0}
      variant="page"
    />
  )
}
