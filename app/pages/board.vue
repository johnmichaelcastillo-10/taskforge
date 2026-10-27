<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
</script>

<template>
  <AppPage title="Board">
    <UEmpty
      icon="i-lucide-square-kanban"
      title="The board is empty"
      description="Tasks will sit here in four columns: Backlog, To Do, In Progress and Done. They arrive after projects."
    />
  </AppPage>
</template>
