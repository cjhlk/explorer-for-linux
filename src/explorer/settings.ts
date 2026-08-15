import { reactive, watch } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

export const ZOOM_LEVELS = ['extraLarge', 'large', 'medium', 'small', 'list', 'details'] as const
export type ViewMode = (typeof ZOOM_LEVELS)[number]

export const GRID_TILE: Record<string, { width: number; height: number; icon: number }> = {
  extraLarge: { width: 224, height: 200, icon: 96 },
  large: { width: 176, height: 152, icon: 72 },
  medium: { width: 132, height: 116, icon: 48 },
  small: { width: 92, height: 82, icon: 32 }
}

export const isGridMode = (mode: ViewMode): boolean => mode === 'extraLarge' || mode === 'large' || mode === 'medium' || mode === 'small'

export function zoomIn(): void {
  const index = ZOOM_LEVELS.indexOf(settings.viewMode)
  settings.viewMode = ZOOM_LEVELS[Math.max(0, index - 1)]
}

export function zoomOut(): void {
  const index = ZOOM_LEVELS.indexOf(settings.viewMode)
  settings.viewMode = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, index + 1)]
}

export type SortField = 'name' | 'type' | 'size' | 'date'

interface SettingsState {
  theme: ThemePreference
  showHidden: boolean
  viewMode: ViewMode
  sortBy: SortField
  sortDesc: boolean
  iconSize: number
  locale: string
}

const STORAGE_KEY = 'explorer.settings'

function loadSettings(): SettingsState {
  const defaults: SettingsState = {
    theme: 'system',
    showHidden: false,
    viewMode: 'details',
    sortBy: 'name',
    sortDesc: false,
    iconSize: 48,
    locale: 'zh-CN'
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.viewMode && !ZOOM_LEVELS.includes(parsed.viewMode)) {
        parsed.viewMode = 'details'
      }
      return { ...defaults, ...parsed }
    }
  } catch {
    /* ignore */
  }
  return defaults
}

export const settings = reactive<SettingsState>(loadSettings())

export function applyTheme(): void {
  const html = document.documentElement
  const resolved = settings.theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.theme
  html.classList.toggle('theme-dark', resolved === 'dark')
  html.classList.toggle('theme-light', resolved === 'light')
}

watch(settings, () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  applyTheme()
}, { deep: true })

applyTheme()
