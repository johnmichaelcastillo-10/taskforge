<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
</script>

<template>
  <AppPage title="Projects">
    <UEmpty
      icon="i-lucide-folder-kanban"
      title="No projects yet"
      description="Projects, with deadlines, priorities and progress, are the next part of Taskforge being built."
    />
  </AppPage>
</template>
