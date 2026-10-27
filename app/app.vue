<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
  titleTemplate: title => (title && title !== 'Taskforge' ? `${title} · Taskforge` : 'Taskforge'),
})
// Pages with their own description replace this one.
useSeoMeta({ description: 'Taskforge: projects, a Kanban board, work timers and analytics, in one place.' })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
