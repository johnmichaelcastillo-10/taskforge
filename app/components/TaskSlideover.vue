<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

// The full view of one task: edit its fields, tags and comments, or delete it. Emits `changed`
// after anything that alters what the board shows.
const props = defineProps<{ taskId: number | null, readonly?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { user } = useUserSession()

const task = ref<Task>()
const comments = ref<TaskComment[]>([])
const loading = ref(false)
const loadError = ref<string>()

interface FormState {
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  dueDate: string
  estimateHours: number | undefined
  tagIds: number[]
}
const state = ref<FormState>(emptyState())
const saving = ref(false)
const form = useTemplateRef('form')

function emptyState(): FormState {
  return { title: '', description: '', status: 'backlog', priority: 'medium', dueDate: '', estimateHours: undefined, tagIds: [] }
}

function stateFrom(value: Task): FormState {
  return {
    title: value.title,
    description: value.description,
    status: value.status,
    priority: value.priority,
    dueDate: value.dueDate ?? '',
    estimateHours: value.estimateMinutes ? +(value.estimateMinutes / 60).toFixed(2) : undefined,
    tagIds: [...value.tagIds],
  }
}

async function load() {
  if (!props.taskId) return
  loading.value = true
  loadError.value = undefined
  try {
    const [taskResponse, commentResponse] = await Promise.all([
      $fetch<{ task: Task }>(`/api/tasks/${props.taskId}`),
      $fetch<{ comments: TaskComment[] }>(`/api/tasks/${props.taskId}/comments`),
    ])
    task.value = taskResponse.task
    comments.value = commentResponse.comments
    state.value = stateFrom(taskResponse.task)
  }
  catch (error) {
    loadError.value = errorMessage(error)
  }
  finally {
    loading.value = false
  }
}

watch(() => [open.value, props.taskId], () => {
  if (open.value) load()
}, { immediate: true })

const dirty = computed(() => task.value !== undefined && JSON.stringify(state.value) !== JSON.stringify(stateFrom(task.value)))

// The form's own schema: estimate in hours here, minutes on the server.
const formSchema = taskUpdateSchema.omit({ estimateMinutes: true })

async function save(_event: FormSubmitEvent<unknown>) {
  if (!task.value) return
  saving.value = true
  try {
    const hours = state.value.estimateHours
    const { task: updated } = await $fetch<{ task: Task }>(`/api/tasks/${task.value.id}`, {
      method: 'PATCH',
      body: {
        title: state.value.title,
        description: state.value.description,
        status: state.value.status,
        priority: state.value.priority,
        dueDate: state.value.dueDate,
        estimateMinutes: hours ? Math.round(hours * 60) : null,
        tagIds: state.value.tagIds,
      },
    })
    task.value = updated
    state.value = stateFrom(updated)
    // Completing the task stops its timer on the server; catch up here.
    if (updated.status === 'done') await timer.refresh()
    emit('changed')
    toast.add({ title: 'Task saved', icon: 'i-lucide-check' })
  }
  catch (error) {
    form.value?.setErrors(fieldErrors(error).map(item => item.name === 'estimateMinutes' ? { ...item, name: 'estimateHours' } : item))
    toast.add({ color: 'error', title: 'Couldn’t save the task', description: errorMessage(error) })
  }
  finally {
    saving.value = false
  }
}

const deleting = ref(false)
async function remove() {
  if (!task.value) return
  try {
    await $fetch(`/api/tasks/${task.value.id}`, { method: 'DELETE' })
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t delete the task', description: errorMessage(error) })
    throw error
  }
  open.value = false
  emit('changed')
  toast.add({ title: 'Task deleted', icon: 'i-lucide-trash-2' })
}

const newComment = ref('')
const posting = ref(false)
async function postComment() {
  if (!task.value || !newComment.value.trim()) return
  posting.value = true
  try {
    await $fetch(`/api/tasks/${task.value.id}/comments`, { method: 'POST', body: { body: newComment.value } })
    newComment.value = ''
    comments.value = (await $fetch<{ comments: TaskComment[] }>(`/api/tasks/${task.value.id}/comments`)).comments
    emit('changed')
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t add the comment', description: errorMessage(error) })
  }
  finally {
    posting.value = false
  }
}

async function deleteComment(id: number) {
  try {
    await $fetch(`/api/comments/${id}`, { method: 'DELETE' })
    comments.value = comments.value.filter(comment => comment.id !== id)
    emit('changed')
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t delete the comment', description: errorMessage(error) })
  }
}

// Time tracking: the timer for this task, and its recent sessions.
const timer = useTimer()
const sessions = ref<WorkSession[]>([])
const timing = ref(false)
const runningHere = computed(() => timer.running.value?.taskId === task.value?.id)
const runningElsewhere = computed(() => !!timer.running.value && !runningHere.value)

async function loadSessions() {
  if (!props.taskId) return
  sessions.value = (await $fetch<{ sessions: WorkSession[] }>('/api/sessions', { query: { taskId: props.taskId, limit: 10 } })).sessions
}
watch(() => [open.value, props.taskId], () => {
  if (open.value) loadSessions().catch(() => {})
})

async function afterTimerChange() {
  await Promise.all([load(), loadSessions()])
  emit('changed')
}

async function toggleTimer() {
  if (!task.value) return
  timing.value = true
  try {
    if (runningHere.value) {
      const session = await timer.stop()
      toast.add({ title: `Logged ${formatDuration(session.durationSeconds)}`, icon: 'i-lucide-timer' })
    }
    else {
      const { stopped } = await timer.start(task.value.id, { switch: runningElsewhere.value })
      if (stopped) {
        toast.add({ title: 'Timer switched', description: `Logged ${formatDuration(stopped.durationSeconds)} on “${stopped.taskTitle}”.`, icon: 'i-lucide-timer' })
      }
    }
    await afterTimerChange()
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t change the timer', description: errorMessage(error) })
  }
  finally {
    timing.value = false
  }
}

async function deleteSession(id: number) {
  try {
    await $fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (timer.running.value?.id === id) timer.setRunning(null)
    await afterTimerChange()
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t delete the session', description: errorMessage(error) })
  }
}

function sessionLabel(session: WorkSession) {
  const start = new Date(session.startedAt)
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: user.value?.timezone }).format(start)
  return `${day} · ${session.endedAt ? formatDuration(session.durationSeconds) : 'running'}`
}

const statusItems = TASK_STATUSES.map(value => ({ value, label: TASK_STATUS_LABELS[value] }))
const priorityItems = PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] }))
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="task?.title ?? 'Task'"
    :description="task ? `In ${task.projectName}` : undefined"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div
        v-if="loading && !task"
        class="space-y-3"
      >
        <USkeleton class="h-9" />
        <USkeleton class="h-24" />
      </div>

      <UAlert
        v-else-if="loadError"
        color="error"
        variant="subtle"
        :title="loadError"
        :actions="[{ label: 'Try again', onClick: load }]"
      />

      <div
        v-else-if="task"
        class="space-y-8"
      >
        <UForm
          id="task-form"
          ref="form"
          :schema="formSchema"
          :state="state"
          :disabled="readonly"
          class="space-y-4"
          @submit="save"
        >
          <UFormField
            label="Title"
            name="title"
            required
          >
            <UInput
              v-model="state.title"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Description"
            name="description"
          >
            <UTextarea
              v-model="state.description"
              class="w-full"
              :rows="4"
              autoresize
              placeholder="Notes, acceptance criteria, links…"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Column"
              name="status"
            >
              <USelect
                v-model="state.status"
                :items="statusItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Priority"
              name="priority"
            >
              <USelect
                v-model="state.priority"
                :items="priorityItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Due date"
              name="dueDate"
            >
              <UInput
                v-model="state.dueDate"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Estimate (hours)"
              name="estimateHours"
            >
              <UInputNumber
                v-model="state.estimateHours"
                :min="0"
                :max="1666"
                :step="0.25"
                :format-options="{ maximumFractionDigits: 2 }"
                placeholder="None"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField
            label="Tags"
            name="tagIds"
          >
            <TagSelect
              v-model="state.tagIds"
              :disabled="readonly"
            />
          </UFormField>

          <div
            v-if="!readonly"
            class="flex items-center justify-between gap-2"
          >
            <UButton
              label="Delete task"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              @click="deleting = true"
            />
            <UButton
              type="submit"
              label="Save changes"
              :loading="saving"
              :disabled="!dirty"
            />
          </div>
        </UForm>

        <section class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold">
                Time
              </h3>
              <p class="text-sm text-muted">
                {{ formatDuration(task.trackedSeconds) }} tracked<template v-if="task.estimateMinutes">
                  of {{ formatMinutes(task.estimateMinutes) }} estimated
                </template>
              </p>
            </div>
            <UButton
              v-if="!readonly && (task.status !== 'done' || runningHere)"
              :label="runningHere ? 'Stop timer' : runningElsewhere ? 'Switch timer here' : 'Start timer'"
              :icon="runningHere ? 'i-lucide-square' : 'i-lucide-play'"
              :color="runningHere ? 'error' : 'primary'"
              :variant="runningHere ? 'soft' : 'solid'"
              :loading="timing"
              @click="toggleTimer"
            />
            <p
              v-else-if="!readonly"
              class="text-sm text-muted"
            >
              Reopen the task to track more time.
            </p>
          </div>
          <p
            v-if="runningElsewhere && !readonly && task.status !== 'done'"
            class="text-xs text-muted"
          >
            Switching stops the timer on “{{ timer.running.value?.taskTitle }}” and logs its time.
          </p>
          <ul
            v-if="sessions.length"
            class="divide-y divide-default rounded-md border border-default text-sm"
          >
            <li
              v-for="session in sessions"
              :key="session.id"
              class="flex items-center justify-between gap-2 px-3 py-1.5"
            >
              <span :class="session.endedAt ? 'text-muted' : 'text-default'">{{ sessionLabel(session) }}</span>
              <UButton
                v-if="!readonly && session.endedAt"
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                :aria-label="`Delete session: ${sessionLabel(session)}`"
                @click="deleteSession(session.id)"
              />
            </li>
          </ul>
        </section>

        <section class="space-y-4">
          <h3 class="font-semibold">
            Comments
            <span class="font-normal text-muted">({{ comments.length }})</span>
          </h3>
          <ol
            v-if="comments.length"
            class="space-y-3"
          >
            <li
              v-for="comment in comments"
              :key="comment.id"
              class="rounded-md bg-elevated/50 p-3 text-sm"
            >
              <div class="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                <span>
                  <span class="font-medium text-default">{{ comment.authorName }}</span>
                  ·
                  <NuxtTime
                    :datetime="comment.createdAt"
                    relative
                  />
                </span>
                <UButton
                  v-if="!readonly && comment.authorId === user?.id"
                  icon="i-lucide-x"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Delete comment"
                  @click="deleteComment(comment.id)"
                />
              </div>
              <p class="whitespace-pre-line break-words">
                {{ comment.body }}
              </p>
            </li>
          </ol>
          <p
            v-else
            class="text-sm text-muted"
          >
            No comments yet.
          </p>

          <form
            v-if="!readonly"
            class="space-y-2"
            @submit.prevent="postComment"
          >
            <UTextarea
              v-model="newComment"
              :rows="2"
              autoresize
              placeholder="Add a comment"
              aria-label="Add a comment"
              class="w-full"
              :maxlength="2000"
              @keydown.ctrl.enter="postComment"
              @keydown.meta.enter="postComment"
            />
            <div class="flex justify-end">
              <UButton
                type="submit"
                label="Comment"
                size="sm"
                :loading="posting"
                :disabled="!newComment.trim()"
              />
            </div>
          </form>
        </section>
      </div>
    </template>
  </USlideover>

  <ConfirmDialog
    v-if="task"
    v-model:open="deleting"
    title="Delete this task?"
    :description="`“${task.title}”, its comments and its tracked time will be deleted for good.`"
    confirm-label="Delete task"
    :confirm="remove"
  />
</template>
