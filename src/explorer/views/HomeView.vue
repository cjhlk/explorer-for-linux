<template>
  <div class="home-view" ref="rootRef" tabindex="-1" @keydown="onKeydown">
    <div class="home-page-header">
      <span class="icon home-greeting-glyph">&#xE80F;</span>
      <div>
        <div class="home-greeting">主页</div>
        <div class="home-sub-greeting">{{ homePath }}</div>
      </div>
    </div>

    <div v-if="loading" class="home-loading">
      <WinProgressRing IsActive />
    </div>

    <template v-else>
      <div class="home-section-title">快速访问</div>
      <div class="home-tiles">
        <div
          v-for="folder in quickAccess"
          :key="folder.path"
          class="home-tile"
          role="button"
          tabindex="0"
          @click="openFolder(folder.path)"
          @keydown.enter="openFolder(folder.path)">
          <img v-if="folder.icon" :src="folder.icon" class="home-tile-img" draggable="false" alt="" />
          <span v-else class="home-tile-icon" :style="{ color: folder.color }">{{ folder.glyph }}</span>
          <div>
            <div class="home-tile-title">{{ folder.label }}</div>
            <div class="home-tile-subtitle">{{ folder.count }} 个项目</div>
          </div>
        </div>
      </div>

      <div class="home-section-title">此电脑</div>
      <div class="home-drive-grid">
        <div
          v-for="drive in drives"
          :key="drive.path"
          class="home-drive-card"
          role="button"
          tabindex="0"
          @click="openFolder(drive.path)"
          @keydown.enter="openFolder(drive.path)">
          <img v-if="drive.icon" :src="drive.icon" class="home-tile-img" draggable="false" alt="" />
          <span v-else class="home-tile-icon">&#xEDA2;</span>
          <div class="home-drive-info">
            <div class="home-tile-title">{{ drive.name }}</div>
            <div class="drive-free">
              {{ drive.free !== null ? `${formatBytes(drive.free)} 可用，共 ${formatBytes(drive.total ?? 0)}` : '本地磁盘' }}
            </div>
            <WinProgressBar
              v-if="drive.usage !== null"
              :Value="drive.usage"
              class="drive-usage"
              :IsIndeterminate="false"
              Height="4" />
          </div>
        </div>
      </div>

      <div class="home-section-title">最近使用</div>
      <div v-if="recent.length" class="home-recent-list">
        <div
          v-for="file in recent"
          :key="file.path"
          class="home-recent-item"
          role="button"
          tabindex="0"
          @click="openFile(file)"
          @keydown.enter="openFile(file)">
          <img v-if="iconFor(file)" :src="iconFor(file)" class="home-recent-icon-img" draggable="false" alt="" />
          <span v-else class="home-recent-icon">{{ glyphForEntry(file) }}</span>
          <div class="home-recent-name">{{ file.name }}</div>
          <div class="home-recent-path">{{ file.path }}</div>
          <div class="home-recent-date">{{ formatDate(file.mtime) }}</div>
        </div>
      </div>
      <div v-else class="home-recent-empty">暂无最近使用的文件</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import WinProgressRing from '../../winui/components/WinProgressRing.vue'
import WinProgressBar from '../../winui/components/WinProgressBar.vue'
import { navigateTo } from '../state'
import { NAV_GLYPHS, glyphForEntry } from '../icons'
import { formatBytes, formatDate } from '../format'
import type { DirEntry, MountPoint } from '../../shared/ipc'

const homePath = ref('')
const quickAccess = ref<Array<{ label: string; glyph: string; color: string; path: string; count: number; icon: string | null }>>([])
const drives = ref<Array<{ name: string; path: string; total: number | null; free: number | null; usage: number | null; icon: string | null }>>([])
const recent = ref<DirEntry[]>([])
const loading = ref(true)
const rootRef = ref<HTMLElement | null>(null)
const iconMap = ref<Record<string, string | null>>({})

function iconFor(entry: DirEntry): string | undefined {
  return iconMap.value[entry.path] ?? undefined
}

const QUICK_COLORS: Record<string, string> = {
  Desktop: 'var(--accent-base)',
  Documents: 'var(--SystemFillColorSuccessBrush, #6CCB5F)',
  Downloads: 'var(--SystemFillColorAttentionBrush, #4CC2FF)',
  Music: 'var(--SystemFillColorCriticalBrush, #FF99A4)',
  Pictures: 'var(--SystemFillColorCautionBrush, #FCE100)',
  Videos: 'var(--SystemFillColorAttentionBrush, #4CC2FF)'
}

const QUICK_ITEMS: Array<{ label: string; glyph: string; dir: string }> = [
  { label: '桌面', glyph: NAV_GLYPHS.desktop, dir: 'Desktop' },
  { label: '文档', glyph: NAV_GLYPHS.documents, dir: 'Documents' },
  { label: '下载', glyph: NAV_GLYPHS.downloads, dir: 'Downloads' },
  { label: '音乐', glyph: NAV_GLYPHS.music, dir: 'Music' },
  { label: '图片', glyph: NAV_GLYPHS.pictures, dir: 'Pictures' },
  { label: '视频', glyph: NAV_GLYPHS.videos, dir: 'Videos' }
]

function openFolder(path: string): void {
  navigateTo(path)
}

function openFile(file: DirEntry): void {
  window.explorer.fs.open(file.path)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.target as HTMLElement).getAttribute('role') === 'button') {
    return
  }
}

onMounted(async () => {
  rootRef.value?.focus()
  const info = await window.explorer.app.info()
  homePath.value = info.home

  const stats = await Promise.all(
    QUICK_ITEMS.map(async (item) => {
      const path = `${info.home}/${item.dir}`
      const entries = await window.explorer.fs.list(path).catch(() => [])
      return {
        ...item,
        color: QUICK_COLORS[item.dir] ?? 'var(--accent-base)',
        path,
        count: entries.filter((e) => !e.name.startsWith('.')).length,
        icon: null as string | null
      }
    })
  )
  quickAccess.value = stats

  const mounts = await window.explorer.fs.mounts()
  drives.value = mounts.map((mount: MountPoint) => {
    const usage = mount.total && mount.total > 0
      ? Math.min(100, Math.max(0, (1 - (mount.free ?? 0) / mount.total) * 100))
      : null
    const name = mount.path === '/' ? '根目录' : mount.path.split('/').filter(Boolean).pop() || mount.path
    return { name, path: mount.path, total: mount.total, free: mount.free, usage, icon: null as string | null }
  })

  const homeEntries = await window.explorer.fs.list(info.home).catch(() => [])
  recent.value = homeEntries
    .filter((entry) => entry.isFile)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 10)

  loading.value = false
  await loadIcons()
})

async function loadIcons(): Promise<void> {
  const requests: Array<{ path: string; name?: string; isDirectory?: boolean }> = []
  for (const folder of quickAccess.value) {
    if (folder.path in iconMap.value) continue
    requests.push({ path: folder.path, isDirectory: true })
  }
  for (const drive of drives.value) {
    if (drive.path in iconMap.value) continue
    requests.push({ path: drive.path, name: 'drive-harddisk' })
  }
  for (const file of recent.value) {
    if (file.path in iconMap.value) continue
    requests.push({ path: file.path, isDirectory: file.isDirectory })
  }
  if (!requests.length) return
  const responses = await window.explorer.fs.icons(requests).catch(() => [])
  const byPath = new Map(responses.map((response) => [response.path, response.dataUrl]))
  for (const folder of quickAccess.value) folder.icon = byPath.get(folder.path) ?? null
  for (const drive of drives.value) drive.icon = byPath.get(drive.path) ?? null
  for (const file of recent.value) iconMap.value[file.path] = byPath.get(file.path) ?? null
}
</script>

<style scoped>
.home-page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.home-greeting-glyph {
  font-size: 56px;
  color: var(--accent-base);
}

.home-greeting {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
}

.home-sub-greeting {
  font-size: 13px;
  color: var(--text-secondary);
}

.home-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.home-drive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.home-drive-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--card-stroke);
  background: var(--card-bg);
  cursor: pointer;
  transition: background 0.15s ease;
}

.home-drive-card:hover {
  background: var(--card-bg-secondary);
}

.home-drive-info {
  flex: 1 1 auto;
  min-width: 0;
}

.home-recent-list {
  display: flex;
  flex-direction: column;
}

.home-recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.home-recent-item:hover {
  background: var(--subtle-secondary);
}

.home-recent-icon {
  font-size: 18px;
  color: var(--text-secondary);
}

.home-recent-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
}

.home-recent-name {
  font-size: 13px;
  color: var(--text-primary);
  min-width: 180px;
}

.home-recent-path {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-tertiary);
}

.home-recent-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.home-recent-empty {
  padding: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
