<script setup lang="ts">
// Picks tags by id. Typing a name that doesn't exist offers to create it.
const model = defineModel<number[]>({ required: true })
defineProps<{ disabled?: boolean }>()

const toast = useToast()
const { tags, createTag } = useTags()
const items = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.id })))

async function onCreate(name: string) {
  try {
    const tag = await createTag(name.trim())
    model.value = [...model.value, tag.id]
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t create the tag', description: errorMessage(error) })
  }
}
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="items"
    value-key="value"
    multiple
    create-item
    :disabled="disabled"
    placeholder="Add tags"
    :search-input="{ placeholder: 'Find or create a tag' }"
    class="w-full"
    @create="onCreate"
  />
</template>
