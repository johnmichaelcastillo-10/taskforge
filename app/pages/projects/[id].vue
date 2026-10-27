<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const toast = useToast()
const today = useToday()
const id = computed(() => Number(route.params.id))

const { data, error, refresh } = await useFetch(() => `/api/projects/${id.value}`)
if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Project not found', fatal: true })
}
const project = computed(() => data.value?.project)

const { data: activityData, refresh: refreshActivity } = await useFetch('/api/activity', {
  query: computed(() => ({ projectId: id.value, limit: 15 })),
})

const editing = ref(false)
const deleting = ref(false)
const archived = computed(() => !!project.value?.archivedAt)

async function reload() {
  await Promise.all([refresh(), refreshActivity()])
}

async function setArchived(value: boolean) {
  try {
    await $fetch(`/api/projects/${id.value}`, { method: 'PATCH', body: { archived: value } })
    await reload()
    toast.add({
      title: value ? 'Project archived' : 'Project restored',
      description: value ? 'It’s read-only until you restore it.' : undefined,
      icon: value ? 'i-lucide-archive' : 'i-lucide-archive-restore',
    })
  }
  catch (failure) {
    toast.add({ color: 'error', title: 'Couldn’t update the project', description: errorMessage(failure) })
  }
}

async function remove() {
  try {
    await $fetch(`/api/projects/${id.value}`, { method: 'DELETE' })
  }
  catch (failure) {
    toast.add({ color: 'error', title: 'Couldn’t delete the project', description: errorMessage(failure) })
    throw failure
  }
  toast.add({ title: 'Project deleted', icon: 'i-lucide-trash-2' })
  await navigateTo('/projects')
}

const menu = computed(() => [
  [
    archived.value
      ? { label: 'Restore', icon: 'i-lucide-archive-restore', onSelect: () => setArchived(false) }
      : { label: 'Archive', icon: 'i-lucide-archive', onSelect: () => setArchived(true) },
  ],
  [{ label: 'Delete…', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { deleting.value = true } }],
])
</script>

<template>
  <AppPage :title="project?.name ?? 'Project'">
    <template #actions>
      <UButton
        v-if="project && !archived"
        label="Edit"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        @click="editing = true"
      />
      <UDropdownMenu
        v-if="project"
        :items="menu"
      >
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          aria-label="More actions"
        />
      </UDropdownMenu>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="This project couldn’t be loaded."
      :actions="[{ label: 'Try again', onClick: () => reload() }]"
    />

    <div
      v-else-if="project"
      class="space-y-6"
    >
      <UBreadcrumb :items="[{ label: 'Projects', to: '/projects' }, { label: project.name }]" />

      <UAlert
        v-if="archived"
        color="neutral"
        variant="subtle"
        icon="i-lucide-archive"
        title="This project is archived"
        description="It’s read-only. Restore it to edit it or change its tasks."
        :actions="[{ label: 'Restore', color: 'neutral', variant: 'outline', onClick: () => setArchived(false) }]"
      />

      <section class="space-y-4 rounded-lg border border-default p-4 sm:p-6">
        <div class="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge
            :status="project.status"
            :archived="archived"
          />
          <PriorityBadge :priority="project.priority" />
        </div>
        <p
          v-if="project.description"
          class="max-w-prose whitespace-pre-line text-muted"
        >
          {{ project.description }}
        </p>
        <div class="flex flex-wrap gap-x-6 gap-y-2">
          <DueDate
            v-if="project.startDate"
            :date="project.startDate"
            :label="project.startDate <= today ? 'Started' : 'Starts'"
            done
          />
          <DueDate
            v-if="project.deadline"
            :date="project.deadline"
            :done="project.status === 'completed' || archived"
          />
          <span
            v-if="!project.startDate && !project.deadline"
            class="text-sm text-muted"
          >No dates set.</span>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">
          Activity
        </h2>
        <ActivityFeed :entries="activityData?.activity ?? []" />
      </section>
    </div>

    <ProjectFormModal
      v-if="project"
      v-model:open="editing"
      :project="project"
      @saved="reload"
    />
    <ConfirmDialog
      v-if="project"
      v-model:open="deleting"
      title="Delete this project?"
      :description="`“${project.name}” and everything in it will be deleted for good.${archived ? '' : ' Archive it instead to keep it read-only.'}`"
      confirm-label="Delete project"
      :confirm="remove"
    />
  </AppPage>
</template>
