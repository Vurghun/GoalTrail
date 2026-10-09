# Contributing to GoalTrail

GoalTrail is a local desktop app. Database and file access stay in the Electron main process. The window talks to it through the typed `window.api` bridge in `shared/ipc.ts`.

## Setup

Install Node.js 20.19 or newer, then:

```bash
npm install
npm run dev
```

If `better-sqlite3` fails to build on Windows, run `npm install --ignore-scripts` and then `npm run rebuild:native`.

Before you open a pull request:

```bash
npm run lint
npm run typecheck
```

`npm run build` does both the typecheck and the production compile.

## Commits

Use a [Conventional Commit](https://www.conventionalcommits.org/) subject:

```text
feat: add a weekly goal to the dashboard
fix: keep the timer paused after import
docs: describe the backup zip
refactor: share the week-start helper
test: cover backup validation
chore: bump electron-builder
```

The subject is one short line. Add a body when the reason is not obvious.

## Issues

Use the bug or feature template. Include the operating system and what you expected to happen.

## Data and secrets

Do not commit `.env` files, database files, or anything from `%APPDATA%\goaltrail` (or the macOS and Linux folders listed in the README). A backup zip is personal data too.
