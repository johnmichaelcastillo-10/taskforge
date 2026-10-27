<script setup lang="ts">
const props = defineProps<{ project: Pick<Project, 'taskCount' | 'doneCount'> }>()

const percent = computed(() => props.project.taskCount
  ? Math.round((props.project.doneCount / props.project.taskCount) * 100)
  : 0)
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between text-xs text-muted">
      <span>{{ project.taskCount ? `${project.doneCount} of ${project.taskCount} tasks done` : 'No tasks yet' }}</span>
      <span v-if="project.taskCount">{{ percent }}%</span>
    </div>
    <UProgress
      :model-value="percent"
      size="sm"
      :color="percent === 100 ? 'success' : 'primary'"
      :aria-label="`${percent}% of tasks done`"
    />
  </div>
</template>
