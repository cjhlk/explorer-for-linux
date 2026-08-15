<template>
  <div class="explorer-root">
    <header class="explorer-header">
      <TabStrip />
      <WindowControls />
    </header>

    <div class="explorer-navbar">
      <div class="navbar-buttons">
        <button
          type="button"
          class="navbar-btn"
          :disabled="!navigation.canGoBack.value"
          aria-label="后退"
          @click="goBack()">
          <span class="icon">&#xE72B;</span>
        </button>
        <button
          type="button"
          class="navbar-btn"
          :disabled="!navigation.canGoForward.value"
          aria-label="前进"
          @click="goForward()">
          <span class="icon">&#xE72A;</span>
        </button>
        <button
          type="button"
          class="navbar-btn"
          :disabled="!canGoUp"
          aria-label="向上"
          @click="goUp">
          <span class="icon">&#xE74A;</span>
        </button>
      </div>

      <BreadcrumbAddress
        class="navbar-address"
        :path="displayPath"
        :mode="breadcrumbMode"
        @navigate="navigateToPath"
        @edit="breadcrumbMode = 'edit'" />

      <WinAutoSuggestBox
        v-model:Text="explorerState.search"
        :PlaceholderText="searchPlaceholder"
        QueryIcon="Find"
        :IsEnabled="!isHome"
        class="navbar-search" />
    </div>

    <ExplorerCommandBar />

    <div class="explorer-body">
      <WinNavigationView
        PaneDisplayMode="Left"
        :SelectedItem="selectedNavItem"
        :MenuItems="navItems"
        :FooterMenuItems="footerItems"
        :IsPaneToggleButtonVisible="false"
        :IsBackButtonVisible="'Collapsed'"
        :IsSettingsVisible="false"
        v-model:IsPaneOpen="isPaneOpen"
        OpenPaneLength="280"
        @ItemInvoked="onNavItemInvoked">
        <router-view />
      </WinNavigationView>
    </div>

    <SettingsDialog v-model:IsOpen="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WinNavigationView from './winui/components/WinNavigationView.vue'
import WinAutoSuggestBox from './winui/components/WinAutoSuggestBox.vue'
import WindowControls from './explorer/components/WindowControls.vue'
import BreadcrumbAddress from './explorer/components/BreadcrumbAddress.vue'
import TabStrip from './explorer/components/TabStrip.vue'
import ExplorerCommandBar from './explorer/components/ExplorerCommandBar.vue'
import SettingsDialog from './explorer/components/SettingsDialog.vue'
import { navigation, explorerState, setActiveTabPath, goUp, canGoUp as canGoUpNow, navigateTo, goBack, goForward } from './explorer/state'
import { NAV_GLYPHS } from './explorer/icons'
import { routeToPath } from './router'
import type { MountPoint } from './shared/ipc'

const route = useRoute()
const router = useRouter()

const isPaneOpen = ref(true)
const settingsOpen = ref(false)
const breadcrumbMode = ref<'breadcrumb' | 'edit'>('breadcrumb')
const homePath = ref('/')
const mounts = ref<MountPoint[]>([])

const canGoUp = computed(() => canGoUpNow())

watch(
  () => explorerState.addressRequestTick,
  () => {
    if (!isHome.value) breadcrumbMode.value = 'edit'
  }
)

const isHome = computed(() => route.name === 'home')
const currentPath = computed(() => navigation.currentTab.value?.path ?? '')
const displayPath = computed(() => (isHome.value ? '' : currentPath.value))

const searchPlaceholder = computed(() => {
  if (isHome.value) return '搜索'
  const name = currentPath.value.split('/').filter(Boolean).pop() || '根目录'
  return `在 ${name} 中搜索`
})

function navigateToPath(path: string): void {
  breadcrumbMode.value = 'breadcrumb'
  if (path === '' || path === 'home') {
    navigateTo('')
  } else {
    navigateTo(path.startsWith('/') ? path : `/${path}`)
  }
}

type NavItem = {
  Content?: string
  Icon?: string
  Tag?: string
  Type?: string
  key?: string
}

const QUICK_ITEMS: Array<{ label: string; glyph: string; dir: string }> = [
  { label: '桌面', glyph: NAV_GLYPHS.desktop, dir: 'Desktop' },
  { label: '文档', glyph: NAV_GLYPHS.documents, dir: 'Documents' },
  { label: '下载', glyph: NAV_GLYPHS.downloads, dir: 'Downloads' },
  { label: '音乐', glyph: NAV_GLYPHS.music, dir: 'Music' },
  { label: '图片', glyph: NAV_GLYPHS.pictures, dir: 'Pictures' },
  { label: '视频', glyph: NAV_GLYPHS.videos, dir: 'Videos' }
]

const quickAccessItems = ref<NavItem[]>([])

async function buildQuickAccess(): Promise<void> {
  const items: NavItem[] = []
  for (const entry of QUICK_ITEMS) {
    const target = `${homePath.value}/${entry.dir}`
    const stat = await window.explorer.fs.stat(target)
    if (stat) items.push({ Content: entry.label, Icon: entry.glyph, Tag: target, key: entry.dir })
  }
  quickAccessItems.value = items
}

const driveItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [{ Content: '根目录', Icon: NAV_GLYPHS.root, Tag: '/', key: 'root' }]
  for (const mount of mounts.value) {
    if (mount.path === '/') continue
    const label = mount.path === homePath.value ? '主目录' : mount.path.split('/').filter(Boolean).pop() || mount.path
    items.push({ Content: label, Icon: NAV_GLYPHS.drive, Tag: mount.path, key: `mount-${mount.path}` })
  }
  return items
})

const navItems = computed<NavItem[]>(() => [
  { Content: '主页', Icon: NAV_GLYPHS.home, Tag: 'home', key: 'home' },
  { Type: 'Header', Content: '快速访问', key: 'header-quick' },
  ...quickAccessItems.value,
  { Type: 'Header', Content: '此电脑', key: 'header-pc' },
  ...driveItems.value
])

const footerItems = computed<NavItem[]>(() => [
  { Content: '设置', Icon: '\uE713', Tag: 'settings', key: 'settings' }
])

const selectedNavItem = computed<NavItem | null>(() => {
  const activeTag = isHome.value ? 'home' : currentPath.value
  return [...navItems.value].find((item) => item.Tag === activeTag) ?? null
})

function onNavItemInvoked(payload: { InvokedItemContainer?: NavItem }): void {
  const tag = payload.InvokedItemContainer?.Tag
  if (tag === 'settings') {
    settingsOpen.value = true
    return
  }
  if (tag) navigateToPath(tag)
}

const windowTitle = computed(() => {
  if (isHome.value) return '主页'
  return currentPath.value.split('/').filter(Boolean).pop() || '根目录'
})

onMounted(async () => {
  const info = await window.explorer.app.info()
  homePath.value = info.home
  await buildQuickAccess()
  mounts.value = await window.explorer.fs.mounts()
})

watch(
  () => route.fullPath,
  () => {
    if (route.name === 'explorer') {
      setActiveTabPath(routeToPath(route.params.path as string | string[]))
      breadcrumbMode.value = 'breadcrumb'
    } else if (route.name === 'home') {
      setActiveTabPath('')
    }
    document.title = windowTitle.value
  },
  { immediate: true }
)
</script>

<style scoped>
.explorer-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.explorer-header {
  flex: 0 0 auto;
  height: 48px;
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
  app-region: drag;
}

.explorer-header :is(button, input, a, select, [role='button'], [tabindex]:not([tabindex='-1'])) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.explorer-navbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--stroke-divider);
}

.navbar-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.navbar-btn {
  width: 34px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  font-family: 'WinUIOnWebIcons';
  font-size: 13px;
  line-height: 1;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
}

.navbar-btn:hover:not(:disabled) {
  background: var(--subtle-secondary);
}

.navbar-btn:active:not(:disabled) {
  background: var(--subtle-tertiary);
}

.navbar-btn:disabled {
  color: var(--text-disabled);
  cursor: default;
}

.navbar-address {
  flex: 1 1 auto;
  min-width: 0;
}

.navbar-search {
  width: 300px;
  flex-shrink: 0;
}

.explorer-body {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
