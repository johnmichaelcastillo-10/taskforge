<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
</script>

<template>
  <AppPage title="Analytics">
    <UEmpty
      icon="i-lucide-chart-column"
      title="No data to chart yet"
      description="Charts of completed tasks, tracked hours and estimates against actual time need tasks and timed work first."
    />
  </AppPage>
</template>
