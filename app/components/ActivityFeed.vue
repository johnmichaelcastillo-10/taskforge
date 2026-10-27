<script setup lang="ts">
defineProps<{ entries: ActivityEntry[] }>()
</script>

<template>
  <p
    v-if="entries.length === 0"
    class="text-sm text-muted"
  >
    Nothing has happened here yet.
  </p>
  <ol
    v-else
    class="space-y-3"
  >
    <li
      v-for="entry in entries"
      :key="entry.id"
      class="flex gap-3 text-sm"
    >
      <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated">
        <UIcon
          :name="describeActivity(entry).icon"
          class="size-3.5 text-muted"
        />
      </span>
      <div class="min-w-0">
        <p class="break-words">
          {{ describeActivity(entry).text }}
        </p>
        <NuxtTime
          :datetime="entry.createdAt"
          relative
          class="text-xs text-muted"
        />
      </div>
    </li>
  </ol>
</template>
