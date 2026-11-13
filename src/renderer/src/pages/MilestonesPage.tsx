import type { Space } from '@shared/spaces'
import { MilestoneBoard } from '@renderer/components/MilestoneBoard'

export function MilestonesPage({
  spaces,
  onOpenSpace
}: {
  spaces: Space[]
  onOpenSpace: (spaceId: string) => void
}): React.JSX.Element {
  return <MilestoneBoard spaces={spaces} variant="page" onOpenSpace={onOpenSpace} />
}
