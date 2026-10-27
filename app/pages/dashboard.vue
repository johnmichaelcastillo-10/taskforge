<script setup lang="ts">
import { Bar } from 'vue-chartjs'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { user } = useUserSession()
const route = useRoute()
const router = useRouter()

const PERIODS = [7, 30, 90] as const
const days = computed({
  get: () => (PERIODS as readonly number[]).includes(Number(route.query.days)) ? Number(route.query.days) : 7,
  set: value => router.replace({ query: { ...route.query, days: value === 7 ? undefined : value } }),
})
const periodItems = PERIODS.map(value => ({ label: `${value} days`, value: String(value) }))
const periodTab = computed({ get: () => String(days.value), set: (value: string) => (days.value = Number(value)) })

const { data, error, refresh } = await useFetch('/api/dashboard', { query: computed(() => ({ days: days.value })) })

const metrics = computed(() => data.value && [
  { label: 'Active projects', value: String(data.value.activeProjectCount), icon: 'i-lucide-folder-kanban', to: '/projects' },
  { label: `Done, last ${days.value} days`, value: String(data.value.completedCount), icon: 'i-lucide-circle-check', to: '/analytics' },
  { label: 'Overdue', value: String(data.value.overdueCount), icon: 'i-lucide-alarm-clock-off', tone: data.value.overdueCount ? 'text-error' : undefined },
  { label: `Tracked, last ${days.value} days`, value: formatDuration(data.value.trackedSeconds), icon: 'i-lucide-timer', to: '/analytics' },
])

// What needs doing: everything overdue first (up to five), then the next few items due in the
// next two weeks, tasks and project deadlines.
const UPCOMING_SHOWN = 5
const attention = computed(() => [
  ...(data.value?.overdue ?? []).map(task => ({ kind: 'task' as const, overdue: true, id: task.id, title: task.title, projectName: task.projectName, date: task.dueDate! })),
  ...(data.value?.upcoming ?? []).slice(0, UPCOMING_SHOWN).map(item => ({ ...item, overdue: false })),
])
const moreUpcoming = computed(() => Math.max(0, (data.value?.upcoming.length ?? 0) - UPCOMING_SHOWN))

const theme = useChartTheme()
const chartOptions = useAxisOptions()
const weekly = computed(() => data.value?.weeklyCompleted ?? [])
const weeklyChart = computed(() => ({
  labels: weekly.value.map(week => shortDay(week.weekStart)),
  datasets: [{ label: 'Tasks completed', data: weekly.value.map(week => week.total), backgroundColor: theme.value.series[0], borderRadius: 4, maxBarThickness: 36 }],
}))

const openTaskId = ref<number | null>(null)
const panelOpen = ref(false)
function openTask(id: number) {
  openTaskId.value = id
  panelOpen.value = true
}

const greeting = computed(() => {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: user.value?.timezone }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
})
</script>

<template>
  <AppPage title="Dashboard">
    <template #actions>
      <UTabs
        v-model="periodTab"
        :items="periodItems"
        :content="false"
        size="xs"
        aria-label="Period"
        class="hidden sm:block"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="The dashboard couldn’t be loaded."
      :actions="[{ label: 'Try again', onClick: () => refresh() }]"
    />

    <div
      v-else-if="data"
      class="space-y-6"
    >
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h2 class="text-xl font-semibold">
          {{ greeting }}, {{ user?.name }}
        </h2>
        <UTabs
          v-model="periodTab"
          :items="periodItems"
          :content="false"
          size="xs"
          aria-label="Period"
          class="sm:hidden"
        />
      </div>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <component
          :is="metric.to ? resolveComponent('NuxtLink') : 'div'"
          v-for="metric in metrics"
          :key="metric.label"
          :to="metric.to"
          class="rounded-lg border border-default p-3 transition-colors sm:p-4"
          :class="metric.to ? 'hover:bg-elevated/40 focus-visible:outline-2 focus-visible:outline-primary' : ''"
        >
          <div class="flex items-center gap-1.5 text-xs text-muted sm:gap-2 sm:text-sm">
            <UIcon
              :name="metric.icon"
              class="size-4 shrink-0"
            />
            <span class="truncate">{{ metric.label }}</span>
          </div>
          <p
            class="mt-1 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl"
            :class="metric.tone"
          >
            {{ metric.value }}
          </p>
        </component>
      </div>

      <div class="grid gap-6 xl:grid-cols-5">
        <section class="rounded-lg border border-default p-4 xl:col-span-3">
          <h2 class="mb-3 flex items-center gap-2 font-semibold">
            Needs attention
            <UBadge
              v-if="data.overdueCount"
              color="error"
              variant="subtle"
              :label="`${data.overdueCount} overdue`"
            />
          </h2>
          <ul
            v-if="attention.length"
            class="divide-y divide-default"
          >
            <li
              v-for="item in attention"
              :key="`${item.overdue}-${item.kind}-${item.id}`"
            >
              <component
                :is="item.kind === 'task' ? 'button' : resolveComponent('NuxtLink')"
                :type="item.kind === 'task' ? 'button' : undefined"
                :to="item.kind === 'project' ? `/projects/${item.id}` : undefined"
                class="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                @click="item.kind === 'task' ? openTask(item.id) : undefined"
              >
                <span class="flex min-w-0 items-start gap-2">
                  <UIcon
                    :name="item.kind === 'project' ? 'i-lucide-flag' : 'i-lucide-square-check'"
                    class="mt-0.5 size-4 shrink-0"
                    :class="item.overdue ? 'text-error' : 'text-muted'"
                  />
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{{ item.kind === 'project' ? `${item.title} deadline` : item.title }}</span>
                    <span
                      v-if="item.kind === 'task'"
                      class="block truncate text-xs text-muted"
                    >{{ item.projectName }}</span>
                  </span>
                </span>
                <DueDate
                  :date="item.date"
                  compact
                  class="shrink-0"
                />
              </component>
            </li>
          </ul>
          <p
            v-if="data.overdueCount > data.overdue.length || moreUpcoming"
            class="mt-2 text-xs text-muted"
          >
            <template v-if="data.overdueCount > data.overdue.length">
              Showing {{ data.overdue.length }} of {{ data.overdueCount }} overdue tasks.
            </template>
            <template v-if="moreUpcoming">
              And {{ moreUpcoming }} more due in the next two weeks.
            </template>
          </p>
          <p
            v-if="!attention.length"
            class="text-sm text-muted"
          >
            Nothing overdue, and nothing due in the next two weeks.
          </p>
        </section>

        <section class="rounded-lg border border-default p-4 xl:col-span-2">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-semibold">
              Project progress
            </h2>
            <ULink
              to="/projects"
              class="text-sm text-primary"
            >All projects</ULink>
          </div>
          <ul
            v-if="data.projects.length"
            class="space-y-4"
          >
            <li
              v-for="project in data.projects"
              :key="project.id"
            >
              <NuxtLink
                :to="`/projects/${project.id}`"
                class="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium hover:text-primary"
              >
                <span class="truncate">{{ project.name }}</span>
                <DueDate
                  v-if="project.deadline"
                  :date="project.deadline"
                  compact
                />
              </NuxtLink>
              <ProjectProgress :project="project" />
            </li>
          </ul>
          <UEmpty
            v-else
            icon="i-lucide-folder-kanban"
            title="No active projects"
            variant="naked"
            :actions="[{ label: 'Create a project', to: '/projects', icon: 'i-lucide-plus' }]"
          />
        </section>
      </div>

      <div class="grid gap-6 xl:grid-cols-5">
        <ChartCard
          class="xl:col-span-3"
          title="Tasks completed per week"
          description="The last eight weeks, this one included."
          height="h-56"
          :empty="weekly.every(week => week.total === 0)"
          empty-text="Nothing completed in the last eight weeks."
          :table="{ columns: ['Week of', 'Completed'], rows: weekly.map(week => [shortDay(week.weekStart), week.total]) }"
        >
          <Bar
            :data="weeklyChart"
            :options="chartOptions"
          />
        </ChartCard>

        <section class="rounded-lg border border-default p-4 xl:col-span-2">
          <h2 class="mb-3 font-semibold">
            Recent activity
          </h2>
          <ActivityFeed :entries="data.activity" />
        </section>
      </div>
    </div>

    <TaskSlideover
      v-model:open="panelOpen"
      :task-id="openTaskId"
      @changed="refresh"
    />
  </AppPage>
</template>
