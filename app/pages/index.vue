<script setup lang="ts">
// Phase 1 placeholder: proves the page, the API route and the database work together. The
// real landing page and app shell come in Phase 2 (docs/SPEC.md).
const { data: health, status } = await useFetch('/api/health')

useSeoMeta({
  title: 'Taskforge',
  description: 'Project management and time tracking for developers. In development.',
})
</script>

<template>
  <UContainer class="py-24">
    <h1 class="text-4xl font-semibold tracking-tight">
      Taskforge
    </h1>
    <p class="mt-3 text-muted">
      Projects, a Kanban board, work timers and analytics. In development.
    </p>
    <p class="mt-8 text-sm">
      Database:
      <UBadge
        v-if="status === 'success' && health?.checks.database === 'ok'"
        color="success"
        variant="subtle"
        label="connected"
      />
      <UBadge
        v-else
        color="error"
        variant="subtle"
        label="unavailable"
      />
    </p>
  </UContainer>
</template>
