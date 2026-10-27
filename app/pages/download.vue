<script setup lang="ts">
useSeoMeta({
  title: 'Desktop app',
  description: 'Taskforge for Windows and Linux: your workspace in its own window, with the timer in the system tray.',
})

// Where the installers are published, such as a releases page: NUXT_PUBLIC_DOWNLOADS_URL.
const { downloadsUrl } = useRuntimeConfig().public

const platforms = [
  { name: 'Windows', icon: 'i-lucide-monitor', files: 'Installer (.exe) or MSI package (.msi)', note: 'Windows 10 and 11' },
  { name: 'Linux', icon: 'i-lucide-terminal', files: 'Debian/Ubuntu package (.deb) or AppImage', note: 'Ubuntu 22.04 or newer, and most other distributions' },
]

const features = [
  { icon: 'i-lucide-timer', title: 'Timer in the tray', description: 'See what you’re timing and stop it from the system tray, even with the window closed.' },
  { icon: 'i-lucide-bell', title: 'Notifications', description: 'A notice when a timer starts or stops, and a reminder every two hours one keeps running.' },
  { icon: 'i-lucide-keyboard', title: 'Ctrl+Shift+Space', description: 'Bring Taskforge to the front from anywhere.' },
]
</script>

<template>
  <div>
    <UPageHero
      title="Taskforge on your desktop"
      description="The same workspace in its own window, with the timer in your system tray. Your data stays in your Taskforge account, so the browser and the desktop app always agree."
      :ui="{ container: 'py-12 sm:py-16 lg:py-20', title: 'text-4xl sm:text-5xl' }"
    />

    <UPageSection :ui="{ container: 'py-0 sm:py-0 lg:py-0' }">
      <div class="grid gap-4 md:grid-cols-2">
        <UPageCard
          v-for="platform in platforms"
          :key="platform.name"
          :icon="platform.icon"
          :title="platform.name"
          :description="`${platform.files}. ${platform.note}.`"
        >
          <template #footer>
            <UButton
              v-if="downloadsUrl"
              :to="downloadsUrl"
              target="_blank"
              rel="noopener"
              :label="`Download for ${platform.name}`"
              icon="i-lucide-download"
            />
            <p
              v-else
              class="text-sm text-muted"
            >
              Installers aren’t published for this copy of Taskforge yet.
            </p>
          </template>
        </UPageCard>
      </div>
    </UPageSection>

    <UPageSection
      title="What the desktop app adds"
      :ui="{ container: 'py-12 sm:py-16 lg:py-16', title: 'text-2xl sm:text-3xl' }"
    >
      <UPageGrid>
        <UPageCard
          v-for="feature in features"
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </UPageGrid>
    </UPageSection>
  </div>
</template>
