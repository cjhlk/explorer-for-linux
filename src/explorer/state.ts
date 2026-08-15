import { computed, reactive, ref, type ComputedRef } from 'vue'
import router, { encodePath } from '../router'
import type { DirEntry } from '../shared/ipc'

export interface ExplorerTab {
  id: number
  path: string
  back: string[]
  forward: string[]
}

let nextTabId = 2

const tabs = ref<ExplorerTab[]>([{ id: 1, path: '', back: [], forward: [] }])
const activeTabId = ref(1)

export const explorerState = reactive({
  search: '',
  addressRequestTick: 0
})

export function requestAddressFocus(): void {
  explorerState.addressRequestTick += 1
}

export const navigation: {
  tabs: typeof tabs
  activeTabId: typeof activeTabId
  currentTab: ComputedRef<ExplorerTab | null>
  canGoBack: ComputedRef<boolean>
  canGoForward: ComputedRef<boolean>
} = {
  tabs,
  activeTabId,
  currentTab: computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0] ?? null),
  canGoBack: computed(() => Boolean(navigation.currentTab.value?.back.length)),
  canGoForward: computed(() => Boolean(navigation.currentTab.value?.forward.length))
}

function routeForPath(path: string): string {
  return path ? `/explorer/${encodePath(path)}` : '/'
}

export function navigateTo(path: string): void {
  const tab = navigation.currentTab.value
  const from = router.currentRoute.value.fullPath
  const to = routeForPath(path)
  if (from !== to) {
    if (tab) {
      tab.back.push(from)
      tab.forward = []
    }
    void router.push(to)
  }
  explorerState.search = ''
}

export function goBack(): void {
  const tab = navigation.currentTab.value
  if (!tab || !tab.back.length) return
  const target = tab.back.pop() as string
  tab.forward.push(router.currentRoute.value.fullPath)
  void router.replace(target)
}

export function goForward(): void {
  const tab = navigation.currentTab.value
  if (!tab || !tab.forward.length) return
  const target = tab.forward.pop() as string
  tab.back.push(router.currentRoute.value.fullPath)
  void router.replace(target)
}

export function goUp(): void {
  const tab = navigation.currentTab.value
  if (!tab?.path) return
  const parts = tab.path.split('/').filter(Boolean)
  parts.pop()
  navigateTo(parts.length ? `/${parts.join('/')}` : '')
}

export function canGoUp(): boolean {
  const tab = navigation.currentTab.value
  if (!tab?.path) return false
  const parts = tab.path.split('/').filter(Boolean)
  parts.pop()
  return parts.length > 0 || tab.path !== '/'
}

export function newTab(): void {
  const tab: ExplorerTab = { id: nextTabId, path: '', back: [], forward: [] }
  nextTabId += 1
  tabs.value.push(tab)
  activeTabId.value = tab.id
  void router.push('/')
}

export function closeTab(id: number): void {
  const index = tabs.value.findIndex((tab) => tab.id === id)
  if (index < 0) return
  tabs.value.splice(index, 1)
  if (!tabs.value.length) {
    tabs.value.push({ id: nextTabId, path: '', back: [], forward: [] })
    nextTabId += 1
  }
  if (activeTabId.value === id) {
    const next = tabs.value[Math.min(index, tabs.value.length - 1)]
    activeTabId.value = next.id
    void router.push(routeForPath(next.path))
  }
}

export function activateTab(id: number): void {
  const tab = tabs.value.find((tab) => tab.id === id)
  if (!tab || activeTabId.value === id) return
  activeTabId.value = id
  void router.push(routeForPath(tab.path))
}

export function setActiveTabPath(path: string): void {
  const tab = navigation.currentTab.value
  if (tab) tab.path = path
}

// ---------------------------------------------------------------------------
// Selection & clipboard (shared with the global command bar)
// ---------------------------------------------------------------------------

export const selection = ref<DirEntry[]>([])

export const clipboardState = reactive<{ action: 'copy' | 'cut'; items: string[] }>({ action: 'copy', items: [] })

export function clearSelection(): void {
  selection.value = []
}
