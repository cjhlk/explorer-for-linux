<template>
  <WinMenuFlyout
    :Open="visible"
    :AnchorRect="anchor"
    :Items="flyoutItems"
    Placement="BottomLeft"
    @Select="onSelect"
    @Close="onClose" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WinMenuFlyout from '../../winui/components/WinMenuFlyout.vue'

export interface ContextMenuItem {
  label: string
  icon?: string
  disabled?: boolean
  checked?: boolean
  action?: () => void
  submenu?: ContextMenuItem[]
}

export interface ContextMenuAnchor {
  left: number
  top: number
  width?: number
  height?: number
}

const props = defineProps<{
  visible: boolean
  anchor: ContextMenuAnchor | null
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function buildFlyoutItems(menuItems: ContextMenuItem[]): Record<string, unknown>[] {
  return menuItems.map((item) => {
    if (item.label === '---') {
      return { Kind: 'MenuFlyoutSeparator' }
    }
    return {
      Text: item.label,
      Icon: item.icon,
      IsEnabled: !item.disabled,
      IsChecked: item.checked,
      Click: () => item.action?.(),
      Items: item.submenu ? buildFlyoutItems(item.submenu) : undefined
    }
  })
}

const flyoutItems = computed<Record<string, unknown>[]>(() => buildFlyoutItems(props.items))

function onSelect(payload: { item: Record<string, unknown> }): void {
  ;(payload.item as Record<string, unknown> & { Click?: () => void }).Click?.()
  emit('close')
}

function onClose(): void {
  emit('close')
}
</script>
