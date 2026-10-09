import { useCallback, useEffect, useState } from 'react'
import type { SpaceGoals } from '@shared/progress'
import type { Space, SpaceDraft } from '@shared/spaces'
import { errorMessage } from '@renderer/lib/errors'

function compareSpaces(a: Space, b: Space): number {
  return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
}

export function useSpaces(): {
  spaces: Space[]
  loading: boolean
  error: string | null
  createSpace: (draft: SpaceDraft) => Promise<Space>
  updateSpace: (id: string, draft: SpaceDraft) => Promise<Space>
  deleteSpace: (id: string) => Promise<void>
  moveSpace: (id: string, direction: -1 | 1) => Promise<void>
  placeSpace: (id: string, beforeId: string | null) => Promise<void>
  setSpaceGoals: (id: string, goals: SpaceGoals) => Promise<Space>
} {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const next = await window.api.listSpaces()
        if (!active) return
        setSpaces(next.sort(compareSpaces))
      } catch (loadError: unknown) {
        if (active) setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const createSpace = useCallback(async (draft: SpaceDraft) => {
    const created = await window.api.createSpace(draft)
    setSpaces((current) => [...current, created].sort(compareSpaces))
    setError(null)
    return created
  }, [])

  const updateSpace = useCallback(async (id: string, draft: SpaceDraft) => {
    const updated = await window.api.updateSpace(id, draft)
    setSpaces((current) =>
      current.map((space) => (space.id === id ? updated : space)).sort(compareSpaces)
    )
    setError(null)
    return updated
  }, [])

  const setSpaceGoals = useCallback(async (id: string, goals: SpaceGoals) => {
    const updated = await window.api.setSpaceGoals(id, goals)
    setSpaces((current) => current.map((space) => (space.id === id ? updated : space)))
    setError(null)
    return updated
  }, [])

  const deleteSpace = useCallback(async (id: string) => {
    await window.api.deleteSpace(id)
    setSpaces((current) => current.filter((space) => space.id !== id))
    setError(null)
  }, [])

  const moveSpace = useCallback(
    async (id: string, direction: -1 | 1) => {
      const ordered = spaces.slice().sort(compareSpaces)
      const current = ordered.filter((space) => space.status !== 'archived')
      const archived = ordered.filter((space) => space.status === 'archived')
      const group = current.some((space) => space.id === id) ? current : archived
      const index = group.findIndex((space) => space.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= group.length) return

      const nextGroup = group.slice()
      const [moved] = nextGroup.splice(index, 1)
      if (!moved) return
      nextGroup.splice(target, 0, moved)

      const ids =
        group === current
          ? [...nextGroup, ...archived].map((space) => space.id)
          : [...current, ...nextGroup].map((space) => space.id)

      try {
        const reordered = await window.api.reorderSpaces(ids)
        setSpaces(reordered.sort(compareSpaces))
        setError(null)
      } catch (moveError: unknown) {
        setError(errorMessage(moveError))
      }
    },
    [spaces]
  )

  const placeSpace = useCallback(
    async (id: string, beforeId: string | null) => {
      if (id === beforeId) return
      const ordered = spaces.slice().sort(compareSpaces)
      const current = ordered.filter((space) => space.status !== 'archived')
      const archived = ordered.filter((space) => space.status === 'archived')
      const inCurrent = current.some((space) => space.id === id)
      const group = inCurrent ? current : archived
      const from = group.findIndex((space) => space.id === id)
      if (from < 0) return
      const next = group.slice()
      const [moved] = next.splice(from, 1)
      if (!moved) return
      if (beforeId === null) next.push(moved)
      else {
        const to = next.findIndex((space) => space.id === beforeId)
        if (to < 0) return
        next.splice(to, 0, moved)
      }
      const ids = (inCurrent ? [...next, ...archived] : [...current, ...next]).map((space) => space.id)
      try {
        const reordered = await window.api.reorderSpaces(ids)
        setSpaces(reordered.sort(compareSpaces))
        setError(null)
      } catch (moveError: unknown) {
        setError(errorMessage(moveError))
      }
    },
    [spaces]
  )

  return {
    spaces,
    loading,
    error,
    createSpace,
    updateSpace,
    deleteSpace,
    moveSpace,
    placeSpace,
    setSpaceGoals
  }
}
