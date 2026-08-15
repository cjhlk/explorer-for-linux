import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promises as fs, type Dirent, type Stats } from 'node:fs'
import { spawn, execFile } from 'node:child_process'
import { homedir, platform } from 'node:os'
import { promisify } from 'node:util'
import type { DirEntry, MountPoint, AppInfo, FsResult, AppNameResult, IconRequest, IconResponse } from '../src/shared/ipc'
import { resolveIcons } from './icons'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null

const execFileAsync = promisify(execFile)

function sendToRenderer(channel: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    title: 'Explorer',
    icon: path.join(process.env.VITE_PUBLIC, 'explorer.svg'),
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    frame: false,
    show: false,
    backgroundColor: '#F3F3F3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win?.show())

  const broadcastMaximize = () => sendToRenderer('win:maximized-change', win?.isMaximized() ?? false)
  win.on('maximize', broadcastMaximize)
  win.on('unmaximize', broadcastMaximize)

  win.webContents.on('did-finish-load', () => {
    sendToRenderer('win:maximized-change', win?.isMaximized() ?? false)
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ---------------------------------------------------------------------------
// File-system service
// ---------------------------------------------------------------------------

async function listDir(dirPath: string): Promise<DirEntry[]> {
  let dirents: Dirent[]
  try {
    dirents = await fs.readdir(dirPath, { withFileTypes: true })
  } catch (error) {
    throw new Error((error as Error).message)
  }

  const entries: DirEntry[] = []
  const stats = new Map<string, Stats>()
  const STAT_CONCURRENCY = 64
  for (let i = 0; i < dirents.length; i += STAT_CONCURRENCY) {
    const batch = dirents.slice(i, i + STAT_CONCURRENCY)
    const results = await Promise.all(batch.map(async (dirent) => {
      const full = path.join(dirPath, dirent.name)
      try {
        return [full, await fs.lstat(full)] as const
      } catch {
        return [full, null] as const
      }
    }))
    for (const [full, stat] of results) {
      if (stat) stats.set(full, stat)
    }
  }

  for (const dirent of dirents) {
    const full = path.join(dirPath, dirent.name)
    const stat = stats.get(full)
    entries.push({
      name: dirent.name,
      path: full,
      isDirectory: dirent.isDirectory(),
      isFile: dirent.isFile(),
      isSymlink: dirent.isSymbolicLink(),
      size: stat?.size ?? 0,
      mtime: stat?.mtimeMs ?? 0,
      mode: stat?.mode ?? 0,
      extension: dirent.isDirectory() ? '' : path.extname(dirent.name).slice(1).toLowerCase()
    })
  }
  return entries
}

async function statPath(target: string): Promise<DirEntry | null> {
  try {
    const stats = await fs.lstat(target)
    return {
      name: path.basename(target),
      path: target,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
      size: stats.size,
      mtime: stats.mtimeMs,
      mode: stats.mode,
      extension: stats.isDirectory() ? '' : path.extname(target).slice(1).toLowerCase()
    }
  } catch {
    return null
  }
}

const MOUNT_INFO = '/proc/self/mounts'
const DISK_FS_TYPES = new Set(['ext2', 'ext3', 'ext4', 'btrfs', 'xfs', 'f2fs', 'vfat', 'exfat', 'ntfs', 'ntfs3', 'hfsplus', 'zfs', 'jfs', 'reiserfs', 'nilfs2', 'bcachefs', 'apfs', 'erofs'])

async function readMounts(): Promise<MountPoint[]> {
  let data: string
  try {
    data = await fs.readFile(MOUNT_INFO, 'utf8')
  } catch {
    return []
  }

  const seen = new Set<string>()
  const mounts: MountPoint[] = []
  const lines = data.split('\n')
  const home = homedir()

  // Root mount always comes first
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const [device, mountpoint, fsType, optionsRaw] = line.split(' ')
    if (!mountpoint || !fsType || !optionsRaw) continue
    if (mountpoint.startsWith('/sys') || mountpoint.startsWith('/proc')
      || mountpoint.startsWith('/dev') || mountpoint.startsWith('/run')
      || mountpoint === '/snap') continue
    if (mountpoint !== '/' && !device.startsWith('/dev/') && !DISK_FS_TYPES.has(fsType)) continue
    if (seen.has(mountpoint)) continue

    const options = optionsRaw.split(',')
    seen.add(mountpoint)

    let total: number | null = null
    let free: number | null = null
    try {
      const sfs = await fs.statfs(mountpoint)
      total = sfs.blocks * sfs.bsize
      free = sfs.bavail * sfs.bsize
    } catch {
      /* statfs may fail for permission-restricted mounts */
    }

    let name: string
    if (mountpoint === '/') {
      name = 'Root'
    } else {
      name = path.basename(mountpoint)
      if (mountpoint === home) name = 'Home'
      if (!name) name = mountpoint
    }

    mounts.push({
      device,
      path: mountpoint,
      fsType,
      options,
      isRemovable: mountpoint === home
        ? false
        : (mountpoint.startsWith('/media/') || mountpoint.startsWith('/run/media/') || mountpoint.startsWith('/mnt/')),
      isReadonly: options.includes('ro'),
      total,
      free
    })
  }

  return mounts
}

function spawnDetached(command: string, args: string[]): Promise<FsResult> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, args, { detached: true, stdio: 'ignore' })
    } catch (error) {
      resolve({ ok: false, error: (error as Error).message })
      return
    }
    child.on('error', (error) => resolve({ ok: false, error: error.message }))
    child.on('spawn', () => {
      child.unref()
      resolve({ ok: true })
    })
  })
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = spawn('sh', ['-c', `command -v "${command}"`], { stdio: 'ignore' })
    probe.on('error', () => resolve(false))
    probe.on('exit', (code) => resolve(code === 0))
  })
}

async function openPath(target: string): Promise<FsResult> {
  const result = await spawnDetached('xdg-open', [target])
  if (result.ok) return result
  const gioResult = await spawnDetached('gio', ['open', target])
  if (gioResult.ok) return gioResult
  return { ok: false, error: 'No application found to open this item' }
}

const TERMINALS: Array<{ command: string; args: (dir: string) => string[] }> = [
  { command: 'konsole', args: (dir) => ['--workdir', dir] },
  { command: 'gnome-terminal', args: (dir) => ['--working-directory', dir] },
  { command: 'kitty', args: (dir) => ['--directory', dir] },
  { command: 'alacritty', args: (dir) => ['--working-directory', dir] },
  { command: 'wezterm', args: (dir) => ['start', '--cwd', dir] },
  { command: 'xfce4-terminal', args: (dir) => ['--working-directory', dir] },
  { command: 'tilix', args: (dir) => ['--working-directory', dir] },
  { command: 'terminator', args: (dir) => ['--working-directory', dir] },
  { command: 'xterm', args: (dir) => ['-e', 'bash', '-lc', `cd '${dir}' && exec bash`] }
]

async function openTerminal(dir: string): Promise<FsResult> {
  for (const candidate of TERMINALS) {
    if (!(await commandExists(candidate.command))) continue
    const result = await spawnDetached(candidate.command, candidate.args(dir))
    if (result.ok) return result
  }
  return { ok: false, error: 'No supported terminal emulator found' }
}

async function ensureUnique(target: string): Promise<string> {
  const dir = path.dirname(target)
  const ext = path.extname(target)
  const base = path.basename(target, ext)
  let candidate = target
  let counter = 1
  while (true) {
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
    candidate = path.join(dir, `${base} (${counter})${ext}`)
    counter += 1
  }
}

async function copyRecursive(source: string, destination: string): Promise<void> {
  const stats = await fs.lstat(source)
  if (stats.isDirectory()) {
    await fs.mkdir(destination, { recursive: true })
    const children = await fs.readdir(source)
    for (const child of children) {
      await copyRecursive(path.join(source, child), path.join(destination, child))
    }
    return
  }
  if (stats.isSymbolicLink()) {
    const link = await fs.readlink(source)
    await fs.symlink(link, destination)
    return
  }
  await fs.copyFile(source, destination)
}

async function removeRecursive(target: string): Promise<void> {
  await fs.rm(target, { recursive: true, force: true })
}

async function transfer(source: string, destDir: string, move: boolean): Promise<FsResult> {
  let target = await ensureUnique(path.join(destDir, path.basename(source)))
  try {
    if (move) {
      try {
        await fs.rename(source, target)
        return { ok: true }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'EXDEV') throw error
        await copyRecursive(source, target)
        await removeRecursive(source)
        return { ok: true }
      }
    }
    await copyRecursive(source, target)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

async function manualTrash(target: string): Promise<FsResult> {
  try {
    const trashRoot = path.join(homedir(), '.local', 'share', 'Trash')
    const filesDir = path.join(trashRoot, 'files')
    const infoDir = path.join(trashRoot, 'info')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.mkdir(infoDir, { recursive: true })

    const name = path.basename(target)
    let destName = name
    let counter = 1
    while (true) {
      try {
        await fs.access(path.join(filesDir, destName))
        destName = `${name}.${counter}`
        counter += 1
      } catch {
        break
      }
    }

    await fs.rename(target, path.join(filesDir, destName))
    const date = new Date().toISOString().replace(/\.\d{3}Z/, 'Z')
    const info = `[Trash Info]\nPath=${target.replace(/%/g, '%25').replace(/&/g, '&amp;')}\nDeletionDate=${date}\n`
    await fs.writeFile(path.join(infoDir, `${destName}.trashinfo`), info)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

async function trashPath(target: string): Promise<FsResult> {
  if (await commandExists('gio')) {
    const result = await execFileAsync('gio', ['trash', target]).then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error: (error as Error).message })
    )
    if (result.ok) return result
  }
  if (await commandExists('trash-put')) {
    const result = await execFileAsync('trash-put', [target]).then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error: (error as Error).message })
    )
    if (result.ok) return result
  }
  return manualTrash(target)
}

function registerIpcHandlers(): void {
  ipcMain.handle('fs:list', async (_event, dirPath: string): Promise<DirEntry[]> => listDir(dirPath))
  ipcMain.handle('fs:icons', async (_event, requests: IconRequest[]): Promise<IconResponse[]> => resolveIcons(requests))
  ipcMain.handle('fs:stat', async (_event, target: string): Promise<DirEntry | null> => statPath(target))
  ipcMain.handle('fs:mounts', async (): Promise<MountPoint[]> => readMounts())
  ipcMain.handle('app:info', async (): Promise<AppInfo> => ({
    version: app.getVersion(),
    platform: platform(),
    home: homedir(),
    root: path.parse(process.cwd()).root
  }))

  ipcMain.handle('fs:open', async (_event, target: string): Promise<FsResult> => openPath(target))
  ipcMain.handle('fs:open-terminal', async (_event, dir: string): Promise<FsResult> => openTerminal(dir))

  ipcMain.handle('fs:mkdir', async (_event, dir: string, name: string): Promise<AppNameResult> => {
    const target = await ensureUnique(path.join(dir, name))
    try {
      await fs.mkdir(target)
      return { ok: true, path: target }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string): Promise<FsResult> => {
    try {
      await fs.rename(oldPath, newPath)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('fs:write-text', async (_event, dir: string, name: string, content: string): Promise<AppNameResult> => {
    const target = await ensureUnique(path.join(dir, name))
    try {
      await fs.writeFile(target, content ?? '', { encoding: 'utf8' })
      return { ok: true, path: target }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('fs:trash', async (_event, target: string): Promise<FsResult> => trashPath(target))

  ipcMain.handle('fs:copy', async (_event, source: string, destDir: string): Promise<FsResult> => {
    if (path.dirname(source) === path.resolve(destDir)) return { ok: true }
    return transfer(source, destDir, false)
  })

  ipcMain.handle('fs:move', async (_event, source: string, destDir: string): Promise<FsResult> => {
    if (path.dirname(source) === path.resolve(destDir)) return { ok: true }
    return transfer(source, destDir, true)
  })

  ipcMain.on('win:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('win:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.on('win:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('win:is-maximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
}

app.on('window-all-closed', () => {
  if (platform() !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
