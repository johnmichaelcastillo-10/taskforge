<script setup lang="ts">
// The running timer in the top bar of every app page: what's being timed, for how long, and a
// stop button. Hidden when nothing is running.
const toast = useToast()
const { running, since, setRunning, stop } = useTimer()
const elapsed = useElapsed(since)

const { data } = await useFetch('/api/timer', { key: 'timer' })
watch(data, value => setRunning(value?.running ?? null), { immediate: true })

const stopping = ref(false)
async function onStop() {
  stopping.value = true
  try {
    const session = await stop()
    toast.add({ title: `Logged ${formatDuration(session.durationSeconds)}`, description: session.taskTitle, icon: 'i-lucide-timer' })
    await refreshNuxtData()
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t stop the timer', description: errorMessage(error) })
  }
  finally {
    stopping.value = false
  }
}
</script>

<template>
  <div
    v-if="running"
    class="flex items-center gap-2 rounded-md border border-default bg-elevated/50 py-1 pr-1 pl-2.5 text-sm"
    role="status"
  >
    <span
      class="size-2 shrink-0 animate-pulse rounded-full bg-error motion-reduce:animate-none"
      aria-hidden="true"
    />
    <ULink
      :to="`/board?project=${running.projectId}`"
      class="hidden max-w-48 truncate text-muted hover:text-default md:inline"
      :title="`${running.taskTitle} · ${running.projectName}`"
    >
      {{ running.taskTitle }}
    </ULink>
    <span
      class="min-w-12 font-mono tabular-nums"
      :aria-label="elapsed === null ? `Timer running on ${running.taskTitle}` : `Timer running on ${running.taskTitle}: ${formatDuration(elapsed)}`"
    >{{ elapsed === null ? '–:––' : formatClock(elapsed) }}</span>
    <UTooltip text="Stop the timer">
      <UButton
        icon="i-lucide-square"
        color="error"
        variant="soft"
        size="xs"
        :loading="stopping"
        aria-label="Stop the timer"
        @click="onStop"
      />
    </UTooltip>
  </div>
</template>
