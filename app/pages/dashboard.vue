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
  { label: `Completed, last ${days.value} days`, value: String(data.value.completedCount), icon: 'i-lucide-circle-check', to: '/analytics' },
  { label: 'Overdue tasks', value: String(data.value.overdueCount), icon: 'i-lucide-alarm-clock-off', tone: data.value.overdueCount ? 'text-error' : undefined },
  { label: `Tracked, last ${days.value} days`, value: formatDuration(data.value.trackedSeconds), icon: 'i-lucide-timer', to: '/analytics' },
])

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

      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <component
          :is="metric.to ? resolveComponent('NuxtLink') : 'div'"
          v-for="metric in metrics"
          :key="metric.label"
          :to="metric.to"
          class="rounded-lg border border-default p-4 transition-colors"
          :class="metric.to ? 'hover:bg-elevated/40 focus-visible:outline-2 focus-visible:outline-primary' : ''"
        >
          <div class="flex items-center gap-2 text-sm text-muted">
            <UIcon
              :name="metric.icon"
              class="size-4"
            />
            {{ metric.label }}
          </div>
          <p
            class="mt-2 text-2xl font-semibold tabular-nums"
            :class="metric.tone"
          >
            {{ metric.value }}
          </p>
        </component>
      </div>

      <div class="grid gap-6 xl:grid-cols-5">
        <ChartCard
          class="xl:col-span-3"
          title="Tasks completed per week"
          description="The last eight weeks, this one included."
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
            Coming up
          </h2>
          <ul
            v-if="data.upcoming.length"
            class="space-y-2"
          >
            <li
              v-for="item in data.upcoming"
              :key="`${item.kind}-${item.id}`"
            >
              <component
                :is="item.kind === 'task' ? 'button' : resolveComponent('NuxtLink')"
                :type="item.kind === 'task' ? 'button' : undefined"
                :to="item.kind === 'project' ? `/projects/${item.id}` : undefined"
                class="flex w-full items-start justify-between gap-3 rounded-md p-2 text-left text-sm hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
                @click="item.kind === 'task' ? openTask(item.id) : undefined"
              >
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5 font-medium">
                    <UIcon
                      :name="item.kind === 'project' ? 'i-lucide-flag' : 'i-lucide-square-check'"
                      class="size-4 shrink-0 text-muted"
                    />
                    <span class="truncate">{{ item.kind === 'project' ? `${item.title} deadline` : item.title }}</span>
                  </span>
                  <span
                    v-if="item.kind === 'task'"
                    class="block truncate pl-5.5 text-xs text-muted"
                  >{{ item.projectName }}</span>
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
            v-else
            class="text-sm text-muted"
          >
            Nothing due in the next two weeks.
          </p>
        </section>
      </div>

      <section
        v-if="data.overdue.length"
        class="rounded-lg border border-error/40 p-4"
      >
        <h2 class="mb-3 flex items-center gap-2 font-semibold text-error">
          <UIcon
            name="i-lucide-alarm-clock-off"
            class="size-5"
          />
          Overdue
          <span
            v-if="data.overdueCount > data.overdue.length"
            class="text-sm font-normal text-muted"
          >(showing {{ data.overdue.length }} of {{ data.overdueCount }})</span>
        </h2>
        <ul class="divide-y divide-default">
          <li
            v-for="task in data.overdue"
            :key="task.id"
          >
            <button
              type="button"
              class="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left text-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              @click="openTask(task.id)"
            >
              <span>
                <span class="font-medium">{{ task.title }}</span>
                <span class="text-muted"> · {{ task.projectName }}</span>
              </span>
              <DueDate
                :date="task.dueDate!"
                compact
              />
            </button>
          </li>
        </ul>
      </section>

      <div class="grid gap-6 xl:grid-cols-5">
        <section class="rounded-lg border border-default p-4 xl:col-span-3">
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
