import {
  Book,
  Camera,
  Code,
  Coffee,
  Cpu,
  Dumbbell,
  Flag,
  Flame,
  Globe,
  Heart,
  Leaf,
  Music,
  PenLine,
  Star,
  Target,
  Zap
} from 'lucide-react'
import { tint } from '@renderer/components/ui/icons'

export function IconTile({
  icon,
  color,
  size = 'md'
}: {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}): React.JSX.Element {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14 rounded-lg' : 'h-10 w-10'
  const glyph = size === 'lg' ? 22 : size === 'sm' ? 15 : 18
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${box}`}
      style={{ backgroundColor: tint(color), color }}
    >
      <Glyph icon={icon} size={glyph} fallback={size === 'lg' ? 'text-2xl' : 'text-base'} />
    </span>
  )
}

function Glyph({
  icon,
  size,
  fallback
}: {
  icon: string
  size: number
  fallback: string
}): React.JSX.Element {
  const props = { size, strokeWidth: 1.75, 'aria-hidden': true as const }
  switch (icon) {
    case 'target':
      return <Target {...props} />
    case 'book':
      return <Book {...props} />
    case 'code':
      return <Code {...props} />
    case 'music':
      return <Music {...props} />
    case 'pen':
      return <PenLine {...props} />
    case 'star':
      return <Star {...props} />
    case 'flag':
      return <Flag {...props} />
    case 'heart':
      return <Heart {...props} />
    case 'leaf':
      return <Leaf {...props} />
    case 'flame':
      return <Flame {...props} />
    case 'zap':
      return <Zap {...props} />
    case 'coffee':
      return <Coffee {...props} />
    case 'globe':
      return <Globe {...props} />
    case 'camera':
      return <Camera {...props} />
    case 'cpu':
      return <Cpu {...props} />
    case 'dumbbell':
      return <Dumbbell {...props} />
    default:
      return (
        <span className={fallback} aria-hidden>
          {icon || '•'}
        </span>
      )
  }
}
