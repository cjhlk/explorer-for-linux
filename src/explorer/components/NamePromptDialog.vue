<template>
  <WinContentDialog
    :IsOpen="isOpen"
    :Title="title"
    :PrimaryButtonText="confirmText"
    CloseButtonText="取消"
    DefaultButton="Primary"
    :IsPrimaryButtonEnabled="canSubmit"
    @PrimaryButtonClick="submit"
    @Closed="onClosed">
    <div class="name-prompt-body">
      <div class="name-prompt-message">{{ message }}</div>
      <input
        ref="inputRef"
        v-model="draft"
        class="address-input name-input"
        spellcheck="false"
        @keydown.enter.prevent="submit"
        @keydown.esc.prevent="cancel" />
    </div>
  </WinContentDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import WinContentDialog from '../../winui/components/WinContentDialog.vue'

const props = defineProps<{
  IsOpen?: boolean
  title: string
  message: string
  confirmText?: string
  value?: string
}>()

const emit = defineEmits<{
  (e: 'update:IsOpen', value: boolean): void
  (e: 'submit', value: string): void
}>()

const isOpen = computed(() => Boolean(props.IsOpen))
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const canSubmit = computed(() => draft.value.trim().length > 0)

watch(isOpen, async (open) => {
  if (open) {
    draft.value = props.value ?? ''
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

function submit(): void {
  if (!canSubmit.value) return
  const value = draft.value.trim()
  emit('submit', value)
  emit('update:IsOpen', false)
}

function cancel(): void {
  emit('update:IsOpen', false)
}

function onClosed(): void {
  emit('update:IsOpen', false)
}
</script>

<style scoped>
.name-prompt-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 12px;
}

.name-prompt-message {
  color: var(--text-secondary);
  font-size: 13px;
}

.name-input {
  width: 100%;
  height: 32px;
}
</style>
