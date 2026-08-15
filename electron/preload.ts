import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DirEntry, MountPoint, AppInfo, FsResult, AppNameResult, IconRequest, IconResponse } from '../src/shared/ipc'

const api = {
  fs: {
    list: (dirPath: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:list', dirPath),
    icons: (requests: IconRequest[]): Promise<IconResponse[]> => ipcRenderer.invoke('fs:icons', requests),
    stat: (target: string): Promise<DirEntry | null> => ipcRenderer.invoke('fs:stat', target),
    mounts: (): Promise<MountPoint[]> => ipcRenderer.invoke('fs:mounts'),
    open: (target: string): Promise<FsResult> => ipcRenderer.invoke('fs:open', target),
    openTerminal: (dir: string): Promise<FsResult> => ipcRenderer.invoke('fs:open-terminal', dir),
    mkdir: (dir: string, name: string): Promise<AppNameResult> => ipcRenderer.invoke('fs:mkdir', dir, name),
    rename: (oldPath: string, newPath: string): Promise<FsResult> => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    writeText: (dir: string, name: string, content?: string): Promise<AppNameResult> => ipcRenderer.invoke('fs:write-text', dir, name, content ?? ''),
    trash: (target: string): Promise<FsResult> => ipcRenderer.invoke('fs:trash', target),
    copy: (source: string, destDir: string): Promise<FsResult> => ipcRenderer.invoke('fs:copy', source, destDir),
    move: (source: string, destDir: string): Promise<FsResult> => ipcRenderer.invoke('fs:move', source, destDir)
  },
  app: {
    info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info')
  },
  window: {
    minimize: (): void => ipcRenderer.send('win:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('win:toggle-maximize'),
    close: (): void => ipcRenderer.send('win:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:is-maximized'),
    onMaximizedChange: (callback: (maximized: boolean) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, maximized: boolean): void => callback(maximized)
      ipcRenderer.on('win:maximized-change', listener)
      return () => {
        ipcRenderer.removeListener('win:maximized-change', listener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('explorer', api)

export type ExplorerApi = typeof api
