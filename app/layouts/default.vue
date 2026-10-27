<script setup lang="ts">
// Public pages: the landing page, sign-in and sign-up.
const { loggedIn } = useUserSession()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="border-b border-default">
      <UContainer class="flex h-16 items-center justify-between">
        <AppLogo />
        <div class="flex items-center gap-2">
          <UColorModeButton />
          <UButton
            v-if="loggedIn"
            to="/dashboard"
            label="Open the app"
            color="neutral"
            variant="outline"
          />
          <UButton
            v-else
            to="/login"
            label="Sign in"
            color="neutral"
            variant="ghost"
          />
        </div>
      </UContainer>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default py-6 text-sm text-muted">
      <UContainer class="flex flex-wrap items-center justify-between gap-3">
        <span>Taskforge: projects, a Kanban board, work timers and analytics.</span>
        <ULink
          to="/download"
          class="inline-flex items-center gap-1 hover:text-default"
        >
          <UIcon
            name="i-lucide-monitor-down"
            class="size-4"
          />
          Desktop app
        </ULink>
      </UContainer>
    </footer>
  </div>
</template>
