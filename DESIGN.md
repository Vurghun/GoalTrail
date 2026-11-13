# GoalTrail design

Visual system for the desktop app. Tokens live in `src/renderer/src/assets/main.css`. Tailwind v4 reads them through `@theme inline`, so utilities such as `bg-surface` and `text-muted` follow the active theme.

The identity is monochrome and meant to read as finished, not as a wireframe. Light is the designed default: white surfaces, near-black text, gray for secondary copy, and hairline dividers. Black is used decisively for the selected navigation item, primary buttons, progress fills, and a short rule on the top of a stat card. Progress is a 6px track (`.meter`), not a hairline. Dark uses the same system inverted. Color is not the product. A space can still carry a small color mark, and Settings can optionally tint buttons and the activity grid.

## Color

| Token             | Light               | Dark                      | Use                                  |
| ----------------- | ------------------- | ------------------------- | ------------------------------------ |
| `--bg`            | `#f7f7f7`           | `#000000`                 | App background                       |
| `--surface`       | `#ffffff`           | `#0c0c0c`                 | Cards, sidebar, menus                |
| `--raised`        | `#ffffff`           | `#141414`                 | Popovers                             |
| `--border`        | `rgb(0 0 0 / 0.08)` | `rgb(255 255 255 / 0.10)` | Hairline borders                     |
| `--line`          | `rgb(0 0 0 / 0.16)` | `rgb(255 255 255 / 0.18)` | Stronger borders, hover              |
| `--text`          | `#111111`           | `#f4f4f4`                 | Primary text and ink buttons         |
| `--muted`         | `#5c5c5c`           | `#a6a6a6`                 | Secondary text                       |
| `--faint`         | `#737373`           | `#8a8a8a`                 | Hints and placeholders               |
| `--accent`        | `#111111`           | `#f4f4f4`                 | Primary actions, focus, active marks |
| `--accent-strong` | `#000000`           | `#ffffff`                 | Primary hover                        |
| `--accent-soft`   | `#f0f0f0`           | `#1a1a1a`                 | Quiet hover and selected nav         |
| `--on-accent`     | `#ffffff`           | `#0c0c0c`                 | Label on a primary button            |
| `--success`       | `#1f7a4d`           | `#8fcea8`                 | Positive deltas                      |
| `--warning`       | `#8a5a00`           | `#e6c37a`                 | Unsaved changes                      |
| `--danger`        | `#b42318`           | `#f0a8a2`                 | Delete and errors                    |

Charts use `--chart-1` through `--chart-6`, an ink ramp, so a dashboard does not turn into a color key. Each space still stores a color. `IconTile` shows it as a short inset bar on an otherwise neutral tile.

`--shadow-card` is none. Cards separate with a hairline.

## Type

Inter, weights 400 / 500 / 600, loaded with `@fontsource/inter`.

Scale: 12, 13, 14, 15, 16, 20, 28, 32, 40. Page titles are large and tightly tracked. Times and stats use `tabular-nums`.

## Space, radius, motion

Spacing follows 4, 8, 12, 16, 24, 32, 48. Page columns use generous padding. The milestones list caps near 720px. Dashboard and a space cap near 1080–1120px.

Radius: 8 (`rounded-md` / `--radius-sm`), 12 (`--radius-md`), 16 (`--radius-lg`).

Motion is short and tied to a change:

| Token        | Value                            |
| ------------ | -------------------------------- |
| `--dur-fast` | 120ms                            |
| `--dur-base` | 200ms                            |
| `--dur-slow` | 320ms                            |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |

View changes fade and rise (`ViewTransition`, Motion). Milestone rows enter, leave, and reorder. The space tab underline shares a `layoutId`. Progress meters use `.meter-fill`. A running timer is a small `.timer-dot`, not a glow. Completing a milestone fills the check (`.check-in`) and, on the Open filter, the row leaves the list.

`MotionConfig reducedMotion="user"` drops transform and layout motion when the system asks for it. `prefers-reduced-motion: reduce` also collapses CSS animation and transition durations. Hover and press stay on color and a 0.98 scale only when motion is allowed.

## Components

- `Button` — `primary` (ink fill, `--on-accent` label), `secondary`, `ghost`, `danger`.
- `fieldClass` / `labelClass` in `components/ui/styles.ts` — inputs, textareas, selects, dates.
- `IconTile` — Lucide icon or a short emoji on a neutral tile, with the space color as an inset bar. Icon ids live in `components/ui/icons.ts`.
- `ThemeToggle` — sun / moon / monitor. It lives in Settings. The command palette can still cycle the theme.
- `TimerBar` — header chip while a timer is open.
- `MilestoneBoard` — the milestones section, used as its own page and as a space tab. Add, rename, complete, reorder, and delete the existing milestone records.
- `CommandPalette` — Ctrl K. Searches spaces and notes, opens milestones, can start a timer, or hand the query to note search.
- `ConfirmDialog` — destructive confirmation.
- `ToastHost` + `pushToast` — short confirmation after save, archive, timer, and backup.
- Charts in `DashboardCharts` — ink ramp, minute/hour ticks, bars, donut with a center total.

The sidebar is 260px and collapses to an icon rail (`goaltrail.sidebar` in localStorage). Dashboard and Milestones sit at the top. Settings sits at the bottom, with the collapse control. Version and data location stay in Settings.

## Accent and density

`html[data-accent]` defaults to `ink`. Optional values are `indigo`, `emerald`, `rose`, and `amber`. They retint buttons, focus, and the activity grid. They are a setting, not the identity. `html[data-density='compact']` tightens `.shadow-card` padding to 12px. Both are stored in the settings table and mirrored to localStorage so the first paint matches.

## Structure

- Dashboard: today, the week (opens the review), a short milestone summary, charts, spaces, recent notes.
- Review: this week against last week, time by space, milestones finished, and one sentence drawn from that data.
- Milestones: one list for every space. Open items with a date sort overdue first. A target date is optional. A space also has a Milestones tab with the same board.
- Notes: a list for the whole app, and the same list inside a space. Search, sort by edited, created, or title, and pin. A note can hold several images, added together from the picker, the clipboard, or a drop. Images stay in the local images folder next to the database and travel with backups. Click one to see it larger. Removing it, or deleting the note, deletes the file.
- History: saved sessions across the app, or filtered to one space. Notes and durations can be edited. A space home links here.
- Space: overview is the home (today, this week, the next milestone, recent sessions). Name, description, icon, and color live behind Edit. Icons in that form are monochrome line icons. Milestones, notes, and progress stay as tabs. Progress keeps the score, goals, heatmap, and activity.
- Focus mode: full-window timer, neutral field, quick note, optional Pomodoro ring.
- Settings: Appearance, Timer, Data, and About.

## Signature UI

- Command palette (Ctrl K): actions, spaces, timers, notes, and recent items. Arrow keys move, Enter runs.
- Shortcuts: `N` new note, `T` start or stop, `G` then `D` dashboard, `G` then `R` weekly review, `G` then `M` milestones, `G` then `N` notes, `G` then `H` session history, `?` cheat sheet, Esc closes overlays.
- Focus mode: full-window timer, quick note, optional Pomodoro ring.
- Mini timer: a small always-on-top window opened from the header while a timer is running.
- A short burst when a streak hits 3, 7, or 30, a space reaches its hour target, or today beats every earlier day in the chart.
- New space opens a template picker. An empty library shows a three-step welcome.
