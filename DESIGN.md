# GoalTrail design

Visual system for the desktop app. Tokens live in `src/renderer/src/assets/main.css`. Tailwind v4 reads them through `@theme inline`, so utilities such as `bg-surface` and `text-muted` follow the active theme.

## Color

Cool indigo-tinted neutrals. Light and dark are separate palettes.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#f5f6fa` | `#0f1115` | App background |
| `--surface` | `#ffffff` | `#171a21` | Cards, sidebar, header |
| `--raised` | `#ffffff` | `#1e222b` | Popovers and menus |
| `--border` | `#e4e7ef` | `#2c313c` | Hairline borders |
| `--line` | `#cfd4e0` | `#3c4352` | Stronger borders, hover |
| `--text` | `#17191f` | `#f4f5f8` | Primary text |
| `--muted` | `#525866` | `#b4bac6` | Secondary text |
| `--faint` | `#5e6676` | `#8b93a3` | Hints and placeholders |
| `--accent` | `#4f46e5` | `#a5b4fc` | Primary actions, focus, active tab |
| `--accent-strong` | `#4338ca` | `#c7d2fe` | Primary hover |
| `--accent-soft` | `#eceefe` | `#232842` | Active nav, soft hover |
| `--success` | `#0b7a4b` | `#86efac` | Positive deltas |
| `--warning` | `#9a6700` | `#fcd34d` | Unsaved changes |
| `--danger` | `#c0362c` | `#fca5a5` | Delete and errors |

Each space keeps its own color. Icon tiles use that color at about 14% (`color-mix`) with the icon in the full color. Charts and progress use the space color directly.

Light cards use `--shadow-card`. Dark mode drops the shadow and relies on the border and a lighter surface.

## Type

Inter, weights 400 / 500 / 600, loaded with `@fontsource/inter`.

Scale: 12, 13, 14, 16, 20, 28, 36. Headings use tight tracking. Times and stats use `tabular-nums`.

## Space, radius, motion

Spacing follows 4, 8, 12, 16, 24, 32, 48.

Radius: 8 (`rounded-md` / `--radius-sm`), 12 (`--radius-md`), 16 (`--radius-lg`).

Transitions are 150–250ms ease-out. `.rise` fades content in. A running timer uses `.timer-glow` with the space color in `--timer`. `prefers-reduced-motion: reduce` shortens animation and transition durations.

## Components

- `Button` — `primary`, `secondary`, `ghost`, `danger`.
- `fieldClass` / `labelClass` in `components/ui/styles.ts` — inputs, textareas, selects, dates.
- `IconTile` — Lucide icon or a short emoji inside a tinted tile. Icon ids live in `components/ui/icons.ts`.
- `ThemeToggle` — sun / moon / monitor.
- `TimerBar` — header chip while a timer is open.
- `CommandPalette` — Ctrl K. Searches spaces and notes, can start a timer, or hand the query to note search.
- `ConfirmDialog` — destructive confirmation.
- `ToastHost` + `pushToast` — short confirmation after save, archive, timer, and backup.
- Charts in `DashboardCharts` — nice minute/hour ticks, rounded bars, donut with a center total.

Content columns cap around 1200px. The sidebar is 260px and collapses to an icon rail (`goaltrail.sidebar` in localStorage).

## Motion

| Token | Value |
| --- | --- |
| `--dur-fast` | 120ms |
| `--dur-base` | 200ms |
| `--dur-slow` | 320ms |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |

`.rise` fades pages and dialogs in. `.shimmer` is the loading skeleton. `.timer-glow` and `.focus-ambient` mark a running session. `prefers-reduced-motion: reduce` turns these off.

## Accent and density

`html[data-accent]` is `indigo` (default), `emerald`, `rose`, or `amber`. Dark accents are lighter and less saturated. `html[data-density='compact']` tightens `.shadow-card` padding to 12px. Both are stored in the settings table and mirrored to localStorage so the first paint matches.

## Signature UI

- Command palette (Ctrl K): actions, spaces, timers, notes, and recent items. Arrow keys move, Enter runs.
- Shortcuts: `N` new note, `T` start or stop, `G` then `D` dashboard, `?` cheat sheet, Esc closes overlays.
- Focus mode: full-window timer, space-color glow, quick note, optional Pomodoro ring.
- Mini timer: a small always-on-top window opened from the header while a timer is running.
- Dashboard heatmap and plain-language goal insights.
- A short burst when a streak hits 3, 7, or 30, a space reaches its hour target, or today is the best day so far.
- New space opens a template picker. An empty library shows a three-step welcome.
- Settings groups Appearance, Timer, Data, and About. Data can export a zip backup, JSON, or CSV.
