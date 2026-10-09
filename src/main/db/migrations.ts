import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  up: (db: Database.Database) => void
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE spaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
          description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
          color TEXT NOT NULL CHECK (length(color) = 7),
          icon TEXT NOT NULL CHECK (length(icon) BETWEEN 1 AND 32),
          status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'archived')),
          target_hours REAL CHECK (
            target_hours IS NULL OR (target_hours >= 0 AND target_hours <= 100000)
          ),
          target_date TEXT CHECK (
            target_date IS NULL OR target_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
          ),
          sort_order INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
    }
  },
  {
    version: 2,
    up(db) {
      db.exec(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          duration_sec INTEGER NOT NULL CHECK (duration_sec >= 0),
          resumed_at TEXT,
          note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
          is_open INTEGER NOT NULL CHECK (is_open IN (0, 1)),
          CHECK (
            (is_open = 1 AND ended_at IS NULL) OR
            (is_open = 0 AND ended_at IS NOT NULL AND resumed_at IS NULL)
          )
        );

        CREATE INDEX sessions_space_started ON sessions (space_id, started_at);
        CREATE UNIQUE INDEX sessions_one_open ON sessions (is_open) WHERE is_open = 1;
      `)
    }
  },
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE notes (
          id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
          content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 200000),
          pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX notes_space_updated ON notes (space_id, pinned DESC, updated_at DESC);

        CREATE TABLE tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 40)
        );

        CREATE TABLE note_tags (
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (note_id, tag_id)
        );

        CREATE INDEX note_tags_tag ON note_tags (tag_id);

        CREATE TABLE note_images (
          id TEXT PRIMARY KEY,
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          file_path TEXT NOT NULL CHECK (
            length(file_path) BETWEEN 8 AND 80 AND file_path NOT LIKE '%..%'
          ),
          created_at TEXT NOT NULL
        );

        CREATE INDEX note_images_note ON note_images (note_id);

        CREATE VIRTUAL TABLE notes_fts USING fts5(
          note_id UNINDEXED,
          search_text
        );
      `)
    }
  },
  {
    version: 4,
    up(db) {
      db.exec(`
        ALTER TABLE spaces ADD COLUMN daily_goal_min INTEGER CHECK (
          daily_goal_min IS NULL OR (daily_goal_min >= 1 AND daily_goal_min <= 1440)
        );
        ALTER TABLE spaces ADD COLUMN weekly_goal_min INTEGER CHECK (
          weekly_goal_min IS NULL OR (weekly_goal_min >= 1 AND weekly_goal_min <= 10080)
        );

        CREATE TABLE milestones (
          id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
          title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
          done INTEGER NOT NULL CHECK (done IN (0, 1)),
          done_at TEXT,
          sort_order INTEGER NOT NULL,
          CHECK ((done = 0 AND done_at IS NULL) OR (done = 1 AND done_at IS NOT NULL))
        );

        CREATE INDEX milestones_space_order ON milestones (space_id, sort_order);
      `)
    }
  },
  {
    version: 5,
    up(db) {
      db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 40),
          value TEXT NOT NULL CHECK (length(value) <= 200)
        );
      `)
    }
  }
]
