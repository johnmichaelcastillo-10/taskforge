<script setup lang="ts">
defineProps<{ project: Project }>()
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="group flex flex-col gap-3 rounded-lg border border-default bg-default p-4 transition-colors hover:border-accented hover:bg-elevated/40 focus-visible:outline-2 focus-visible:outline-primary"
  >
    <div class="flex items-start justify-between gap-3">
      <h2 class="font-semibold group-hover:text-primary">
        {{ project.name }}
      </h2>
      <ProjectStatusBadge
        :status="project.status"
        :archived="!!project.archivedAt"
        class="shrink-0"
      />
    </div>

    <p
      v-if="project.description"
      class="line-clamp-2 text-sm text-muted"
    >
      {{ project.description }}
    </p>

    <ProjectProgress
      :project="project"
      class="mt-auto"
    />

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <PriorityBadge :priority="project.priority" />
      <DueDate
        v-if="project.deadline"
        :date="project.deadline"
        :done="project.status === 'completed' || !!project.archivedAt"
      />
    </div>
  </NuxtLink>
</template>
