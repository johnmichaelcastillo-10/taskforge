<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()

// Filters live in the URL, so a filtered list can be bookmarked and survives a reload.
const view = computed({
  get: () => (route.query.view === 'archived' ? 'archived' : 'active'),
  set: value => router.replace({ query: { ...route.query, view: value === 'archived' ? 'archived' : undefined } }),
})
const status = computed({
  get: () => (PROJECT_STATUSES as readonly string[]).includes(String(route.query.status)) ? String(route.query.status) : 'all',
  set: value => router.replace({ query: { ...route.query, status: value === 'all' ? undefined : value } }),
})
// The search box updates the URL (and so the request) after a short pause in typing.
const search = ref(String(route.query.q ?? ''))
const query = computed(() => String(route.query.q ?? ''))
let typing: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(typing)
  typing = setTimeout(() => router.replace({ query: { ...route.query, q: value.trim() || undefined } }), 250)
})

const { data, status: loadStatus, error, refresh } = await useFetch('/api/projects', {
  query: computed(() => ({
    archived: view.value === 'archived',
    status: status.value === 'all' ? undefined : status.value,
    q: query.value || undefined,
  })),
})
const projects = computed(() => data.value?.projects ?? [])
const filtered = computed(() => status.value !== 'all' || !!query.value)

const statusItems = [
  { value: 'all', label: 'All statuses' },
  ...PROJECT_STATUSES.map(value => ({ value, label: PROJECT_STATUS_LABELS[value] })),
]
const viewItems = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

const creating = ref(false)
async function onCreated(project: Project) {
  await navigateTo(`/projects/${project.id}`)
}

function clearFilters() {
  search.value = ''
  router.replace({ query: { view: route.query.view } })
}
</script>

<template>
  <AppPage title="Projects">
    <template #actions>
      <UButton
        label="New project"
        icon="i-lucide-plus"
        @click="creating = true"
      />
    </template>

    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UTabs
          v-model="view"
          :items="viewItems"
          :content="false"
          size="sm"
          class="sm:w-56"
        />
        <UInput
          v-model="search"
          icon="i-lucide-search"
          name="q"
          placeholder="Search projects"
          aria-label="Search projects"
          class="sm:ml-auto sm:w-64"
        />
        <USelect
          v-model="status"
          :items="statusItems"
          aria-label="Filter by status"
          class="sm:w-44"
        />
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Projects couldn’t be loaded."
        :actions="[{ label: 'Try again', onClick: () => refresh() }]"
      />

      <div
        v-else-if="loadStatus === 'pending' && !data"
        class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="n in 3"
          :key="n"
          class="h-40"
        />
      </div>

      <UEmpty
        v-else-if="projects.length === 0 && filtered"
        icon="i-lucide-search-x"
        title="No projects match"
        description="Try another search or status."
        :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'subtle', onClick: clearFilters }]"
      />

      <UEmpty
        v-else-if="projects.length === 0 && view === 'archived'"
        icon="i-lucide-archive"
        title="Nothing archived"
        description="Archive finished or paused projects to keep this list short. They stay read-only until restored."
      />

      <UEmpty
        v-else-if="projects.length === 0"
        icon="i-lucide-folder-kanban"
        title="No projects yet"
        description="A project groups related tasks, with a deadline and a priority."
        :actions="[{ label: 'Create your first project', icon: 'i-lucide-plus', onClick: () => { creating = true } }]"
      />

      <div
        v-else
        class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
        />
      </div>
    </div>

    <LazyProjectFormModal

      v-if="creating"
      v-model:open="creating"
      @saved="onCreated"
    />
  </AppPage>
</template>
