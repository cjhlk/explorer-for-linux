import type { DirEntry } from '../shared/ipc'

const GLYPH = {
  folder: '\uE8B7',
  folderOpen: '\uE838',
  drive: '\uEDA2',
  file: '\uE8A5',
  image: '\uE91B',
  video: '\uE8B2',
  audio: '\uE8D6',
  archive: '\uEDA4',
  pdf: '\uEF50',
  text: '\uE9F9',
  code: '\uE943',
  word: '\uEDE9',
  excel: '\uEDEC',
  powerpoint: '\uEDEF',
  app: '\uE756',
  link: '\uE71B',
  package: '\uE7D8',
  database: '\uE8A1',
  font: '\uE8D2'
} as const

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'avif', 'heic', 'tiff', 'raw'])
const VIDEO_EXT = new Set(['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'm2ts', 'ogv'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'wma', 'mid', 'midi'])
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'iso', 'deb', 'rpm', 'tgz'])
const TEXT_EXT = new Set(['txt', 'log', 'md', 'csv', 'conf', 'ini', 'cfg', 'env', 'yml', 'yaml', 'json', 'xml', 'toml', 'sh', 'bash', 'zsh'])
const CODE_EXT = new Set(['js', 'jsx', 'ts', 'tsx', 'vue', 'py', 'c', 'h', 'cpp', 'hpp', 'java', 'go', 'rs', 'rb', 'php', 'sql', 'html', 'css', 'scss', 'sass', 'lua', 'swift', 'kt', 'dart', 'sqlite'])
const APP_EXT = new Set(['AppImage', 'exe', 'msi', 'x86_64', 'sh'])

export function glyphForEntry(entry: DirEntry): string {
  if (entry.isDirectory) return GLYPH.folder
  if (entry.isSymlink) return GLYPH.link
  const ext = entry.extension || ''
  if (IMAGE_EXT.has(ext)) return GLYPH.image
  if (VIDEO_EXT.has(ext)) return GLYPH.video
  if (AUDIO_EXT.has(ext)) return GLYPH.audio
  if (ARCHIVE_EXT.has(ext)) return GLYPH.archive
  if (ext === 'pdf') return GLYPH.pdf
  if (ext === 'doc' || ext === 'docx' || ext === 'odt' || ext === 'rtf') return GLYPH.word
  if (ext === 'xls' || ext === 'xlsx' || ext === 'ods' || ext === 'csv') return GLYPH.excel
  if (ext === 'ppt' || ext === 'pptx' || ext === 'odp') return GLYPH.powerpoint
  if (CODE_EXT.has(ext)) return GLYPH.code
  if (TEXT_EXT.has(ext)) return GLYPH.text
  if (APP_EXT.has(ext)) return GLYPH.app
  if (ext === 'db' || ext === 'sqlite' || ext === 'sqlite3') return GLYPH.database
  if (ext === 'ttf' || ext === 'otf' || ext === 'woff' || ext === 'woff2') return GLYPH.font
  return GLYPH.file
}

export function glyphForMount(): string {
  return GLYPH.drive
}

export function typeLabel(entry: DirEntry): string {
  if (entry.isDirectory) return '文件夹'
  if (entry.isSymlink) return '链接'
  if (entry.extension) return `${entry.extension.toUpperCase()} 文件`
  return '文件'
}

export const NAV_GLYPHS: Record<string, string> = {
  home: '\uE80F',
  desktop: '\uE8FC',
  documents: '\uE8A5',
  downloads: '\uE896',
  music: '\uE8D6',
  pictures: '\uE91B',
  videos: '\uE8B2',
  root: '\uE8B7',
  drive: '\uEDA2'
}
