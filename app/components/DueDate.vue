<script setup lang="ts">
// "Due Mar 4 · in 5 days": red once overdue, amber in the last three days. Nothing is urgent
// about finished work, so `done` turns the colours off. `compact` (task cards) shows only the
// relative part, with the full date on hover.
const props = defineProps<{ date: string, label?: string, done?: boolean, compact?: boolean }>()

const today = useToday()
const days = computed(() => daysBetween(today.value, props.date))
const overdue = computed(() => !props.done && days.value < 0)
const tone = computed(() => {
  if (props.done) return 'text-muted'
  if (days.value < 0) return 'text-error'
  if (days.value <= 3) return 'text-warning'
  return 'text-muted'
})
const relative = computed(() => overdue.value
  ? `${-days.value} ${days.value === -1 ? 'day' : 'days'} overdue`
  : relativeDay(props.date, today.value))
const full = computed(() => `${props.label ?? 'Due'} ${formatDate(props.date)}`)
</script>

<template>
  <span
    class="inline-flex items-center gap-1"
    :class="[tone, compact ? 'text-xs' : 'text-sm']"
    :title="compact ? full : undefined"
  >
    <UIcon
      :name="overdue ? 'i-lucide-alarm-clock-off' : 'i-lucide-calendar'"
      class="shrink-0"
      :class="compact ? 'size-3.5' : 'size-4'"
    />
    <span v-if="compact">
      <span class="sr-only">{{ full }}, </span>{{ done ? formatDate(date) : relative }}
    </span>
    <span v-else>
      {{ full }}<template v-if="!done"> · {{ relative }}</template>
    </span>
  </span>
</template>
