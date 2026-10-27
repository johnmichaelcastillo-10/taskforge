<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
  titleTemplate: title => (title && title !== 'Taskforge' ? `${title} · Taskforge` : 'Taskforge'),
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
