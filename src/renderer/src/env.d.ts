/// <reference types="vite/client" />

import type { GoalTrailApi } from '@shared/ipc'

declare global {
  interface Window {
    api: GoalTrailApi
  }
}

export {}
