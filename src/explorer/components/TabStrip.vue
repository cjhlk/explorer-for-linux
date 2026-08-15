<template>
  <div class="tab-strip">
    <div class="tab-strip-scroll">
      <div
        v-for="tab in navigation.tabs.value"
        :key="tab.id"
        class="tab-item"
        :class="{ 'is-active': tab.id === navigation.activeTabId.value }"
        role="button"
        tabindex="0"
        @click="activateTab(tab.id)"
        @auxclick="onAuxClick($event, tab.id)"
        @keydown.enter="activateTab(tab.id)"
        @contextmenu.prevent>
        <span class="tab-icon">&#xE8B7;</span>
        <span class="tab-label">{{ tabTitle(tab) }}</span>
        <button
          type="button"
          class="tab-close"
          :aria-label="`关闭 ${tabTitle(tab)}`"
          @click.stop="closeTab(tab.id)">
          <span class="icon">&#xE711;</span>
        </button>
      </div>
    </div>
    <button
      type="button"
      class="tab-new"
      :aria-label="'新建标签页'"
      @click="newTab()">
      <span class="icon">&#xE710;</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { navigation, type ExplorerTab } from '../state'
import { activateTab, closeTab, newTab } from '../state'

function tabTitle(tab: ExplorerTab): string {
  if (!tab.path) return '主页'
  const name = tab.path.split('/').filter(Boolean).pop()
  return name || '根目录'
}

function onAuxClick(event: MouseEvent, id: number): void {
  if (event.button === 1) closeTab(id)
}
</script>

<style scoped>
.tab-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 0 8px;
  box-sizing: border-box;
  min-width: 0;
}

.tab-strip-scroll {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.tab-strip-scroll::-webkit-scrollbar {
  display: none;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 4px 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--TitleBarForegroundBrush, var(--text-primary));
  font-family: inherit;
  font-size: 13px;
  cursor: default;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 220px;
}

.tab-item:hover {
  background: var(--subtle-secondary);
}

.tab-item.is-active {
  background: var(--card-bg);
  border: 1px solid var(--card-stroke);
}

.tab-icon {
  font-family: 'WinUIOnWebIcons';
  font-size: 14px;
  color: var(--accent-base);
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-family: 'WinUIOnWebIcons';
  font-size: 10px;
  line-height: 1;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
}

.tab-item:hover .tab-close,
.tab-item.is-active .tab-close {
  visibility: visible;
}

.tab-close:hover {
  background: var(--subtle-tertiary);
  color: var(--text-primary);
}

.tab-new {
  width: 34px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-family: 'WinUIOnWebIcons';
  font-size: 14px;
  line-height: 1;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tab-new:hover {
  background: var(--subtle-secondary);
  color: var(--text-primary);
}
</style>
