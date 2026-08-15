<template>
  <WinContentDialog
    :IsOpen="isOpen"
    Title="删除"
    :PrimaryButtonText="`删除 ${count} 个项目`"
    CloseButtonText="取消"
    DefaultButton="Close"
    IsLightDismissEnabled
    @PrimaryButtonClick="confirm"
    @Closed="onClosed">
    <div class="delete-dialog-body">
      <div class="delete-dialog-icon">&#xE74D;</div>
      <div class="delete-dialog-text">
        <div>确实要删除这些项目吗？</div>
        <div class="delete-dialog-names">
          <div v-for="name in names" :key="name" class="delete-dialog-name">{{ name }}</div>
        </div>
        <div class="delete-dialog-hint">项目将被移动到回收站。</div>
      </div>
    </div>
  </WinContentDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WinContentDialog from '../../winui/components/WinContentDialog.vue'

const props = defineProps<{
  IsOpen?: boolean
  items: Array<{ name: string; path: string }>
}>()

const emit = defineEmits<{
  (e: 'update:IsOpen', value: boolean): void
  (e: 'confirm'): void
}>()

const isOpen = computed(() => Boolean(props.IsOpen))
const count = computed(() => props.items.length)
const names = computed(() => props.items.slice(0, 5).map((item) => item.name))

function confirm(): void {
  emit('confirm')
  emit('update:IsOpen', false)
}

function onClosed(): void {
  emit('update:IsOpen', false)
}
</script>

<style scoped>
.delete-dialog-body {
  display: flex;
  gap: 16px;
  padding: 4px 0 12px;
}

.delete-dialog-icon {
  font-family: 'WinUIOnWebIcons';
  font-size: 40px;
  line-height: 1;
  color: var(--SystemFillColorCriticalBrush, #C42B1C);
}

.delete-dialog-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-primary);
  font-size: 13px;
}

.delete-dialog-names {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 140px;
  overflow-y: auto;
}

.delete-dialog-name {
  color: var(--text-secondary);
  font-size: 12px;
}

.delete-dialog-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
