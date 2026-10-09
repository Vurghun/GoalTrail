import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { MIGRATIONS } from './migrations'

let database: Database.Database | null = null

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'goaltrail.db')
}

export function openDatabase(): Database.Database {
  assertMigrationVersions()
  const directory = app.getPath('userData')
  mkdirSync(directory, { recursive: true })

  const db = new Database(getDatabasePath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  migrate(db)
  database = db
  return db
}

export function getDatabase(): Database.Database {
  if (!database) throw new Error('Database is not open.')
  return database
}

export function closeDatabase(): void {
  if (database?.open) database.close()
  database = null
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const currentRow = db
    .prepare<[], { version: number }>(
      'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations'
    )
    .get()
  const current = currentRow?.version ?? 0
  const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue
    const apply = db.transaction(() => {
      migration.up(db)
      insert.run(migration.version, new Date().toISOString())
    })
    apply()
  }
}

function assertMigrationVersions(): void {
  MIGRATIONS.forEach((migration, index) => {
    const expected = index + 1
    if (migration.version !== expected) {
      throw new Error(`Migration versions must be 1..n in order. Found ${migration.version}.`)
    }
  })
}
