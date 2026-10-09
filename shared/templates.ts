import { SPACE_COLORS, type SpaceDraft } from './spaces'

export interface SpaceTemplate {
  id: string
  name: string
  blurb: string
  draft: SpaceDraft
}

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  {
    id: 'language',
    name: 'Learn a language',
    blurb: 'Vocabulary, listening, and speaking.',
    draft: draft('Learn a language', 'Daily practice, even for a few minutes.', 'globe', SPACE_COLORS[5], 100)
  },
  {
    id: 'code',
    name: 'Learn to code',
    blurb: 'Build something small and keep going.',
    draft: draft('Learn to code', 'Projects, exercises, and notes.', 'code', SPACE_COLORS[0], 80)
  },
  {
    id: 'book',
    name: 'Read a book',
    blurb: 'Pages, notes, and a finish line.',
    draft: draft('Read a book', 'Reading sessions and highlights.', 'book', SPACE_COLORS[1], 20)
  },
  {
    id: 'fitness',
    name: 'Fitness',
    blurb: 'Training that you can look back on.',
    draft: draft('Fitness', 'Workouts and how they felt.', 'dumbbell', SPACE_COLORS[4], 40)
  },
  {
    id: 'hobby',
    name: 'Hobby',
    blurb: 'Practice without turning it into a chore.',
    draft: draft('Hobby', 'A place for practice and ideas.', 'star', SPACE_COLORS[2], 30)
  },
  {
    id: 'custom',
    name: 'Custom',
    blurb: 'Start from a blank space.',
    draft: draft('', '', 'target', SPACE_COLORS[0], null)
  }
]

function draft(
  name: string,
  description: string,
  icon: string,
  color: string,
  targetHours: number | null
): SpaceDraft {
  return {
    name,
    description,
    icon,
    color,
    status: 'active',
    targetHours,
    targetDate: null
  }
}
