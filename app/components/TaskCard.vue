<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// One card on the board. The "Move" menu does everything dragging does, from the keyboard.
const props = defineProps<{
  task: Task
  /** Its place in the column and the column's length, for "Move up/down". */
  index: number
  count: number
  readonly?: boolean
}>()
const emit = defineEmits<{
  open: []
  move: [status: TaskStatus, position: number]
}>()

const { byId } = useTags()
const tags = computed(() => props.task.tagIds.map(id => byId.value.get(id)).filter(tag => tag !== undefined))

const moveItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Move up', icon: 'i-lucide-arrow-up', disabled: props.index === 0, onSelect: () => emit('move', props.task.status, props.index - 1) },
    { label: 'Move down', icon: 'i-lucide-arrow-down', disabled: props.index >= props.count - 1, onSelect: () => emit('move', props.task.status, props.index + 1) },
  ],
  TASK_STATUSES
    .filter(status => status !== props.task.status)
    .map(status => ({
      label: `Move to ${TASK_STATUS_LABELS[status]}`,
      icon: status === 'done' ? 'i-lucide-circle-check' : 'i-lucide-columns-3',
      // To the bottom of that column; the server clamps the position.
      onSelect: () => emit('move', status, Number.MAX_SAFE_INTEGER),
    })),
])
</script>

<template>
  <article
    class="group relative rounded-md border border-default bg-default p-3 shadow-xs transition-colors hover:border-accented"
    :class="readonly ? '' : 'cursor-grab active:cursor-grabbing'"
    :data-task-id="task.id"
  >
    <div class="flex items-start gap-2">
      <!-- The whole card opens the task; the button gives it a keyboard target and a name. -->
      <UIcon
        v-if="task.status === 'done'"
        name="i-lucide-circle-check"
        class="mt-0.5 size-4 shrink-0 text-success"
      />
      <button
        type="button"
        class="min-w-0 flex-1 text-left text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-primary"
        :class="task.status === 'done' ? 'text-muted' : ''"
        @click="emit('open')"
      >
        {{ task.title }}<span
          v-if="task.status === 'done'"
          class="sr-only"
        > (done)</span>
      </button>
      <UDropdownMenu
        v-if="!readonly"
        :items="moveItems"
        :content="{ align: 'end' }"
      >
        <!-- no-drag: the board doesn't start a drag from this button (see pages/board.vue). -->
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="xs"
          class="no-drag relative z-10 -my-1 -mr-1 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
          :aria-label="`Move “${task.title}”`"
        />
      </UDropdownMenu>
    </div>

    <div
      v-if="tags.length"
      class="mt-2 flex flex-wrap gap-1"
    >
      <TagBadge
        v-for="tag in tags"
        :key="tag.id"
        :tag="tag"
      />
    </div>

    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span
        class="inline-flex items-center gap-1"
        :title="`${PRIORITY_LABELS[task.priority]} priority`"
      >
        <UIcon
          :name="{ low: 'i-lucide-arrow-down', medium: 'i-lucide-equal', high: 'i-lucide-arrow-up' }[task.priority]"
          class="size-3.5"
          :class="{ 'text-error': task.priority === 'high' }"
        />
        <span class="sr-only">{{ PRIORITY_LABELS[task.priority] }} priority</span>
      </span>
      <DueDate
        v-if="task.dueDate"
        :date="task.dueDate"
        :done="task.status === 'done'"
        compact
      />
      <span
        v-if="task.estimateMinutes"
        class="inline-flex items-center gap-1"
        title="Estimate"
      >
        <UIcon
          name="i-lucide-hourglass"
          class="size-3.5"
        />
        {{ formatMinutes(task.estimateMinutes) }}
      </span>
      <span
        v-if="task.commentCount"
        class="inline-flex items-center gap-1"
        :title="`${task.commentCount} comments`"
      >
        <UIcon
          name="i-lucide-message-square"
          class="size-3.5"
        />
        {{ task.commentCount }}
      </span>
    </div>
  </article>
</template>
