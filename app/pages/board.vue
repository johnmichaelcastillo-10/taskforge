<script setup lang="ts">
import { VueDraggable, type SortableEvent } from 'vue-draggable-plus'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { tags } = useTags()
const timer = useTimer()

// One board per project, chosen in the URL (?project=12). Defaults to the first active project.
const { data: projectData } = await useFetch('/api/projects', { key: 'board-projects' })
const projects = computed(() => projectData.value?.projects ?? [])
const projectId = computed<number | undefined>({
  get: () => Number(route.query.project) || projects.value[0]?.id,
  set: id => router.replace({ query: { ...route.query, project: id } }),
})
const project = computed(() => projects.value.find(p => p.id === projectId.value))

const { data, refresh } = await useFetch('/api/tasks', {
  query: computed(() => ({ projectId: projectId.value })),
  immediate: !!projectId.value,
  watch: [projectId],
})

// Filters narrow the cards shown. They're applied here, on the loaded board, so they're instant.
const search = ref('')
const priority = ref<Priority | 'all'>('all')
const tagFilter = ref<number | 'all'>('all')
const filtering = computed(() => !!search.value.trim() || priority.value !== 'all' || tagFilter.value !== 'all')

function visible(task: Task) {
  const q = search.value.trim().toLowerCase()
  return (!q || task.title.toLowerCase().includes(q))
    && (priority.value === 'all' || task.priority === priority.value)
    && (tagFilter.value === 'all' || task.tagIds.includes(tagFilter.value))
}

// The columns, kept as local arrays so dragging can reorder them before the server confirms.
const columns = reactive(Object.fromEntries(TASK_STATUSES.map(status => [status, [] as Task[]])) as Record<TaskStatus, Task[]>)
watch(() => data.value?.tasks, (tasks) => {
  for (const status of TASK_STATUSES) {
    columns[status] = (tasks ?? []).filter(task => task.status === status)
  }
}, { immediate: true })
const shown = computed(() => Object.fromEntries(TASK_STATUSES.map(status => [status, columns[status].filter(visible)])) as Record<TaskStatus, Task[]>)

// Reordering a filtered column would be ambiguous (where do the hidden cards go?), so dragging
// pauses while filters are on. "Move to…" still works.
const readonly = computed(() => !project.value || !!project.value.archivedAt)
const dragDisabled = computed(() => readonly.value || filtering.value)

async function move(task: Task, status: TaskStatus, position: number) {
  try {
    await $fetch(`/api/tasks/${task.id}/move`, { method: 'POST', body: { status, position } })
    if (status === 'done' && task.status !== 'done') {
      toast.add({ title: 'Task completed', description: task.title, icon: 'i-lucide-circle-check' })
      // Completing a task stops its timer on the server.
      if (timer.running.value?.taskId === task.id) await timer.refresh()
    }
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t move the task', description: errorMessage(error) })
  }
  await refresh()
}

// After a drop the arrays already show the new order; tell the server where the card landed.
function onDrop(event: SortableEvent) {
  const status = (event.to as HTMLElement).dataset.status as TaskStatus
  const id = Number((event.item as HTMLElement).dataset.taskId)
  const task = columns[status].find(t => t.id === id)
  if (!task || event.newIndex === undefined) return
  if (event.from === event.to && event.oldIndex === event.newIndex) return
  move(task, status, event.newIndex)
}

// Quick add at the bottom of a column: type a title, press Enter.
const drafts = reactive(Object.fromEntries(TASK_STATUSES.map(status => [status, ''])) as Record<TaskStatus, string>)
const adding = ref<TaskStatus>()
async function addTask(status: TaskStatus) {
  const title = drafts[status].trim()
  if (!title || !projectId.value) return
  adding.value = status
  try {
    await $fetch('/api/tasks', { method: 'POST', body: { projectId: projectId.value, title, status } })
    drafts[status] = ''
    await refresh()
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t add the task', description: errorMessage(error) })
  }
  finally {
    adding.value = undefined
  }
}

const openTaskId = ref<number | null>(null)
const panelOpen = ref(false)
function openTask(id: number) {
  openTaskId.value = id
  panelOpen.value = true
}

async function onTaskChanged() {
  await refresh()
  refreshNuxtData('board-projects')
}

const projectItems = computed(() => projects.value.map(p => ({ label: p.name, value: p.id })))
const priorityItems = [{ value: 'all', label: 'All priorities' }, ...PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] }))]
const tagItems = computed(() => [{ value: 'all' as const, label: 'All tags' }, ...tags.value.map(tag => ({ value: tag.id, label: tag.name }))])

function clearFilters() {
  search.value = ''
  priority.value = 'all'
  tagFilter.value = 'all'
}
</script>

<template>
  <AppPage title="Board">
    <div
      v-if="projects.length === 0"
      class="py-8"
    >
      <UEmpty
        icon="i-lucide-square-kanban"
        title="No projects to show"
        description="The board shows one project’s tasks. Create a project first."
        :actions="[{ label: 'Go to projects', to: '/projects', icon: 'i-lucide-folder-kanban' }]"
      />
    </div>

    <div
      v-else
      class="flex h-full flex-col gap-4"
    >
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <USelect
          v-model="projectId"
          :items="projectItems"
          aria-label="Project"
          icon="i-lucide-folder-kanban"
          class="lg:w-64"
        />
        <!-- Two columns on phones, so the filters don't push the board off the first screen. -->
        <div class="grid flex-1 grid-cols-2 gap-3 sm:flex sm:flex-row lg:justify-end">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            name="q"
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            class="col-span-2 sm:w-56"
          />
          <USelect
            v-model="priority"
            :items="priorityItems"
            aria-label="Filter by priority"
            class="sm:w-40"
          />
          <USelect
            v-model="tagFilter"
            :items="tagItems"
            aria-label="Filter by tag"
            class="sm:w-40"
          />
        </div>
      </div>

      <UAlert
        v-if="projectId && !project"
        color="neutral"
        variant="subtle"
        icon="i-lucide-archive"
        title="This project isn’t on the board"
        description="It’s archived or doesn’t exist. Archived projects are read-only; restore one from its page to work on it."
      />

      <UAlert
        v-if="filtering"
        color="neutral"
        variant="subtle"
        icon="i-lucide-filter"
        title="Filtered: drag and drop is paused"
        description="Use each card’s Move menu, or clear the filters to drag again."
        :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline', onClick: clearFilters }]"
      />

      <!-- Columns scroll sideways on narrow screens; the page itself never does. -->
      <div class="-mx-4 flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:snap-none">
        <section
          v-for="status in TASK_STATUSES"
          :key="status"
          class="flex w-72 shrink-0 snap-start flex-col rounded-lg bg-elevated/50 lg:w-auto lg:flex-1 lg:basis-0"
          :aria-labelledby="`column-${status}`"
        >
          <header class="flex items-center justify-between px-3 pt-3">
            <h2
              :id="`column-${status}`"
              class="text-sm font-semibold"
            >
              {{ TASK_STATUS_LABELS[status] }}
            </h2>
            <UBadge
              :label="String(shown[status].length)"
              color="neutral"
              variant="soft"
              size="sm"
              :aria-label="`${shown[status].length} tasks`"
            />
          </header>

          <VueDraggable
            v-if="!filtering"
            v-model="columns[status]"
            group="tasks"
            :animation="150"
            :disabled="dragDisabled"
            :data-status="status"
            filter=".no-drag"
            :prevent-on-filter="false"
            ghost-class="opacity-40"
            class="flex min-h-24 flex-1 flex-col gap-2 p-3 empty:items-center empty:justify-center empty:after:text-xs empty:after:text-muted empty:after:content-['Drop_tasks_here']"
            @end="onDrop"
          >
            <TaskCard
              v-for="(task, index) in columns[status]"
              :key="task.id"
              :task="task"
              :index="index"
              :count="columns[status].length"
              :readonly="readonly"
              @open="openTask(task.id)"
              @move="(to, position) => move(task, to, position)"
            />
          </VueDraggable>
          <div
            v-else
            class="flex min-h-24 flex-1 flex-col gap-2 p-3 empty:items-center empty:justify-center empty:after:text-xs empty:after:text-muted empty:after:content-['No_matches']"
          >
            <TaskCard
              v-for="task in shown[status]"
              :key="task.id"
              :task="task"
              :index="columns[status].indexOf(task)"
              :count="columns[status].length"
              :readonly="readonly"
              @open="openTask(task.id)"
              @move="(to, position) => move(task, to, position)"
            />
          </div>

          <form
            v-if="!readonly"
            class="px-3 pb-3"
            @submit.prevent="addTask(status)"
          >
            <UInput
              v-model="drafts[status]"
              name="title"
              icon="i-lucide-plus"
              :placeholder="`Add to ${TASK_STATUS_LABELS[status]}`"
              :aria-label="`New task in ${TASK_STATUS_LABELS[status]}`"
              variant="ghost"
              :loading="adding === status"
              class="w-full"
            />
          </form>
        </section>
      </div>
    </div>

    <TaskSlideover
      v-model:open="panelOpen"
      :task-id="openTaskId"
      :readonly="readonly"
      @changed="onTaskChanged"
    />
  </AppPage>
</template>
