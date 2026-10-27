<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
  titleTemplate: title => (title && title !== 'Taskforge' ? `${title} · Taskforge` : 'Taskforge'),
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', sizes: '32x32', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  ],
})
// Pages with their own description replace this one.
useSeoMeta({ description: 'Taskforge: projects, a Kanban board, work timers and analytics, in one place.' })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
