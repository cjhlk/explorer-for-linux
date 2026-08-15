import type { ExplorerApi } from '../../electron/preload'

declare global {
  interface Window {
    explorer: ExplorerApi
  }
}

export {}
