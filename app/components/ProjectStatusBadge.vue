<script setup lang="ts">
const props = defineProps<{ status: ProjectStatus, archived?: boolean }>()

const STYLES = {
  planning: { color: 'info', icon: 'i-lucide-pencil-ruler' },
  in_progress: { color: 'primary', icon: 'i-lucide-loader' },
  completed: { color: 'success', icon: 'i-lucide-circle-check' },
} as const

const badge = computed(() => props.archived
  ? { color: 'neutral' as const, icon: 'i-lucide-archive', label: 'Archived' }
  : { ...STYLES[props.status], label: PROJECT_STATUS_LABELS[props.status] })
</script>

<template>
  <UBadge
    :color="badge.color"
    variant="subtle"
    :icon="badge.icon"
    :label="badge.label"
  />
</template>
