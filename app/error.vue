<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useSeoMeta({ title: notFound.value ? 'Not found' : 'Something went wrong' })

const { loggedIn } = useUserSession()
</script>

<template>
  <UApp>
    <NuxtLayout name="default">
      <UContainer class="flex justify-center py-24">
        <UEmpty
          :icon="notFound ? 'i-lucide-map-pin-off' : 'i-lucide-triangle-alert'"
          :title="notFound ? 'This page doesn’t exist' : 'Something went wrong'"
          :description="notFound
            ? 'It may have been deleted, or the link is wrong.'
            : 'Try again in a moment. If it keeps happening, reload the page.'"
          variant="naked"
          :actions="[{
            label: loggedIn ? 'Back to the dashboard' : 'Back to the start',
            icon: 'i-lucide-arrow-left',
            onClick: () => clearError({ redirect: loggedIn ? '/dashboard' : '/' }),
          }]"
        />
      </UContainer>
    </NuxtLayout>
  </UApp>
</template>
