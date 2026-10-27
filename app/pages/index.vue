<script setup lang="ts">
useSeoMeta({
  title: 'Taskforge',
  description: 'Project management and time tracking for developers: projects, a Kanban board, work timers and analytics.',
})

const { loggedIn } = useUserSession()
const { starting, startDemo } = useStartDemo()

const features = [
  { icon: 'i-lucide-folder-kanban', title: 'Projects', description: 'Deadlines, priorities and progress worked out from the tasks inside them.' },
  { icon: 'i-lucide-square-kanban', title: 'Kanban board', description: 'Drag tasks from Backlog to Done, or move them from the keyboard.' },
  { icon: 'i-lucide-timer', title: 'Work timer', description: 'Time each task. Durations are measured on the server, not trusted from the browser.' },
  { icon: 'i-lucide-chart-column', title: 'Analytics', description: 'Completed tasks, hours tracked and estimates against actual time.' },
]
</script>

<template>
  <div>
    <UPageHero
      title="Plan the work. Track the time."
      description="Taskforge keeps your projects, tasks and working hours in one place. The demo gives you a private workspace in one click, no sign-up needed."
    >
      <template #links>
        <UButton
          v-if="loggedIn"
          to="/dashboard"
          label="Open the app"
          size="xl"
          trailing-icon="i-lucide-arrow-right"
        />
        <UButton
          v-else
          label="Try the demo"
          size="xl"
          trailing-icon="i-lucide-arrow-right"
          :loading="starting"
          @click="startDemo"
        />
      </template>
    </UPageHero>

    <UPageSection
      title="What's inside"
      description="Taskforge is in active development; these arrive in stages."
    >
      <UPageGrid class="lg:grid-cols-4">
        <UPageCard
          v-for="feature in features"
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </UPageGrid>
    </UPageSection>
  </div>
</template>
