<template>
  <WinContentDialog
    :IsOpen="isOpen"
    Title="属性"
    CloseButtonText="关闭"
    DefaultButton="Close">
    <div class="properties-grid">
      <div class="properties-row">
        <div class="prop-label">名称</div>
        <div class="prop-value">{{ entry?.name }}</div>
      </div>
      <div class="properties-row">
        <div class="prop-label">类型</div>
        <div class="prop-value">{{ typeText }}</div>
      </div>
      <div class="properties-row">
        <div class="prop-label">位置</div>
        <div class="prop-value">{{ entry?.path }}</div>
      </div>
      <div class="properties-row" v-if="entry && !entry.isDirectory">
        <div class="prop-label">大小</div>
        <div class="prop-value">{{ formatBytes(entry.size) }}</div>
      </div>
      <div class="properties-row" v-if="entry && entry.isDirectory">
        <div class="prop-label">内容</div>
        <div class="prop-value">{{ childCount !== null ? `${childCount} 个项目` : '…' }}</div>
      </div>
      <div class="properties-row">
        <div class="prop-label">修改时间</div>
        <div class="prop-value">{{ formatDate(entry?.mtime ?? 0) }}</div>
      </div>
    </div>
  </WinContentDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import WinContentDialog from '../../winui/components/WinContentDialog.vue'
import { typeLabel } from '../icons'
import { formatBytes, formatDate } from '../format'
import type { DirEntry } from '../../shared/ipc'

const props = defineProps<{
  IsOpen?: boolean
  entry: DirEntry | null
}>()

const emit = defineEmits<{
  (e: 'update:IsOpen', value: boolean): void
}>()

const isOpen = computed(() => Boolean(props.IsOpen))
const childCount = ref<number | null>(null)
const typeText = computed(() => (props.entry ? typeLabel(props.entry) : ''))

watch(
  () => [props.IsOpen, props.entry?.path],
  async ([open]) => {
    childCount.value = null
    if (open && props.entry?.isDirectory) {
      const entries = await window.explorer.fs.list(props.entry.path).catch(() => [])
      childCount.value = entries.length
    }
  }
)
</script>
