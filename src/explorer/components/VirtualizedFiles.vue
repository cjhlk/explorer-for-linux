<template>
  <div ref="viewportRef" class="vfiles-viewport" @scroll.passive="onScroll" @contextmenu.prevent="onBackgroundContextMenu">
    <div class="vfiles-spacer" :style="{ height: `${totalHeight}px` }">
      <template v-if="mode === 'grid'">
        <div
          v-for="{ item, index } in window"
          :key="item.path"
          class="vfiles-grid-cell"
          :data-explorer-path="item.path"
          :style="gridCellStyle(index)"
          @click="onItemClick($event, item)"
          @dblclick.stop="emit('itemDoubleClick', item)"
          @contextmenu.prevent.stop="emit('itemContextMenu', $event, item)">
          <slot name="grid" :item="item" />
        </div>
      </template>

      <template v-else>
        <div
          v-for="{ item, index } in window"
          :key="item.path"
          class="vfiles-list-row"
          :data-explorer-path="item.path"
          :style="{ top: `${index * ROW_H}px`, height: `${ROW_H}px` }"
          @click="onItemClick($event, item)"
          @dblclick.stop="emit('itemDoubleClick', item)"
          @contextmenu.prevent.stop="emit('itemContextMenu', $event, item)">
          <slot name="list" :item="item" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DirEntry } from '../../shared/ipc'

const props = withDefaults(defineProps<{
  items: DirEntry[]
  mode: 'grid' | 'list'
  tileWidth?: number
  tileHeight?: number
  gap?: number
  padding?: number
}>(), {
  tileWidth: 132,
  tileHeight: 112,
  gap: 8,
  padding: 16
})

const emit = defineEmits<{
  (e: 'itemClick', event: MouseEvent, item: DirEntry): void
  (e: 'itemDoubleClick', item: DirEntry): void
  (e: 'itemContextMenu', event: MouseEvent, item: DirEntry): void
  (e: 'backgroundContextMenu', event: MouseEvent): void
  (e: 'visibleChanged', items: DirEntry[]): void
}>()

const ROW_H = 32
const OVERSCAN = 2

const viewportRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportWidth = ref(0)
const viewportHeight = ref(0)

const columns = computed(() => {
  if (props.mode !== 'grid') return 1
  return Math.max(1, Math.floor((viewportWidth.value - props.padding * 2 + props.gap) / (props.tileWidth + props.gap)))
})

const rowH = computed(() => (props.mode === 'grid' ? props.tileHeight + props.gap : ROW_H))

const totalHeight = computed(() => {
  const count = props.items.length
  if (!count) return 0
  if (props.mode === 'grid') {
    const rows = Math.ceil(count / columns.value)
    return rows * rowH.value - props.gap + props.padding * 2
  }
  return count * ROW_H
})

const window = computed(() => {
  const count = props.items.length
  if (!count) return [] as Array<{ item: DirEntry; index: number }>
  let start: number
  let end: number
  if (props.mode === 'grid') {
    const cols = columns.value
    const startRow = Math.max(0, Math.floor((scrollTop.value - props.padding) / rowH.value) - OVERSCAN)
    const endRow = Math.ceil((scrollTop.value - props.padding + viewportHeight.value) / rowH.value) + OVERSCAN
    start = Math.max(0, startRow * cols)
    end = Math.min(count, (endRow + 1) * cols)
  } else {
    start = Math.max(0, Math.floor(scrollTop.value / ROW_H) - OVERSCAN)
    end = Math.min(count, Math.ceil((scrollTop.value + viewportHeight.value) / ROW_H) + OVERSCAN)
  }
  const result: Array<{ item: DirEntry; index: number }> = []
  for (let i = start; i < end; i++) {
    result.push({ item: props.items[i], index: i })
  }
  return result
})

function gridCellStyle(index: number): Record<string, string> {
  const row = Math.floor(index / columns.value)
  const col = index % columns.value
  return {
    position: 'absolute',
    top: `${props.padding + row * rowH.value}px`,
    left: `${props.padding + col * (props.tileWidth + props.gap)}px`,
    width: `${props.tileWidth}px`,
    height: `${props.tileHeight}px`
  }
}

function onScroll(): void {
  scrollTop.value = viewportRef.value?.scrollTop ?? 0
}

function onBackgroundContextMenu(event: MouseEvent): void {
  emit('backgroundContextMenu', event)
}

function onItemClick(event: MouseEvent, item: DirEntry): void {
  emit('itemClick', event, item)
}

function scrollToIndex(index: number): void {
  const viewport = viewportRef.value
  if (!viewport || !props.items.length) return
  const target = props.mode === 'grid'
    ? props.padding + Math.floor(index / columns.value) * rowH.value
    : index * ROW_H
  const viewportTop = viewport.scrollTop
  const viewportBottom = viewportTop + viewport.clientHeight
  if (target < viewportTop) {
    viewport.scrollTop = target
  } else if (target + (props.mode === 'grid' ? props.tileHeight : ROW_H) > viewportBottom) {
    viewport.scrollTop = target + (props.mode === 'grid' ? props.tileHeight : ROW_H) - viewport.clientHeight
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const viewport = viewportRef.value
  if (!viewport) return
  viewportWidth.value = viewport.clientWidth
  viewportHeight.value = viewport.clientHeight
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      viewportWidth.value = viewport.clientWidth
      viewportHeight.value = viewport.clientHeight
    })
    resizeObserver.observe(viewport)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(window, (current) => {
  emit('visibleChanged', current.map(({ item }) => item))
}, { immediate: true })

defineExpose({ scrollToIndex })
</script>

<style scoped>
.vfiles-viewport {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.vfiles-spacer {
  position: relative;
  width: 100%;
}

.vfiles-grid-cell {
  box-sizing: border-box;
  border-radius: 6px;
}

.vfiles-list-row {
  position: absolute;
  left: 0;
  right: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}
</style>
