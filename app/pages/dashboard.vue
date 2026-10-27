<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { user } = useUserSession()
</script>

<template>
  <AppPage title="Dashboard">
    <div class="space-y-6">
      <h2 class="text-xl font-semibold">
        Welcome, {{ user?.name }}
      </h2>
      <UEmpty
        icon="i-lucide-layout-dashboard"
        title="Nothing to report yet"
        description="Active projects, overdue tasks, tracked time and upcoming deadlines will appear here once you have projects and tasks."
        :actions="[{ label: 'Go to projects', to: '/projects', icon: 'i-lucide-folder-kanban' }]"
      />
    </div>
  </AppPage>
</template>
