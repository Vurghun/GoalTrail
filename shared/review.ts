import { formatHoursMinutes, localDateKey, startOfWeek } from './time'

export interface ReviewSpace {
  id: string
  name: string
  icon: string
  color: string
  thisSec: number
  lastSec: number
}

export interface ReviewMilestone {
  id: string
  spaceId: string
  spaceName: string
  title: string
  doneAt: string
}

export interface WeeklyReview {
  weekStart: string
  weekEnd: string
  thisSec: number
  lastSec: number
  activeDays: number
  spaces: ReviewSpace[]
  milestones: ReviewMilestone[]
  insight: string
}

export interface ReviewSessionInput {
  spaceId: string
  startedAt: string
  durationSec: number
}

export interface ReviewSpaceInput {
  id: string
  name: string
  icon: string
  color: string
}

export interface ReviewMilestoneInput {
  id: string
  spaceId: string
  spaceName: string
  title: string
  doneAt: string | null
}

export function assembleWeeklyReview(
  sessions: ReviewSessionInput[],
  spaces: ReviewSpaceInput[],
  milestones: ReviewMilestoneInput[],
  now = Date.now(),
  weekStartsOn = 1
): WeeklyReview {
  const start = startOfWeek(new Date(now), weekStartsOn)
  const previous = new Date(start)
  previous.setDate(previous.getDate() - 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const thisStart = localDateKey(start)
  const lastStart = localDateKey(previous)
  const thisEnd = localDateKey(end)

  const thisBySpace = new Map<string, number>()
  const lastBySpace = new Map<string, number>()
  const active = new Set<string>()

  for (const session of sessions) {
    if (session.durationSec <= 0) continue
    const key = localDateKey(new Date(session.startedAt))
    if (key >= thisStart && key <= thisEnd) {
      thisBySpace.set(
        session.spaceId,
        (thisBySpace.get(session.spaceId) ?? 0) + session.durationSec
      )
      active.add(key)
    } else if (key >= lastStart && key < thisStart) {
      lastBySpace.set(
        session.spaceId,
        (lastBySpace.get(session.spaceId) ?? 0) + session.durationSec
      )
    }
  }

  const byId = new Map(spaces.map((space) => [space.id, space]))
  const ids = new Set([...thisBySpace.keys(), ...lastBySpace.keys()])
  const rows: ReviewSpace[] = [...ids]
    .map((id) => {
      const space = byId.get(id)
      if (!space) return null
      return {
        id,
        name: space.name,
        icon: space.icon,
        color: space.color,
        thisSec: thisBySpace.get(id) ?? 0,
        lastSec: lastBySpace.get(id) ?? 0
      }
    })
    .filter((row): row is ReviewSpace => row !== null)
    .sort((a, b) => b.thisSec - a.thisSec || b.lastSec - a.lastSec)

  const finished = milestones
    .filter((milestone): milestone is ReviewMilestone => {
      if (!milestone.doneAt) return false
      const key = localDateKey(new Date(milestone.doneAt))
      return key >= thisStart && key <= thisEnd
    })
    .sort((a, b) => b.doneAt.localeCompare(a.doneAt))

  const thisSec = rows.reduce((sum, row) => sum + row.thisSec, 0)
  const lastSec = rows.reduce((sum, row) => sum + row.lastSec, 0)

  return {
    weekStart: thisStart,
    weekEnd: thisEnd,
    thisSec,
    lastSec,
    activeDays: active.size,
    spaces: rows,
    milestones: finished,
    insight: reviewInsight(thisSec, lastSec, rows, finished)
  }
}

function reviewInsight(
  thisSec: number,
  lastSec: number,
  spaces: ReviewSpace[],
  milestones: ReviewMilestone[]
): string {
  if (thisSec === 0 && lastSec === 0) {
    return 'No time recorded this week or last. One session is enough to start the comparison.'
  }
  if (thisSec === 0) {
    return `Nothing recorded this week yet. Last week was ${formatHoursMinutes(lastSec)}.`
  }

  const delta = thisSec - lastSec
  let comparison: string
  if (lastSec === 0) {
    comparison = `${formatHoursMinutes(thisSec)} recorded, the first week with time to compare.`
  } else if (Math.abs(delta) < 15 * 60) {
    comparison = `${formatHoursMinutes(thisSec)} this week, about even with last week.`
  } else if (delta > 0) {
    comparison = `${formatHoursMinutes(thisSec)} this week, ${formatHoursMinutes(delta)} ahead of last week.`
  } else {
    comparison = `${formatHoursMinutes(thisSec)} this week, ${formatHoursMinutes(-delta)} behind last week.`
  }

  const top = spaces.find((space) => space.thisSec > 0)
  const share = top && thisSec > 0 ? Math.round((top.thisSec / thisSec) * 100) : 0
  if (top && share >= 45) {
    return `${comparison} ${top.name} is ${share}% of it.`
  }
  if (milestones.length === 1) return `${comparison} You finished ${milestones[0]?.title}.`
  if (milestones.length > 1) return `${comparison} You finished ${milestones.length} milestones.`
  return comparison
}
