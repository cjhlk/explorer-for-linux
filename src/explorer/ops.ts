import { computed, reactive } from 'vue'
import { navigation, selection, clipboardState, clearSelection, navigateTo } from './state'
import type { DirEntry } from '../shared/ipc'

export type NameDialogMode = 'folder' | 'file' | 'rename'

export const ops = reactive({
  nameDialog: {
    open: false,
    title: '',
    message: '',
    value: '',
    mode: 'folder' as NameDialogMode,
    target: null as DirEntry | null
  },
  deleteDialog: {
    open: false,
    items: [] as Array<{ name: string; path: string }>
  },
  propsDialog: {
    open: false,
    entry: null as DirEntry | null
  },
  refreshTick: 0,
  statusText: ''
})

let statusTimer: ReturnType<typeof setTimeout> | null = null

export function flashStatus(message: string): void {
  ops.statusText = message
  if (statusTimer) clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    ops.statusText = ''
  }, 4000)
}

export function requestRefresh(): void {
  ops.refreshTick += 1
}

const currentDir = computed(() => navigation.currentTab.value?.path ?? '')

export const canPaste = computed(() => clipboardState.items.length > 0)

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export function copySelected(): void {
  if (!selection.value.length) return
  clipboardState.action = 'copy'
  clipboardState.items = selection.value.map((entry) => entry.path)
  flashStatus(`已复制 ${selection.value.length} 个项目`)
}

export function cutSelected(): void {
  if (!selection.value.length) return
  clipboardState.action = 'cut'
  clipboardState.items = selection.value.map((entry) => entry.path)
  flashStatus(`已剪切 ${selection.value.length} 个项目`)
}

export async function paste(): Promise<void> {
  if (!canPaste.value) return
  const dir = currentDir.value
  if (!dir) return
  for (const item of clipboardState.items) {
    const action = clipboardState.action === 'copy'
      ? window.explorer.fs.copy(item, dir)
      : window.explorer.fs.move(item, dir)
    const result = await action
    if (!result.ok) flashStatus(result.error ?? '操作失败')
  }
  if (clipboardState.action === 'cut') clipboardState.items = []
  requestRefresh()
}

// ---------------------------------------------------------------------------
// Create / rename / delete
// ---------------------------------------------------------------------------

export function newFolder(): void {
  ops.nameDialog.mode = 'folder'
  ops.nameDialog.title = '新建文件夹'
  ops.nameDialog.message = '输入文件夹名称：'
  ops.nameDialog.value = '新建文件夹'
  ops.nameDialog.target = null
  ops.nameDialog.open = true
}

export function newTextFile(): void {
  ops.nameDialog.mode = 'file'
  ops.nameDialog.title = '新建文本文档'
  ops.nameDialog.message = '输入文件名：'
  ops.nameDialog.value = '新建文本文档.txt'
  ops.nameDialog.target = null
  ops.nameDialog.open = true
}

export function renameSelected(): void {
  const entry = selection.value[0]
  if (!entry) return
  ops.nameDialog.mode = 'rename'
  ops.nameDialog.title = '重命名'
  ops.nameDialog.message = `输入新名称（当前：${entry.name}）：`
  ops.nameDialog.value = entry.name
  ops.nameDialog.target = entry
  ops.nameDialog.open = true
}

export async function onNameSubmit(value: string): Promise<void> {
  const dir = currentDir.value
  if (!dir) return
  const name = value.trim()
  if (!name) return
  if (ops.nameDialog.mode === 'folder') {
    const result = await window.explorer.fs.mkdir(dir, name)
    if (!result.ok) flashStatus(result.error ?? '创建失败')
    requestRefresh()
  } else if (ops.nameDialog.mode === 'file') {
    const result = await window.explorer.fs.writeText(dir, name, '')
    if (!result.ok) flashStatus(result.error ?? '创建失败')
    requestRefresh()
  } else if (ops.nameDialog.mode === 'rename' && ops.nameDialog.target) {
    const oldPath = ops.nameDialog.target.path
    const newPath = `${dir}/${name}`
    if (oldPath !== newPath) {
      const result = await window.explorer.fs.rename(oldPath, newPath)
      if (!result.ok) flashStatus(result.error ?? '重命名失败')
      else flashStatus(`已重命名为 “${name}”`)
    }
    requestRefresh()
  }
}

export function deleteSelected(): void {
  if (!selection.value.length) return
  ops.deleteDialog.items = selection.value.map((entry) => ({ name: entry.name, path: entry.path }))
  ops.deleteDialog.open = true
}

export async function confirmDelete(): Promise<void> {
  for (const item of ops.deleteDialog.items) {
    const result = await window.explorer.fs.trash(item.path)
    if (!result.ok) flashStatus(result.error ?? '删除失败')
  }
  if (ops.deleteDialog.items.length > 1) flashStatus(`已删除 ${ops.deleteDialog.items.length} 个项目`)
  clearSelection()
  requestRefresh()
}

export function showProperties(entry: DirEntry | null): void {
  ops.propsDialog.entry = entry
  ops.propsDialog.open = true
}

export function openEntry(entry: DirEntry): void {
  if (entry.isDirectory) {
    navigateTo(entry.path)
  } else {
    void window.explorer.fs.open(entry.path)
  }
}
