export const AUTO_BACKUP_KEEP = 7
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface BackupStatus {
  lastBackupAt: string | null
  directory: string
  kept: number
}

export function backupsToPrune<T extends { mtimeMs: number; name: string }>(
  files: T[],
  keep: number
): T[] {
  if (keep < 1) return [...files]
  const sorted = [...files].sort(
    (a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name)
  )
  return sorted.slice(keep)
}
