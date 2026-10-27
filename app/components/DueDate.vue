<script setup lang="ts">
// "Due Mar 4 · in 5 days": red once overdue, amber in the last three days. Nothing is urgent
// about finished work, so `done` turns the colours off.
const props = defineProps<{ date: string, label?: string, done?: boolean }>()

const today = useToday()
const days = computed(() => daysBetween(today.value, props.date))
const tone = computed(() => {
  if (props.done) return 'text-muted'
  if (days.value < 0) return 'text-error'
  if (days.value <= 3) return 'text-warning'
  return 'text-muted'
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 text-sm"
    :class="tone"
  >
    <UIcon
      :name="!done && days < 0 ? 'i-lucide-alarm-clock-off' : 'i-lucide-calendar'"
      class="size-4 shrink-0"
    />
    <span>
      {{ label ?? 'Due' }} {{ formatDate(date) }}
      <template v-if="!done">· {{ days < 0 ? `overdue by ${-days} ${-days === 1 ? 'day' : 'days'}` : relativeDay(date, today) }}</template>
    </span>
  </span>
</template>
