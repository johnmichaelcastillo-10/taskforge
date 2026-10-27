<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const { user, clear } = useUserSession()

const links: NavigationMenuItem[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Projects', icon: 'i-lucide-folder-kanban', to: '/projects' },
  { label: 'Board', icon: 'i-lucide-square-kanban', to: '/board' },
  { label: 'Analytics', icon: 'i-lucide-chart-column', to: '/analytics' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]

async function signOut() {
  await clear()
  await navigateTo('/')
}

const accountMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.email ?? 'Demo account' }],
  [
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
    { label: 'Desktop app', icon: 'i-lucide-monitor-down', to: '/download' },
  ],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      collapsible
      resizable
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <AppLogo :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="links"
          orientation="vertical"
          :collapsed="collapsed"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="accountMenu"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            :label="collapsed ? undefined : user?.name"
            :avatar="{ alt: user?.name }"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            :aria-label="collapsed ? `Account: ${user?.name}` : undefined"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated"
          />
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
