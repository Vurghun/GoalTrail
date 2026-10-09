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
  Zap,
  type LucideIcon
} from 'lucide-react'

export const SPACE_ICON_OPTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'target', label: 'Target', icon: Target },
  { id: 'book', label: 'Book', icon: Book },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'star', label: 'Star', icon: Star },
  { id: 'flag', label: 'Flag', icon: Flag },
  { id: 'heart', label: 'Heart', icon: Heart },
  { id: 'leaf', label: 'Leaf', icon: Leaf },
  { id: 'flame', label: 'Flame', icon: Flame },
  { id: 'zap', label: 'Energy', icon: Zap },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'globe', label: 'Globe', icon: Globe },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'cpu', label: 'Chip', icon: Cpu },
  { id: 'dumbbell', label: 'Training', icon: Dumbbell }
]

export function tint(color: string, amount = 0.14): string {
  return `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, transparent)`
}
