import { promises as fs } from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { IconRequest, IconResponse } from '../src/shared/ipc'

const execFileAsync = promisify(execFile)

const DATA_HOME = process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share')
const ICON_THEME_ROOTS = [
  path.join(DATA_HOME, 'icons'),
  '/usr/local/share/icons',
  '/usr/share/icons',
  '/usr/share/pixmaps'
]

const SIZES = [512, 256, 128, 96, 64, 48, 32, 24, 22, 16]
const CATEGORIES = ['mimetypes', 'apps', 'places', 'devices', 'status', 'emblems', 'actions']

const EXT_ICON_FALLBACK: Record<string, string> = {
  folder: 'folder',
  drive: 'drive-harddisk',
  image: 'image-x-generic',
  video: 'video-x-generic',
  audio: 'audio-x-generic',
  archive: 'application-x-archive',
  pdf: 'application-pdf',
  text: 'text-x-generic',
  code: 'text-x-generic',
  word: 'x-office-document',
  excel: 'x-office-spreadsheet',
  powerpoint: 'x-office-presentation',
  app: 'application-x-executable',
  font: 'font-x-generic',
  database: 'text-x-generic',
  link: 'emblem-symbolic-link',
  generic: 'text-x-generic'
}

const EXT_GROUPS: Array<{ group: keyof typeof EXT_ICON_FALLBACK; exts: string[] }> = [
  { group: 'image', exts: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'avif', 'heic', 'tiff', 'raw'] },
  { group: 'video', exts: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'm2ts', 'ogv'] },
  { group: 'audio', exts: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'wma', 'mid', 'midi'] },
  { group: 'archive', exts: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'iso', 'deb', 'rpm', 'tgz', 'snap'] },
  { group: 'pdf', exts: ['pdf'] },
  { group: 'text', exts: ['txt', 'log', 'md', 'csv', 'conf', 'ini', 'cfg', 'env', 'yml', 'yaml', 'json', 'xml', 'toml', 'sh', 'bash', 'zsh'] },
  { group: 'code', exts: ['js', 'jsx', 'ts', 'tsx', 'vue', 'py', 'c', 'h', 'cpp', 'hpp', 'java', 'go', 'rs', 'rb', 'php', 'sql', 'html', 'css', 'scss', 'sass', 'lua', 'swift', 'kt', 'dart'] },
  { group: 'word', exts: ['doc', 'docx', 'odt', 'rtf', 'wps'] },
  { group: 'excel', exts: ['xls', 'xlsx', 'ods', 'csv'] },
  { group: 'powerpoint', exts: ['ppt', 'pptx', 'odp'] },
  { group: 'app', exts: ['AppImage', 'exe', 'run', 'bin', 'out'] },
  { group: 'font', exts: ['ttf', 'otf', 'woff', 'woff2'] },
  { group: 'database', exts: ['db', 'sqlite', 'sqlite3'] }
]

function fallbackIconForExtension(extension: string): string {
  const ext = extension.toLowerCase()
  for (const group of EXT_GROUPS) {
    if (group.exts.includes(ext)) return EXT_ICON_FALLBACK[group.group]
  }
  return EXT_ICON_FALLBACK.generic
}

// ---------------------------------------------------------------------------
// Icon theme resolution
// ---------------------------------------------------------------------------

let cachedTheme: string | null = null

async function getIconTheme(): Promise<string> {
  if (cachedTheme) return cachedTheme

  try {
    const { stdout } = await execFileAsync('gsettings', ['get', 'org.gnome.desktop.interface', 'icon-theme'], { timeout: 2000 })
    const value = stdout.trim().replace(/^'|'$/g, '')
    if (value) {
      cachedTheme = value
      return value
    }
  } catch {
    /* gsettings unavailable */
  }

  try {
    const ini = await fs.readFile(path.join(homedir(), '.config', 'gtk-3.0', 'settings.ini'), 'utf8')
    const match = ini.match(/gtk-icon-theme-name\s*=\s*(.+)/i)
    if (match?.[1]) {
      cachedTheme = match[1].trim()
      return cachedTheme
    }
  } catch {
    /* no gtk settings */
  }

  cachedTheme = 'Adwaita'
  return cachedTheme
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function readInherits(themeRoot: string, theme: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(themeRoot, theme, 'index.theme'), 'utf8')
    const match = content.match(/Inherits\s*=\s*(.+)/i)
    return match ? match[1].split(',').map((s) => s.trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

async function findIconInRoot(themeRoot: string, theme: string, name: string): Promise<string | null> {
  const base = path.join(themeRoot, theme)
  const direct = [
    path.join(base, 'scalable', `${name}.svg`),
    path.join(base, 'scalable', 'mimetypes', `${name}.svg`),
    path.join(base, 'scalable', 'apps', `${name}.svg`),
    path.join(base, 'scalable', 'places', `${name}.svg`),
    path.join(base, 'scalable', 'devices', `${name}.svg`),
    path.join(base, 'scalable', 'status', `${name}.svg`)
  ]
  for (const candidate of direct) {
    if (await pathExists(candidate)) return candidate
  }
  for (const size of SIZES) {
    for (const category of CATEGORIES) {
      for (const ext of ['png', 'svg']) {
        const candidate = path.join(base, String(size), category, `${name}.${ext}`)
        if (await pathExists(candidate)) return candidate
      }
    }
  }
  return null
}

const iconFileCache = new Map<string, string | null>()

async function resolveIconFile(name: string): Promise<string | null> {
  if (!name) return null
  if (iconFileCache.has(name)) return iconFileCache.get(name) ?? null

  const theme = await getIconTheme()
  const visited = new Set<string>()
  const queue = [theme, 'hicolor']
  let found: string | null = null

  while (queue.length) {
    const current = queue.shift() as string
    if (visited.has(current)) continue
    visited.add(current)
    for (const root of ICON_THEME_ROOTS) {
      const file = await findIconInRoot(root, current, name)
      if (file) {
        found = file
        break
      }
    }
    if (found) break
    for (const root of ICON_THEME_ROOTS) {
      const inherits = await readInherits(root, current)
      for (const inherit of inherits) {
        if (!visited.has(inherit) && !queue.includes(inherit)) queue.push(inherit)
      }
    }
  }

  iconFileCache.set(name, found)
  return found
}

async function fileToDataUrl(file: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(file)
    const mime = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

const dataUrlCache = new Map<string, string | null>()

async function resolveIconDataUrl(name: string): Promise<string | null> {
  if (dataUrlCache.has(name)) return dataUrlCache.get(name) ?? null
  const file = await resolveIconFile(name)
  const dataUrl = file ? await fileToDataUrl(file) : null
  dataUrlCache.set(name, dataUrl)
  return dataUrl
}

// ---------------------------------------------------------------------------
// Icon name detection via gio
// ---------------------------------------------------------------------------

async function queryIconNames(paths: string[]): Promise<string[][]> {
  const results: string[][] = paths.map(() => [])
  if (!paths.length) return results
  try {
    const script = 'for p in "$@"; do gio info -a standard::icon "$p" 2>/dev/null | sed -n "s/^[[:space:]]*standard::icon:[[:space:]]*//p" | head -1 | tr -d "\\n"; echo; done'
    const child = spawn('sh', ['-c', script, 'sh', ...paths], { stdio: ['ignore', 'pipe', 'ignore'] })
    const stdout = await new Promise<string>((resolve) => {
      let out = ''
      child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString() })
      child.on('close', () => resolve(out))
      child.on('error', () => resolve(''))
      setTimeout(() => resolve(out), 15000)
    })
    const lines = stdout.split('\n')
    for (let i = 0; i < paths.length; i++) {
      results[i] = (lines[i] ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    }
  } catch {
    /* fall back to extension mapping */
  }
  return results
}

export async function resolveIcons(requests: IconRequest[]): Promise<IconResponse[]> {
  const fileRequests = requests.filter((request) => !request.name)
  const candidateNames = new Map<number, string[]>()
  for (let i = 0; i < requests.length; i++) {
    if (requests[i].name) candidateNames.set(i, [requests[i].name as string])
  }

  if (fileRequests.length) {
    const detected = await queryIconNames(fileRequests.map((request) => request.path))
    let fileIndex = 0
    for (let i = 0; i < requests.length; i++) {
      if (candidateNames.has(i)) continue
      const request = requests[i]
      let candidates = detected[fileIndex]
      if (!candidates.length) {
        candidates = request.isDirectory
          ? ['folder']
          : [fallbackIconForExtension(path.extname(request.path).slice(1))]
      }
      candidateNames.set(i, candidates)
      fileIndex += 1
    }
  }

  const responses: IconResponse[] = []
  for (let i = 0; i < requests.length; i++) {
    let dataUrl: string | null = null
    for (const name of candidateNames.get(i) ?? []) {
      const resolved = await resolveIconDataUrl(name)
      if (resolved) {
        dataUrl = resolved
        break
      }
    }
    responses.push({ path: requests[i].path, dataUrl })
  }
  return responses
}
