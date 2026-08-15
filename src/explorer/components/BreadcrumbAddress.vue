<template>
  <div
    ref="containerRef"
    class="breadcrumb-address"
    :class="{ 'is-edit': localMode === 'edit' }"
    @click="onAreaClick"
    @dblclick="startEdit">
    <template v-if="localMode === 'breadcrumb' && path">
      <template v-for="(segment, index) in segments" :key="segment.path">
        <span v-if="index > 0" class="crumb-sep">/</span>
        <span
          :class="['crumb', { 'is-current': index === segments.length - 1 }]"
          @click="onCrumbClick($event, index)">
          {{ segment.label }}
        </span>
      </template>
    </template>

    <template v-else-if="localMode === 'edit'">
      <div class="address-edit-wrap" @focusout="onFocusOut">
        <input
          ref="inputRef"
          v-model="draft"
          class="address-input"
          spellcheck="false"
          @keydown.enter="commit"
          @keydown.esc="cancel" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  path: string
  mode: 'breadcrumb' | 'edit'
}>()

const emit = defineEmits<{
  (e: 'navigate', path: string): void
  (e: 'edit'): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const draft = ref('')
const localMode = ref<'breadcrumb' | 'edit'>('breadcrumb')

watch(
  () => props.mode,
  async (value) => {
    if (value === 'edit' && localMode.value !== 'edit') {
      localMode.value = 'edit'
      draft.value = props.path
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    } else if (value !== 'edit' && localMode.value === 'edit') {
      localMode.value = 'breadcrumb'
    }
  },
  { immediate: true }
)

watch(() => props.path, () => {
  if (localMode.value === 'edit') draft.value = props.path
})

const segments = computed<Array<{ label: string; path: string }>>(() => {
  const clean = props.path.replace(/\/+$/, '')
  if (clean === '') return []
  const parts = clean.split('/').filter(Boolean)
  return parts.map((part, index) => ({
    label: part,
    path: `/${parts.slice(0, index + 1).join('/')}`
  }))
})

function pathForIndex(index: number): string {
  return segments.value[index]?.path ?? '/'
}

function onCrumbClick(event: MouseEvent, index: number): void {
  const isCurrent = index === segments.value.length - 1
  if (isCurrent) {
    startEdit()
    return
  }
  emit('navigate', pathForIndex(index))
  event.stopPropagation()
}

function onAreaClick(event: MouseEvent): void {
  if (localMode.value === 'edit') return
  if ((event.target as HTMLElement).closest('.crumb')) return
  startEdit()
}

function startEdit(): void {
  if (props.mode === 'edit') return
  emit('edit')
}

function commit(): void {
  const value = draft.value.trim()
  if (value) {
    emit('navigate', value.startsWith('/') ? value : `/${value}`)
  } else {
    emit('navigate', props.path)
  }
}

function cancel(): void {
  emit('navigate', props.path)
}

function onFocusOut(event: FocusEvent): void {
  const related = event.relatedTarget as HTMLElement | null
  if (related && containerRef.value?.contains(related)) return
  commit()
}
</script>

<style scoped>
.breadcrumb-address {
  flex: 1 1 auto;
  min-width: 0;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  box-sizing: border-box;
  cursor: default;
  overflow: hidden;
  white-space: nowrap;
}

.breadcrumb-address:not(.is-edit):hover {
  background: var(--subtle-secondary);
}

.breadcrumb-address:not(.is-edit):active {
  background: var(--subtle-tertiary);
}

.crumb {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: default;
  flex-shrink: 0;
}

.crumb:hover:not(.is-current) {
  background: var(--subtle-tertiary);
}

.crumb.is-current {
  font-weight: 500;
}

.crumb-sep {
  color: var(--text-tertiary);
  font-size: 13px;
  flex-shrink: 0;
  user-select: none;
}

.address-edit-wrap {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
}

.address-input {
  width: 100%;
  height: 28px;
  border: 1px solid var(--ctrl-border);
  border-radius: 4px;
  background: var(--ctrl-fill-input-active, var(--ctrl-fill-default));
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  padding: 0 10px;
  outline: none;
  box-sizing: border-box;
}

.address-input:focus {
  border-color: var(--accent-base);
}
</style>
