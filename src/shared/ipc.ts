export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
  size: number
  mtime: number
  mode: number
  extension: string
}

export interface MountPoint {
  device: string
  path: string
  fsType: string
  options: string[]
  isRemovable: boolean
  isReadonly: boolean
  total: number | null
  free: number | null
}

export interface AppInfo {
  version: string
  platform: string
  home: string
  root: string
}

export interface FsResult {
  ok: boolean
  error?: string
}

export interface RenameInput {
  oldPath: string
  newPath: string
}

export interface TransferInput {
  source: string
  destDir: string
}

export interface AppNameResult extends FsResult {
  path?: string
}

export interface WriteTextInput {
  dir: string
  name: string
  content?: string
}

export interface IconRequest {
  path: string
  name?: string
  isDirectory?: boolean
}

export interface IconResponse {
  path: string
  dataUrl: string | null
}
