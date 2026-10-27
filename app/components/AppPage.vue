<script setup lang="ts">
// One page of the signed-in app: the top bar (title, page actions, demo notice) and a
// scrolling body.
const props = defineProps<{ title: string }>()

useSeoMeta({ title: () => props.title })

const { user } = useUserSession()
</script>

<template>
  <UDashboardPanel :id="title.toLowerCase()">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #right>
          <TimerIndicator />
          <slot name="actions" />
          <UColorModeButton />
        </template>
      </UDashboardNavbar>
      <div
        v-if="user?.isDemo && user.demoExpiresAt"
        class="flex items-center gap-2 border-b border-default bg-elevated/50 px-4 py-2 text-sm text-muted sm:px-6"
      >
        <UIcon
          name="i-lucide-flask-conical"
          class="size-4 shrink-0"
        />
        <span>
          Demo workspace<span class="hidden sm:inline">: private to this browser,</span> deleted
          <NuxtTime
            :datetime="user.demoExpiresAt"
            relative
          />.
        </span>
      </div>
    </template>

    <template #body>
      <slot />
    </template>
  </UDashboardPanel>
</template>
