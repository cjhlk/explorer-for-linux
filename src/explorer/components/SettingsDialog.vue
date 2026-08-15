<template>
  <WinContentDialog
    :IsOpen="isOpen"
    Title="设置"
    CloseButtonText="关闭"
    DefaultButton="Close"
    @Closed="onClosed">
    <div class="settings-dialog-body">
      <div class="settings-section">
        <div class="settings-section-label">外观</div>
        <WinComboBox
          v-model:SelectedItem="themeChoice"
          :ItemsSource="themeOptions"
          Header="主题"
          DisplayMemberPath="label" />
        <WinToggleSwitch
          v-model:IsOn="settings.showHidden"
          Header="显示隐藏文件"
          OnContent="开"
          OffContent="关" />
      </div>

      <div class="settings-section">
        <div class="settings-section-label">默认视图</div>
        <WinComboBox
          v-model:SelectedItem="viewChoice"
          :ItemsSource="viewOptions"
          DisplayMemberPath="label" />
        <WinComboBox
          v-model:SelectedItem="sortChoice"
          :ItemsSource="sortOptions"
          Header="排序方式"
          DisplayMemberPath="label" />
      </div>
    </div>
  </WinContentDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import WinContentDialog from '../../winui/components/WinContentDialog.vue'
import WinComboBox from '../../winui/components/WinComboBox.vue'
import WinToggleSwitch from '../../winui/components/WinToggleSwitch.vue'
import { settings, type ThemePreference, type ViewMode, type SortField } from '../settings'

const props = defineProps<{
  IsOpen?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:IsOpen', value: boolean): void
}>()

const isOpen = computed(() => Boolean(props.IsOpen))

const themeOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' }
]
const viewOptions = [
  { label: '超大图标', value: 'extraLarge' },
  { label: '大图标', value: 'large' },
  { label: '中等图标', value: 'medium' },
  { label: '小图标', value: 'small' },
  { label: '列表', value: 'list' },
  { label: '详细信息', value: 'details' }
]
const sortOptions = [
  { label: '名称', value: 'name' },
  { label: '类型', value: 'type' },
  { label: '大小', value: 'size' },
  { label: '修改日期', value: 'date' }
]

const themeChoice = ref(themeOptions.find((o) => o.value === settings.theme) ?? themeOptions[2])
const viewChoice = ref(viewOptions.find((o) => o.value === settings.viewMode) ?? viewOptions[0])
const sortChoice = ref(sortOptions.find((o) => o.value === settings.sortBy) ?? sortOptions[0])

watch(themeChoice, (choice) => {
  settings.theme = choice.value as ThemePreference
})

watch(viewChoice, (choice) => {
  settings.viewMode = choice.value as ViewMode
})

watch(sortChoice, (choice) => {
  settings.sortBy = choice.value as SortField
})

watch(isOpen, (open) => {
  if (open) {
    themeChoice.value = themeOptions.find((o) => o.value === settings.theme) ?? themeOptions[2]
    viewChoice.value = viewOptions.find((o) => o.value === settings.viewMode) ?? viewOptions[0]
    sortChoice.value = sortOptions.find((o) => o.value === settings.sortBy) ?? sortOptions[0]
  }
})

function onClosed(): void {
  emit('update:IsOpen', false)
}
</script>
