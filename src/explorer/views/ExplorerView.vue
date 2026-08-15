<template>
  <div class="explorer-content" ref="viewRef" tabindex="-1">
    <div class="explorer-grid-host">
      <div v-if="loading" class="explorer-loading">
        <WinProgressRing IsActive />
      </div>

      <div v-else-if="error" class="explorer-error">
        <span class="empty-glyph">&#xE7BA;</span>
        <div>{{ error }}</div>
        <div class="explorer-actions-row">
          <WinButton @Click="requestRefresh">重试</WinButton>
        </div>
      </div>

      <div v-else-if="!filtered.length" class="explorer-empty">
        <span class="empty-glyph">&#xE8B7;</span>
        <div v-if="explorerState.search">没有与搜索匹配的项目</div>
        <div v-else>此文件夹为空</div>
      </div>

      <VirtualizedFiles
        v-else
        ref="vfilesRef"
        :items="filtered"
        :mode="isGridMode(settings.viewMode) ? 'grid' : 'list'"
        :tile-width="tileWidth"
        :tile-height="tileHeight"
        @item-click="onItemClick"
        @item-double-click="openEntry"
        @item-context-menu="onItemContextMenu"
        @background-context-menu="onBackgroundContextMenu"
        @visible-changed="onVisibleChanged">
        <template #grid="{ item }">
          <FileTile :entry="item" :selected="isSelected(item)" :icon-url="iconFor(item)" :icon-size="tileIconSize" />
        </template>
        <template #list="{ item }">
          <div class="list-row-inner" :class="{ 'is-selected': isSelected(item) }">
            <div class="list-col list-col-name">
              <img v-if="iconFor(item)" :src="iconFor(item)" class="list-icon-img" draggable="false" alt="" />
              <span v-else class="list-icon" :style="{ color: item.isDirectory ? 'var(--accent-base)' : undefined }">{{ glyphForEntry(item) }}</span>
              <span class="list-name-text">{{ item.name }}</span>
            </div>
            <template v-if="settings.viewMode === 'details'">
              <div class="list-col list-col-type">{{ typeLabel(item) }}</div>
              <div class="list-col list-col-size">{{ item.isDirectory ? '—' : formatBytes(item.size) }}</div>
            </template>
            <div class="list-col list-col-date">{{ formatDate(item.mtime) }}</div>
          </div>
        </template>
      </VirtualizedFiles>
    </div>

    <div class="explorer-statusbar">
      <span v-if="loading">加载中…</span>
      <span v-else>{{ filtered.length }} 个项目</span>
      <span v-if="selection.length">已选择 {{ selection.length }} 项</span>
      <span v-if="ops.statusText">{{ ops.statusText }}</span>
      <span class="status-right" v-if="freeSpaceText">{{ freeSpaceText }}</span>
    </div>

    <ContextMenu
      :visible="contextMenu.visible"
      :anchor="contextMenu.anchor"
      :items="contextMenuItems"
      @close="closeContextMenu" />

    <NamePromptDialog
      v-model:IsOpen="ops.nameDialog.open"
      :title="ops.nameDialog.title"
      :message="ops.nameDialog.message"
      :value="ops.nameDialog.value"
      @submit="onNameSubmit" />

    <DeleteConfirmDialog
      v-model:IsOpen="ops.deleteDialog.open"
      :items="ops.deleteDialog.items"
      @confirm="confirmDelete" />

    <PropertiesDialog
      v-model:IsOpen="ops.propsDialog.open"
      :entry="ops.propsDialog.entry" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import WinProgressRing from '../../winui/components/WinProgressRing.vue'
import WinButton from '../../winui/components/WinButton.vue'
import FileTile from '../components/FileTile.vue'
import VirtualizedFiles from '../components/VirtualizedFiles.vue'
import ContextMenu, { type ContextMenuItem } from '../components/ContextMenu.vue'
import NamePromptDialog from '../components/NamePromptDialog.vue'
import DeleteConfirmDialog from '../components/DeleteConfirmDialog.vue'
import PropertiesDialog from '../components/PropertiesDialog.vue'
import { settings, isGridMode, zoomIn, zoomOut, GRID_TILE, type ViewMode } from '../settings'
import { explorerState, navigation, selection, requestAddressFocus } from '../state'
import {
  ops,
  onNameSubmit,
  confirmDelete,
  requestRefresh,
  copySelected,
  cutSelected,
  paste,
  canPaste,
  renameSelected,
  deleteSelected,
  showProperties,
  newFolder,
  newTextFile,
  openEntry,
  flashStatus
} from '../ops'
import { glyphForEntry, typeLabel } from '../icons'
import { formatBytes, formatDate } from '../format'
import type { DirEntry } from '../../shared/ipc'

const path = computed(() => navigation.currentTab.value?.path ?? '')

const tile = computed(() => GRID_TILE[settings.viewMode as string] ?? GRID_TILE.medium)
const tileWidth = computed(() => tile.value.width)
const tileHeight = computed(() => tile.value.height)
const tileIconSize = computed(() => tile.value.icon)

const entries = ref<DirEntry[]>([])
const loading = ref(true)
const error = ref('')
const freeSpaceText = ref('')
const focusedIndex = ref(-1)
const viewRef = ref<HTMLElement | null>(null)
const vfilesRef = ref<InstanceType<typeof VirtualizedFiles> | null>(null)

const isHidden = (entry: DirEntry) => settings.showHidden || !entry.name.startsWith('.')

const sorted = computed(() => {
  const list = entries.value.filter(isHidden)
  const dirsFirst = (a: DirEntry, b: DirEntry) => Number(b.isDirectory) - Number(a.isDirectory)
  const field = settings.sortBy
  const direction = settings.sortDesc ? -1 : 1
  const compare = (a: DirEntry, b: DirEntry): number => {
    if (field === 'size') return (a.size - b.size) * direction
    if (field === 'date') return (a.mtime - b.mtime) * direction
    if (field === 'type') {
      const ta = a.isDirectory ? '0' : (a.extension || '\uffff')
      const tb = b.isDirectory ? '0' : (b.extension || '\uffff')
      return ta.localeCompare(tb, 'zh-CN') * direction
    }
    return a.name.localeCompare(b.name, 'zh-CN', { numeric: true }) * direction
  }
  return [...list].sort((a, b) => dirsFirst(a, b) || compare(a, b))
})

const filtered = computed(() => {
  const query = explorerState.search.trim().toLowerCase()
  if (!query) return sorted.value
  return sorted.value.filter((entry) => entry.name.toLowerCase().includes(query))
})

// ---------------------------------------------------------------------------
// Icons (fetched only for visible items, debounced)
// ---------------------------------------------------------------------------

const iconMap = ref<Record<string, string | null>>({})
const pendingIcons = new Set<string>()
let iconTimer: ReturnType<typeof setTimeout> | null = null

function iconFor(entry: DirEntry): string | undefined {
  return iconMap.value[entry.path] ?? undefined
}

function onVisibleChanged(visible: DirEntry[]): void {
  if (iconTimer) clearTimeout(iconTimer)
  iconTimer = setTimeout(() => void fetchIcons(visible), 120)
}

async function fetchIcons(visible: DirEntry[]): Promise<void> {
  const missing = visible.filter((entry) => !(entry.path in iconMap.value) && !pendingIcons.has(entry.path))
  if (!missing.length) return
  const requests = missing.map((entry) => ({ path: entry.path, isDirectory: entry.isDirectory }))
  for (const entry of missing) pendingIcons.add(entry.path)
  const responses = await window.explorer.fs.icons(requests).catch(() => [])
  for (const response of responses) {
    iconMap.value[response.path] = response.dataUrl
    pendingIcons.delete(response.path)
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function load(): Promise<void> {
  const dir = path.value
  if (!dir) return
  loading.value = true
  error.value = ''
  const previous = new Set(selection.value.map((entry) => entry.path))
  try {
    const list = await window.explorer.fs.list(dir)
    entries.value = list
    selection.value = list.filter((entry) => previous.has(entry.path))
    freeSpaceText.value = await resolveFreeSpace(dir)
    focusedIndex.value = -1
    iconMap.value = {}
  } catch (cause) {
    entries.value = []
    selection.value = []
    freeSpaceText.value = ''
    error.value = `无法访问 “${dir}”：${(cause as Error).message}`
  } finally {
    loading.value = false
  }
}

async function resolveFreeSpace(dir: string): Promise<string> {
  const mounts = await window.explorer.fs.mounts().catch(() => [])
  let best: { free: number | null; total: number | null; path: string } | null = null
  for (const mount of mounts) {
    if (dir === mount.path || dir.startsWith(mount.path === '/' ? '/' : mount.path + '/')) {
      if (!best || mount.path.length > best.path.length) best = mount
    }
  }
  if (!best || best.free === null) return ''
  return `${formatBytes(best.free)} 可用`
}

watch(path, () => {
  selection.value = []
  void load()
}, { immediate: true })

watch(() => ops.refreshTick, () => {
  void load()
})

watch(() => settings.viewMode, () => {
  focusedIndex.value = -1
})

// ---------------------------------------------------------------------------
// Selection & interaction
// ---------------------------------------------------------------------------

const isSelected = (entry: DirEntry) => selection.value.includes(entry)

function selectSingle(entry: DirEntry): void {
  selection.value = [entry]
}

function onItemClick(event: MouseEvent, entry: DirEntry): void {
  if (event.ctrlKey || event.metaKey) {
    const index = selection.value.indexOf(entry)
    if (index >= 0) selection.value.splice(index, 1)
    else selection.value.push(entry)
  } else if (event.shiftKey) {
    const anchor = selection.value[0]
    const anchorIndex = anchor ? filtered.value.indexOf(anchor) : -1
    const currentIndex = filtered.value.indexOf(entry)
    if (anchorIndex >= 0) {
      const [start, end] = anchorIndex <= currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex]
      selection.value = filtered.value.slice(start, end + 1)
    } else {
      selectSingle(entry)
    }
  } else {
    selectSingle(entry)
  }
}

function onItemContextMenu(event: MouseEvent, entry: DirEntry): void {
  if (!selection.value.includes(entry)) selectSingle(entry)
  openContextMenu(event, entry)
}

function onBackgroundContextMenu(event: MouseEvent): void {
  openContextMenu(event, null)
}

const contextMenu = reactive<{
  visible: boolean
  anchor: { left: number; top: number; width: number; height: number } | null
  target: DirEntry | null
}>({
  visible: false,
  anchor: null,
  target: null
})

function openContextMenu(event: MouseEvent, entry: DirEntry | null): void {
  if (entry && !selection.value.includes(entry)) selectSingle(entry)
  contextMenu.target = entry
  contextMenu.anchor = { left: event.clientX, top: event.clientY, width: 0, height: 0 }
  contextMenu.visible = true
}

function closeContextMenu(): void {
  contextMenu.visible = false
  contextMenu.target = null
}

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const entry = contextMenu.target
  if (!entry) {
    return [
      { label: '新建文件夹', icon: '\uE8B7', action: newFolder },
      { label: '新建文本文档', icon: '\uE8A5', action: newTextFile },
      { label: '---' },
      { label: '粘贴', icon: '\uE77F', disabled: !canPaste.value, action: () => void paste() },
      { label: '全选', icon: '\uE8B3', action: selectAll },
      { label: '---' },
      { label: '刷新', icon: '\uE72C', action: requestRefresh },
      { label: '属性', icon: '\uE946', action: () => showProperties(null) }
    ]
  }

  const selectedEntries = selection.value.length ? selection.value : [entry]
  const isDir = entry.isDirectory
  return [
    { label: '打开', icon: '\uE8E5', action: () => openEntry(entry) },
    ...(isDir
      ? [{ label: '在终端中打开', icon: '\uE756', action: () => { void window.explorer.fs.openTerminal(entry.path) } }]
      : []),
    ...(selectedEntries.length > 1
      ? [{ label: `打开 ${selectedEntries.length} 个项目`, icon: '\uE8E5', action: () => { selectedEntries.forEach((e) => { if (!e.isDirectory) void window.explorer.fs.open(e.path) }) } }]
      : []),
    { label: '复制路径', icon: '\uEAC7', action: () => copyPaths(selectedEntries) },
    { label: '---' },
    { label: '剪切', icon: '\uE8C6', action: cutSelected },
    { label: '复制', icon: '\uE8C8', action: copySelected },
    { label: '---' },
    { label: '重命名', icon: '\uE8AC', action: renameSelected },
    { label: '删除', icon: '\uE74D', action: deleteSelected },
    { label: '---' },
    { label: '属性', icon: '\uE946', action: () => showProperties(entry) }
  ]
})

function copyPaths(items: DirEntry[]): void {
  void navigator.clipboard.writeText(items.map((item) => item.path).join('\n'))
  flashStatus('已复制路径')
}

function selectAll(): void {
  selection.value = [...filtered.value]
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (target?.closest('.win-content-dialog')) return
  if (contextMenu.visible) return

  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault()
    requestAddressFocus()
    return
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    selectAll()
    return
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'c') {
    copySelected()
    return
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'x') {
    cutSelected()
    return
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'v') {
    void paste()
    return
  }
  if (event.ctrlKey && (event.key === '=' || event.key === '+' || event.key === '-')) {
    event.preventDefault()
    if (event.key === '-') zoomOut()
    else zoomIn()
    return
  }

  if (event.key === 'F2') {
    event.preventDefault()
    renameSelected()
    return
  }
  if (event.key === 'F5') {
    event.preventDefault()
    requestRefresh()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    deleteSelected()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const entry = selection.value[0]
    if (entry) openEntry(entry)
    return
  }

  if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
    moveFocus(event.key)
    event.preventDefault()
  }
}

function moveFocus(key: string): void {
  if (!filtered.value.length) return
  const list = filtered.value
  const columns = isGridMode(settings.viewMode)
    ? Math.max(1, Math.floor((viewRef.value?.clientWidth ?? 600) / (tileWidth.value + 8)))
    : 1
  let index = focusedIndex.value >= 0 ? focusedIndex.value : (selection.value[0] ? list.indexOf(selection.value[0]) : 0)
  if (index < 0) index = 0
  switch (key) {
    case 'ArrowRight': index += 1; break
    case 'ArrowLeft': index -= 1; break
    case 'ArrowDown': index += columns; break
    case 'ArrowUp': index -= columns; break
    case 'Home': index = 0; break
    case 'End': index = list.length - 1; break
  }
  index = Math.max(0, Math.min(list.length - 1, index))
  focusedIndex.value = index
  selectSingle(list[index])
  vfilesRef.value?.scrollToIndex(index)
}

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault()
  if (event.deltaY < 0) zoomIn()
  else zoomOut()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('wheel', onWheel)
  if (iconTimer) clearTimeout(iconTimer)
})
</script>

<style scoped>
.list-row-inner {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 12px;
  box-sizing: border-box;
  border-radius: 4px;
}

.list-row-inner:hover {
  background: var(--subtle-secondary);
}

.list-row-inner.is-selected {
  background: var(--accent-base);
}

.list-row-inner.is-selected .list-name-text,
.list-row-inner.is-selected .list-col-type,
.list-row-inner.is-selected .list-col-size,
.list-row-inner.is-selected .list-col-date {
  color: #000;
}

.list-col {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
  box-sizing: border-box;
}

.list-col-name {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 42%;
  min-width: 0;
  font-weight: 500;
}

.list-col-type {
  width: 22%;
  color: var(--text-secondary);
}

.list-col-size {
  width: 14%;
  color: var(--text-secondary);
}

.list-col-date {
  flex: 1;
  color: var(--text-secondary);
}

.list-icon {
  font-family: 'WinUIOnWebIcons';
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.list-icon-img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
}

.list-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
