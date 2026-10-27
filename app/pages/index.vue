<script setup lang="ts">
useSeoMeta({
  title: 'Taskforge',
  description: 'Project management and time tracking for developers: projects, a Kanban board, work timers and analytics.',
})

const { loggedIn } = useUserSession()
const { starting, startDemo } = useStartDemo()

const features = [
  { icon: 'i-lucide-folder-kanban', title: 'Projects with a pulse', description: 'Deadlines, priorities and progress that update as tasks move.' },
  { icon: 'i-lucide-square-kanban', title: 'A board that keeps up', description: 'Drag tasks from Backlog to Done, or move them from the keyboard.' },
  { icon: 'i-lucide-timer', title: 'One-click timer', description: 'Time any task. Switch tasks without losing a second.' },
  { icon: 'i-lucide-chart-column', title: 'Where the time went', description: 'Hours per week, finished tasks, and estimates against reality.' },
]
</script>

<template>
  <div>
    <UContainer class="grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-20">
      <div class="space-y-6">
        <h1 class="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Plan the work. Track the time.
        </h1>
        <p class="max-w-xl text-lg text-pretty text-muted">
          Projects, a Kanban board and a work timer in one place, with the numbers to show where
          the week went.
        </p>
        <div class="flex flex-wrap items-center gap-3">
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
          <UButton
            to="/download"
            label="Desktop app"
            icon="i-lucide-monitor-down"
            size="xl"
            color="neutral"
            variant="ghost"
          />
        </div>
        <p
          v-if="!loggedIn"
          class="text-sm text-muted"
        >
          No sign-up: the demo is a private workspace with sample projects, yours for three days.
        </p>
      </div>

      <!-- The board, in the theme the visitor is using; only the visible one loads up front.
           On phones the whole screenshot would be too small to read, so a window shows part
           of it (the To do and In progress columns) at about 2.5× instead. -->
      <figure class="h-56 overflow-hidden rounded-xl border border-default shadow-xl shadow-black/5 sm:h-auto">
        <img
          src="/screens/board-light.webp"
          srcset="/screens/board-light-960.webp 960w, /screens/board-light.webp 1600w"
          sizes="(min-width: 1024px) 58vw, (min-width: 640px) 100vw, 250vw"
          width="1600"
          height="800"
          alt="The Taskforge board: tasks in Backlog, To do, In progress and Done columns, with tags, due dates, estimates and tracked time"
          fetchpriority="high"
          class="block w-[250%] max-w-none -translate-x-[33%] -translate-y-[7%] sm:w-full sm:translate-0 dark:hidden"
        >
        <img
          src="/screens/board-dark.webp"
          srcset="/screens/board-dark-960.webp 960w, /screens/board-dark.webp 1600w"
          sizes="(min-width: 1024px) 58vw, (min-width: 640px) 100vw, 250vw"
          width="1600"
          height="800"
          alt="The Taskforge board in dark mode"
          loading="lazy"
          class="hidden w-[250%] max-w-none -translate-x-[33%] -translate-y-[7%] sm:w-full sm:translate-0 dark:block"
        >
      </figure>
    </UContainer>

    <section class="border-t border-default bg-elevated/30">
      <UContainer class="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="space-y-2"
        >
          <UIcon
            :name="feature.icon"
            class="size-6 text-primary"
          />
          <h2 class="font-semibold">
            {{ feature.title }}
          </h2>
          <p class="text-sm text-muted">
            {{ feature.description }}
          </p>
        </div>
      </UContainer>
    </section>
  </div>
</template>
