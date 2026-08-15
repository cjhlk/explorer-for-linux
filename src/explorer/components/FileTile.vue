<template>
  <div
    class="file-tile"
    :data-explorer-path="entry.path"
    :class="{ 'is-selected': selected }"
    tabindex="-1">
    <img v-if="iconUrl" :src="iconUrl" class="tile-icon-img" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }" draggable="false" alt="" />
    <span v-else class="tile-icon" :style="{ ...iconColor, fontSize: `${iconSize}px` }">{{ glyph }}</span>
    <span class="tile-name">{{ entry.name }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DirEntry } from '../../shared/ipc'
import { glyphForEntry } from '../icons'

const props = withDefaults(defineProps<{
  entry: DirEntry
  selected?: boolean
  iconUrl?: string | null
  iconSize?: number
}>(), {
  selected: false,
  iconUrl: null,
  iconSize: 48
})

const glyph = computed(() => glyphForEntry(props.entry))
const iconColor = computed(() => ({
  color: props.entry.isDirectory ? 'var(--accent-base)' : undefined
}))
</script>

<style scoped>
.tile-icon-img {
  object-fit: contain;
  pointer-events: none;
}
</style>
