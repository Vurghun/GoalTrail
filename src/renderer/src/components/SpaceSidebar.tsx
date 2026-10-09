import { useEffect, useState } from 'react'
import { Database, GripVertical, LayoutDashboard, PanelLeft, Plus, Settings } from 'lucide-react'
import type { AppInfo } from '@shared/ipc'
import type { Space } from '@shared/spaces'
import { IconTile } from '@renderer/components/ui/IconTile'
import { errorMessage } from '@renderer/lib/errors'

interface SpaceSidebarProps {
  spaces: Space[]
  loading: boolean
  error: string | null
  selectedId: string | null
  creating: boolean
  onSelect: (id: string) => void
  onStartCreate: () => void
  onMove: (id: string, direction: -1 | 1) => void
  onPlace: (id: string, beforeId: string | null) => void
  timingSpaceId: string | null
  timingRunning: boolean
  showingDashboard: boolean
  showingSettings: boolean
  onShowDashboard: () => void
  onShowSettings: () => void
}

export function SpaceSidebar(props: SpaceSidebarProps): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem('goaltrail.sidebar') === 'collapsed'
  )
  const current = props.spaces.filter((space) => space.status !== 'archived')
  const archived = props.spaces.filter((space) => space.status === 'archived')

  useEffect(() => {
    let active = true
    void window.api
      .getAppInfo()
      .then((next) => {
        if (active) setInfo(next)
      })
      .catch((loadError: unknown) => {
        if (active) setInfoError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [])

  function toggleCollapsed(): void {
    setCollapsed((value) => {
      const next = !value
      window.localStorage.setItem('goaltrail.sidebar', next ? 'collapsed' : 'open')
      return next
    })
  }

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      <div className={`flex items-center gap-2 px-3 py-4 ${collapsed ? 'justify-center' : ''}`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white dark:text-[#14161c]">
          G
        </span>
        {collapsed ? null : <span className="text-base font-semibold tracking-tight">GoalTrail</span>}
      </div>
      <nav className="space-y-1 px-2" aria-label="Main">
        <NavButton
          icon={LayoutDashboard}
          label="Dashboard"
          collapsed={collapsed}
          selected={props.showingDashboard}
          onClick={props.onShowDashboard}
        />
        <NavButton
          icon={Settings}
          label="Settings"
          collapsed={collapsed}
          selected={props.showingSettings}
          onClick={props.onShowSettings}
        />
      </nav>
      <div className={`mt-6 flex items-center px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {collapsed ? null : (
          <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Spaces</h2>
        )}
        <button
          type="button"
          aria-label="New space"
          title="New space"
          className={`flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-accent-soft hover:text-text ${
            props.creating ? 'bg-accent-soft text-accent' : ''
          }`}
          onClick={props.onStartCreate}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        {props.loading ? <p className="px-2 text-sm text-muted">Loading spaces…</p> : null}
        {props.error ? (
          <p className="px-2 text-sm text-danger" role="alert">
            {props.error}
          </p>
        ) : null}
        {!props.loading && props.spaces.length === 0 ? (
          <p className={`px-2 text-sm leading-relaxed text-muted ${collapsed ? 'sr-only' : ''}`}>
            No spaces yet. Create one for a subject like C++ or Guitar.
          </p>
        ) : null}
        <SpaceGroup
          title="Current"
          spaces={current}
          collapsed={collapsed}
          showTitle={archived.length > 0}
          {...sidebarRest(props)}
        />
        <SpaceGroup
          title="Archived"
          spaces={archived}
          collapsed={collapsed}
          showTitle
          {...sidebarRest(props)}
        />
      </div>
      <footer className="border-t border-border px-3 py-3">
        <button
          type="button"
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-text"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        >
          <PanelLeft size={16} />
        </button>
        {info ? (
          <p className={`text-xs text-faint ${collapsed ? 'sr-only' : ''}`} title={info.databasePath}>
            <span className="inline-flex items-center gap-1">
              <Database size={12} />
              {info.name} {info.version}
            </span>
            <span className="mt-1 block text-[11px] underline decoration-dotted">Data location</span>
          </p>
        ) : (
          <p className="text-xs text-faint">{infoError ?? 'Connecting…'}</p>
        )}
      </footer>
    </aside>
  )
}

function NavButton({
  icon: Icon,
  label,
  selected,
  collapsed,
  onClick
}: {
  icon: typeof LayoutDashboard
  label: string
  selected: boolean
  collapsed: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition duration-150 ease-out ${
        selected ? 'bg-accent-soft text-text' : 'text-muted hover:bg-accent-soft hover:text-text'
      } ${collapsed ? 'justify-center' : ''}`}
      onClick={onClick}
    >
      <span className={`h-4 w-0.5 rounded-full ${selected ? 'bg-accent' : 'bg-transparent'}`} />
      <Icon size={16} strokeWidth={1.75} />
      {collapsed ? <span className="sr-only">{label}</span> : label}
    </button>
  )
}

function sidebarRest(props: SpaceSidebarProps): Omit<SpaceSidebarProps, 'spaces'> {
  const { spaces, ...rest } = props
  void spaces
  return rest
}

function SpaceGroup({
  title,
  spaces,
  collapsed,
  showTitle,
  selectedId,
  onSelect,
  onMove,
  onPlace,
  timingSpaceId,
  timingRunning
}: SpaceSidebarProps & {
  title: string
  spaces: Space[]
  collapsed: boolean
  showTitle: boolean
}): React.JSX.Element | null {
  const [dragging, setDragging] = useState<string | null>(null)
  if (spaces.length === 0) return null
  return (
    <section>
      {showTitle && !collapsed ? (
        <h3 className="px-2 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">{title}</h3>
      ) : null}
      <ul className="space-y-0.5">
        {spaces.map((space, index) => {
          const running = timingRunning && timingSpaceId === space.id
          const selected = selectedId === space.id
          return (
            <li
              key={space.id}
              onDragOver={(event) => {
                event.preventDefault()
              }}
              onDrop={() => {
                if (dragging) onPlace(dragging, space.id)
                setDragging(null)
              }}
            >
              <div
                className={`group flex items-center gap-1 rounded-md pr-1 transition duration-150 ease-out ${
                  selected ? 'bg-accent-soft' : 'hover:bg-accent-soft'
                }`}
              >
                <button
                  type="button"
                  draggable
                  aria-label={`Reorder ${space.name}`}
                  className={`cursor-grab text-faint opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                    collapsed ? 'hidden' : ''
                  }`}
                  onDragStart={() => {
                    setDragging(space.id)
                  }}
                >
                  <GripVertical size={14} />
                </button>
                <button
                  type="button"
                  title={space.name}
                  className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left ${collapsed ? 'justify-center px-0' : ''}`}
                  onClick={() => {
                    onSelect(space.id)
                  }}
                >
                  <span className="relative">
                    <IconTile icon={space.icon} color={space.color} size="sm" />
                    {running ? (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" />
                    ) : null}
                  </span>
                  {collapsed ? null : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{space.name}</span>
                  )}
                </button>
                {collapsed ? null : (
                  <span className="hidden gap-0.5 group-focus-within:flex group-hover:flex">
                    <button
                      type="button"
                      aria-label={`Move ${space.name} up`}
                      disabled={index === 0}
                      className="rounded px-1 text-xs text-faint hover:text-text disabled:opacity-30"
                      onClick={() => {
                        onMove(space.id, -1)
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${space.name} down`}
                      disabled={index === spaces.length - 1}
                      className="rounded px-1 text-xs text-faint hover:text-text disabled:opacity-30"
                      onClick={() => {
                        onMove(space.id, 1)
                      }}
                    >
                      ↓
                    </button>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
