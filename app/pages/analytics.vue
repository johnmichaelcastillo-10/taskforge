<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const today = useToday()

// The range lives in the URL: ?from=2026-01-01&to=2026-01-31, or a preset such as ?preset=30.
const PRESETS = [7, 30, 90] as const
const preset = computed(() => {
  if (route.query.from || route.query.to) return 'custom'
  return (PRESETS as readonly number[]).includes(Number(route.query.preset)) ? String(route.query.preset) : '30'
})
const range = computed(() => preset.value === 'custom'
  ? { from: String(route.query.from ?? today.value), to: String(route.query.to ?? today.value) }
  : { from: addDays(today.value, -(Number(preset.value) - 1)), to: today.value })

const presetItems = [...PRESETS.map(days => ({ label: `Last ${days} days`, value: String(days) })), { label: 'Custom', value: 'custom' }]
function choosePreset(value: string) {
  router.replace({ query: value === 'custom' ? { from: range.value.from, to: range.value.to } : { preset: value === '30' ? undefined : value } })
}
function setDate(which: 'from' | 'to', value: string) {
  if (value) router.replace({ query: { ...range.value, [which]: value } })
}

const { data, error, status } = await useFetch('/api/analytics', { query: range })

const theme = useChartTheme()
const countOptions = useAxisOptions()
const formatHours = (hours: number) => `${+hours.toFixed(1)}h`
const hoursOptions = useAxisOptions({ yLabel: formatHours })
const estimateOptions = useAxisOptions({ yLabel: formatHours, legend: true })
const progressOptions = useAxisOptions<'line'>({ yLabel: percent => `${percent}%`, max: 100, legend: true })
const toHours = (seconds: number) => +(seconds / 3600).toFixed(2)

const labels = computed(() => (data.value?.days ?? []).map(shortDay))

const completedChart = computed(() => ({
  labels: labels.value,
  datasets: [{ label: 'Tasks completed', data: data.value?.completedPerDay ?? [], backgroundColor: theme.value.series[0], borderRadius: 3, maxBarThickness: 28 }],
}))

const weeks = computed(() => data.value?.trackedPerWeek ?? [])
const trackedChart = computed(() => ({
  labels: weeks.value.map(week => `Week of ${shortDay(week.weekStart)}`),
  datasets: [{ label: 'Hours tracked', data: weeks.value.map(week => toHours(week.total)), backgroundColor: theme.value.series[1], borderRadius: 4, maxBarThickness: 48 }],
}))

const estimates = computed(() => data.value?.estimateVsActual ?? [])
const estimateChart = computed(() => ({
  labels: estimates.value.map(row => row.projectName),
  datasets: [
    { label: 'Estimated', data: estimates.value.map(row => toHours(row.estimatedSeconds)), backgroundColor: theme.value.series[2], borderRadius: 4, maxBarThickness: 40 },
    { label: 'Tracked', data: estimates.value.map(row => toHours(row.trackedSeconds)), backgroundColor: theme.value.series[0], borderRadius: 4, maxBarThickness: 40 },
  ],
}))

const statusChart = computed(() => ({
  labels: TASK_STATUSES.map(status => TASK_STATUS_LABELS[status]),
  datasets: [{
    data: TASK_STATUSES.map(status => data.value?.statusCounts[status] ?? 0),
    backgroundColor: [theme.value.text, theme.value.series[2], theme.value.series[0], theme.value.series[1]],
    borderWidth: 0,
  }],
}))
const statusOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: { legend: { position: 'right' as const, labels: { color: theme.value.text, boxWidth: 12 } } },
}))

const progress = computed(() => data.value?.projectProgress ?? [])
const progressChart = computed(() => ({
  labels: labels.value,
  datasets: progress.value.map((project, index) => ({
    label: project.name,
    data: project.percents,
    borderColor: theme.value.series[index % theme.value.series.length],
    backgroundColor: theme.value.series[index % theme.value.series.length],
    pointRadius: 0,
    tension: 0.25,
    borderWidth: 2,
  })),
}))
</script>

<template>
  <AppPage title="Analytics">
    <div class="space-y-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 class="text-xl font-semibold">
            {{ formatDate(range.from) }} – {{ formatDate(range.to) }}
          </h2>
          <p
            v-if="data"
            class="text-sm text-muted"
          >
            {{ data.totals.completed }} {{ data.totals.completed === 1 ? 'task' : 'tasks' }} completed ·
            {{ formatDuration(data.totals.trackedSeconds) }} tracked
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <USelect
            :model-value="preset"
            :items="presetItems"
            aria-label="Date range"
            class="w-40"
            @update:model-value="choosePreset"
          />
          <template v-if="preset === 'custom'">
            <UInput
              type="date"
              :model-value="range.from"
              :max="range.to"
              aria-label="From"
              @update:model-value="value => setDate('from', String(value))"
            />
            <UInput
              type="date"
              :model-value="range.to"
              :min="range.from"
              :max="today"
              aria-label="To"
              @update:model-value="value => setDate('to', String(value))"
            />
          </template>
        </div>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="These charts couldn’t be loaded."
        :description="errorMessage(error)"
      />

      <div
        v-else-if="status === 'pending' && !data"
        class="grid gap-6 lg:grid-cols-2"
      >
        <USkeleton
          v-for="n in 4"
          :key="n"
          class="h-72"
        />
      </div>

      <div
        v-else-if="data"
        class="grid gap-6 lg:grid-cols-2"
      >
        <ChartCard
          class="lg:col-span-2"
          title="Tasks completed per day"
          :empty="data.totals.completed === 0"
          empty-text="No tasks were completed in this period."
          :table="{ columns: ['Day', 'Completed'], rows: data.days.map((day, i) => [formatDate(day), data!.completedPerDay[i]!]) }"
        >
          <LazyChartView
            type="bar"
            :data="completedChart"
            :options="countOptions"
          />
        </ChartCard>

        <ChartCard
          title="Hours tracked per week"
          description="Weeks run Monday to Sunday."
          :empty="data.totals.trackedSeconds === 0"
          empty-text="No time was tracked in this period."
          :table="{ columns: ['Week of', 'Tracked'], rows: weeks.map(week => [formatDate(week.weekStart), formatDuration(week.total)]) }"
        >
          <LazyChartView
            type="bar"
            :data="trackedChart"
            :options="hoursOptions"
          />
        </ChartCard>

        <ChartCard
          title="Estimated and tracked time"
          description="Tasks finished in this period that had an estimate, per project."
          :empty="estimates.length === 0"
          empty-text="No estimated tasks were finished in this period."
          :table="{ columns: ['Project', 'Tasks', 'Estimated', 'Tracked'], rows: estimates.map(row => [row.projectName, row.taskCount, formatDuration(row.estimatedSeconds), formatDuration(row.trackedSeconds)]) }"
        >
          <LazyChartView
            type="bar"
            :data="estimateChart"
            :options="estimateOptions"
          />
        </ChartCard>

        <ChartCard
          title="Tasks by column"
          description="Right now, across active projects."
          :empty="Object.values(data.statusCounts).every(count => count === 0)"
          empty-text="No tasks in active projects."
          :table="{ columns: ['Column', 'Tasks'], rows: TASK_STATUSES.map(status => [TASK_STATUS_LABELS[status], data!.statusCounts[status]]) }"
        >
          <LazyChartView
            type="doughnut"
            :data="statusChart"
            :options="statusOptions"
          />
        </ChartCard>

        <ChartCard
          title="Project progress"
          description="Share of each active project’s tasks done, day by day."
          :empty="progress.length === 0"
          empty-text="No active projects with tasks."
          :table="{ columns: ['Project', 'At the start', 'At the end'], rows: progress.map(p => [p.name, `${p.percents[0]}%`, `${p.percents.at(-1)}%`]) }"
        >
          <LazyChartView
            type="line"
            :data="progressChart"
            :options="progressOptions"
          />
        </ChartCard>
      </div>
    </div>
  </AppPage>
</template>
