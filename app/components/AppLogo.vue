<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
</script>

<template>
  <NuxtLink
    to="/"
    class="flex items-center gap-2 font-semibold tracking-tight"
    aria-label="Taskforge home"
  >
    <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-inverted">
      <UIcon
        name="i-lucide-hammer"
        class="size-4"
      />
    </span>
    <span v-if="!collapsed">Taskforge</span>
  </NuxtLink>
</template>
