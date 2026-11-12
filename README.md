# GoalTrail

GoalTrail is a local-first desktop app for personal goals and study. Each goal is a space. You track time on it, keep notes (including images), and watch milestones, streaks, and charts. Your data stays on this computer.

## Screenshots

Images are not in the repo yet. Add them under [`docs/screenshots/`](docs/screenshots/README.md):

- `docs/screenshots/dashboard.png` — home dashboard
- `docs/screenshots/notes.png` — a note with an image
- `docs/screenshots/progress.gif` — milestones and the streak

## Features

- Spaces for subjects such as C++ or Guitar, with status, color, and order
- A timer, plus manual time entries
- A system tray icon and desktop notifications when a Pomodoro ends, a daily goal is reached, or you step away
- The timer pauses after a few minutes away, then asks whether to keep that time
- A short note when you stop a session
- Automatic backups on this computer, plus manual export and import
- Notes with formatting, tags, pinned notes, search, and pasted images
- Milestones, daily and weekly goals, streaks, and a progress score
- A dashboard with time charts and recent notes
- Light, dark, and system theme, and a choice of which day starts the week
- Export and import of all data, including images, as one zip file

Shortcuts (Command on macOS):

| Shortcut     | Action                                     |
| ------------ | ------------------------------------------ |
| Ctrl+K       | Focus search                               |
| Ctrl+N       | New note in the open space                 |
| Ctrl+Shift+T | Start or stop the timer for the open space |

## Install

When a version tag such as `v0.1.0` is pushed, GitHub Actions builds installers and attaches them to a draft release.

- Windows: `GoalTrail-<version>-setup.exe`
- macOS: `GoalTrail-<version>-<arch>.dmg` (the build is unsigned, so macOS may ask you to approve it)
- Linux: `GoalTrail-<version>-<arch>.AppImage` or the `.deb` package

You can also build an installer yourself. See [Build an installer](#build-an-installer).

## Develop

You need Node.js 20.19 or newer.

```bash
git clone <repository-url>
cd goaltrail
npm install
npm run dev
```

`npm install` rebuilds `better-sqlite3` for Electron. If that step fails on Windows, install the Visual Studio Build Tools, then run:

```bash
npm install --ignore-scripts
npm run rebuild:native
```

| Command                 | What it does                                 |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | Start the app with hot reload                |
| `npm run start`         | Open the last production build               |
| `npm run build`         | Typecheck and compile into `out/`            |
| `npm run lint`          | Run ESLint                                   |
| `npm run format`        | Format with Prettier                         |
| `npm run package`       | Build an installer for this operating system |
| `npm run package:win`   | Windows installer                            |
| `npm run package:mac`   | macOS disk image and zip                     |
| `npm run package:linux` | Linux AppImage and deb                       |

## Build an installer

```bash
npm run package:win
```

Use `package:mac` or `package:linux` on those systems. Installers are written to `dist/`.

`electron-builder` is the packaging tool. It is a dev dependency because the app needs Windows, macOS, and Linux installers, and it is not used while the app is running.

## Where data is stored

The database file is `goaltrail.db`. Note images sit in an `images` folder next to it. Settings shows the path and can open the folder.

| System  | Folder                                    |
| ------- | ----------------------------------------- |
| Windows | `%APPDATA%\goaltrail`                     |
| macOS   | `~/Library/Application Support/goaltrail` |
| Linux   | `~/.config/goaltrail`                     |

Set `GOALTRAIL_USER_DATA` to a folder path before launch to use a different data directory.

Export a backup from Settings. The zip holds the database contents and the images. Import replaces everything currently stored, after you confirm.

GoalTrail also writes a backup about once a day into a `backups` folder next to the database and keeps the latest 7. Settings shows when the last one was saved and can open that folder.

## Tray

Closing the window leaves GoalTrail running so a timer can keep going. While a timer is running, the tray icon's tooltip shows the space and the elapsed time. Click the icon to bring the window back. Quit from the tray menu, or from the app menu.

Desktop notifications are on by default. Turn them off in Settings, along with the evening reminder.

## Roadmap

Not planned for the current app:

- Cloud sync
- Accounts
- A mobile app
- AI features
- Collaboration

## License

[MIT](LICENSE)
