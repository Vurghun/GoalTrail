import type { AppInfo } from '@shared/ipc'

export function platformLabel(platform: AppInfo['platform']): string {
  if (platform === 'win32') return 'Windows'
  if (platform === 'darwin') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return platform
}
