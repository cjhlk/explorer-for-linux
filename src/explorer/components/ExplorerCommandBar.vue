<template>
  <div class="explorer-toolbar">
    <div class="explorer-toolbar-group">
      <template v-if="selection.length">
        <WinAppBarButton Icon="Cut" Label="剪切" LabelPosition="Collapsed" @Click="cutSelected" />
        <WinAppBarButton Icon="Copy" Label="复制" LabelPosition="Collapsed" @Click="copySelected" />
        <WinAppBarButton Icon="Paste" Label="粘贴" LabelPosition="Collapsed" :IsEnabled="canPaste" @Click="paste" />
        <WinAppBarButton Icon="Edit" Label="重命名" LabelPosition="Collapsed" @Click="renameSelected" />
        <WinAppBarButton Icon="Delete" Label="删除" LabelPosition="Collapsed" @Click="deleteSelected" />
        <WinAppBarButton Icon="Setting" Label="属性" LabelPosition="Collapsed" @Click="showProperties(selection[0])" />
      </template>
      <template v-else>
        <WinSplitButton
          Content="新建"
          :Flyout="newMenuItems"
          :IsEnabled="hasCurrentDir"
          @Click="newFolder"
          @Select="onMenuSelect" />
        <WinAppBarButton
          Icon="Paste"
          Label="粘贴"
          LabelPosition="Collapsed"
          :IsEnabled="canPaste && hasCurrentDir"
          @Click="paste" />
        <WinAppBarButton Icon="Refresh" Label="刷新" LabelPosition="Collapsed" @Click="requestRefresh" />
      </template>
    </div>

    <div class="explorer-toolbar-spacer" />

    <div class="explorer-toolbar-group">
      <WinSplitButton Content="查看" :Flyout="viewMenuItems" @Select="onMenuSelect" />
      <WinAppBarButton Icon="Sort" Label="排序" LabelPosition="Collapsed" @Click="toggleSortDirection" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WinAppBarButton from '../../winui/components/WinAppBarButton.vue'
import WinSplitButton from '../../winui/components/WinSplitButton.vue'
import { selection, navigation, explorerState } from '../state'
import {
  newFolder,
  newTextFile,
  renameSelected,
  deleteSelected,
  showProperties,
  copySelected,
  cutSelected,
  paste,
  canPaste,
  requestRefresh
} from '../ops'
import { settings } from '../settings'

const hasCurrentDir = computed(() => Boolean(navigation.currentTab.value?.path))

const newMenuItems = computed(() => ({
  Items: [
    { Text: '文件夹', Icon: '\uE8B7', Click: newFolder },
    { Text: '文本文档', Icon: '\uE8A5', Click: newTextFile }
  ]
}))

const viewMenuItems = computed(() => ({
  Items: [
    { Text: '超大图标', Icon: '\uE8A9', IsChecked: settings.viewMode === 'extraLarge', Click: () => { settings.viewMode = 'extraLarge' } },
    { Text: '大图标', Icon: '\uE8A9', IsChecked: settings.viewMode === 'large', Click: () => { settings.viewMode = 'large' } },
    { Text: '中等图标', Icon: '\uE8A9', IsChecked: settings.viewMode === 'medium', Click: () => { settings.viewMode = 'medium' } },
    { Text: '小图标', Icon: '\uE8A9', IsChecked: settings.viewMode === 'small', Click: () => { settings.viewMode = 'small' } },
    { Text: '列表', Icon: '\uE8FD', IsChecked: settings.viewMode === 'list', Click: () => { settings.viewMode = 'list' } },
    { Text: '详细信息', Icon: '\uE8A5', IsChecked: settings.viewMode === 'details', Click: () => { settings.viewMode = 'details' } },
    { Kind: 'MenuFlyoutSeparator' },
    { Text: '显示隐藏文件', Icon: '\uE81E', Kind: 'ToggleMenuFlyoutItem', IsChecked: settings.showHidden, Click: () => { settings.showHidden = !settings.showHidden } }
  ]
}))

function onMenuSelect(): void {
  /* handled by item Click */
}

function toggleSortDirection(): void {
  settings.sortDesc = !settings.sortDesc
}
</script>

<style scoped>
.explorer-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--stroke-divider);
  flex: 0 0 auto;
  min-height: 44px;
}

.explorer-toolbar-spacer {
  flex: 1 1 auto;
}

.explorer-toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}
</style>
