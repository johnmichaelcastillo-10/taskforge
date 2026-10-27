<script setup lang="ts">
defineProps<{ tag: Pick<Tag, 'name' | 'color'> }>()

// Full class names, so Tailwind finds them when scanning the source. Dark text on a pale fill
// (and the reverse in dark mode) keeps every colour readable.
const CLASSES: Record<TagColor, string> = {
  gray: 'bg-gray-500/15 text-gray-700 dark:text-gray-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  orange: 'bg-orange-500/15 text-orange-800 dark:text-orange-300',
  amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  green: 'bg-green-500/15 text-green-800 dark:text-green-300',
  teal: 'bg-teal-500/15 text-teal-800 dark:text-teal-300',
  sky: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium"
    :class="CLASSES[tag.color]"
  >{{ tag.name }}</span>
</template>
