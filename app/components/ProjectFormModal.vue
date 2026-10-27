<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

// Creates a project, or edits `project` when given. Emits the saved project.
const props = defineProps<{ project?: Project }>()
const emit = defineEmits<{ saved: [project: Project] }>()
const open = defineModel<boolean>('open', { default: false })

const form = useTemplateRef('form')
const failure = ref<string>()
const saving = ref(false)

// What the inputs hold: empty date inputs are '', which the schema turns into null.
interface FormState {
  name: string
  description: string
  status: ProjectStatus
  priority: Priority
  startDate: string
  deadline: string
}

function initialState(): FormState {
  return {
    name: props.project?.name ?? '',
    description: props.project?.description ?? '',
    status: props.project?.status ?? 'planning',
    priority: props.project?.priority ?? 'medium',
    startDate: props.project?.startDate ?? '',
    deadline: props.project?.deadline ?? '',
  }
}
const state = ref(initialState())

// Fresh values each time it opens, so a cancelled edit doesn't linger.
watch(open, (isOpen) => {
  if (isOpen) {
    state.value = initialState()
    failure.value = undefined
  }
})

const statusItems = PROJECT_STATUSES.map(value => ({ value, label: PROJECT_STATUS_LABELS[value] }))
const priorityItems = PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] }))

async function save(event: FormSubmitEvent<ProjectCreateData>) {
  failure.value = undefined
  saving.value = true
  try {
    const { project } = props.project
      ? await $fetch<{ project: Project }>(`/api/projects/${props.project.id}`, { method: 'PATCH', body: event.data })
      : await $fetch<{ project: Project }>('/api/projects', { method: 'POST', body: event.data })
    emit('saved', project)
    open.value = false
  }
  catch (error) {
    form.value?.setErrors(fieldErrors(error))
    failure.value = errorMessage(error)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="project ? 'Edit project' : 'New project'"
    :description="project ? undefined : 'Group related tasks, with a deadline and priority.'"
  >
    <template #body>
      <UForm
        id="project-form"
        ref="form"
        :schema="projectCreateSchema"
        :state="state"
        class="space-y-4"
        @submit="save"
      >
        <UFormField
          label="Name"
          name="name"
          required
        >
          <UInput
            v-model="state.name"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UFormField
          label="Description"
          name="description"
        >
          <UTextarea
            v-model="state.description"
            class="w-full"
            :rows="3"
            autoresize
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Status"
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
            label="Start date"
            name="startDate"
          >
            <UInput
              v-model="state.startDate"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Deadline"
            name="deadline"
          >
            <UInput
              v-model="state.deadline"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>

        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="failure"
        />
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="project-form"
          :label="project ? 'Save changes' : 'Create project'"
          :loading="saving"
        />
      </div>
    </template>
  </UModal>
</template>
