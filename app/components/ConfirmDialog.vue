<script setup lang="ts">
// A yes/no question before something that can't be undone. `confirm` may be async: the button
// shows a spinner until it settles, and the dialog closes only if it succeeds.
const props = defineProps<{
  title: string
  description: string
  confirmLabel: string
  confirm: () => Promise<void>
}>()

const open = defineModel<boolean>('open', { default: false })
const busy = ref(false)

async function onConfirm() {
  busy.value = true
  try {
    await props.confirm()
    open.value = false
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
    :dismissible="!busy"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="open = false"
        />
        <UButton
          :label="confirmLabel"
          color="error"
          :loading="busy"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
