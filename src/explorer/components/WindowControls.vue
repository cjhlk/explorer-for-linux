<template>
  <div class="window-controls">
    <button
      type="button"
      :aria-label="'最小化'"
      @click="windowApi.minimize()">&#xE921;</button>
    <button
      type="button"
      :aria-label="isMaximized ? '还原' : '最大化'"
      @click="windowApi.toggleMaximize()">{{ isMaximized ? '&#xE923;' : '&#xE922;' }}</button>
    <button
      type="button"
      class="close"
      :aria-label="'关闭'"
      @click="windowApi.close()">&#xE8BB;</button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const windowApi = window.explorer.window
const isMaximized = ref(false)

let disposeMaximized: (() => void) | null = null

onMounted(async () => {
  isMaximized.value = await windowApi.isMaximized()
  disposeMaximized = windowApi.onMaximizedChange((maximized: boolean) => {
    isMaximized.value = maximized
  })
})

onBeforeUnmount(() => {
  disposeMaximized?.()
})
</script>
