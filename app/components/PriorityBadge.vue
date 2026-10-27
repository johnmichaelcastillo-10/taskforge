<script setup lang="ts">
const props = defineProps<{ priority: Priority }>()

const color = computed(() => ({ low: 'neutral', medium: 'warning', high: 'error' } as const)[props.priority])
const icon = computed(() => ({ low: 'i-lucide-arrow-down', medium: 'i-lucide-equal', high: 'i-lucide-arrow-up' })[props.priority])
</script>

<template>
  <UBadge
    :color="color"
    variant="subtle"
    :icon="icon"
    :label="PRIORITY_LABELS[priority]"
  />
</template>
