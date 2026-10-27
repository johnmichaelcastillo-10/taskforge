<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const toast = useToast()
const { user, fetch: refreshSession, clear } = useUserSession()

// Profile: name and time zone ("today", due dates and charts follow the time zone).
const profile = reactive({ name: user.value?.name ?? '', timezone: user.value?.timezone ?? 'UTC' })
const zones = Intl.supportedValuesOf('timeZone')
const zoneItems = computed(() => zones.includes(profile.timezone) ? zones : [profile.timezone, ...zones])
const savingProfile = ref(false)
const profileChanged = computed(() => profile.name.trim() !== user.value?.name || profile.timezone !== user.value?.timezone)

async function saveProfile() {
  savingProfile.value = true
  try {
    await $fetch('/api/me', { method: 'PATCH', body: { name: profile.name, timezone: profile.timezone } })
    await refreshSession()
    await refreshNuxtData()
    toast.add({ title: 'Profile saved', icon: 'i-lucide-check' })
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t save your profile', description: errorMessage(error) })
  }
  finally {
    savingProfile.value = false
  }
}

// API tokens. A new token's secret is shown once, right after it's created.
const { data: tokenData, refresh: refreshTokens } = await useFetch('/api/tokens')
const tokens = computed(() => tokenData.value?.tokens ?? [])
const creatingToken = ref(false)
const tokenName = ref('')
const newSecret = ref<string>()
const tokenBusy = ref(false)

async function createToken() {
  tokenBusy.value = true
  try {
    const { secret } = await $fetch<{ secret: string }>('/api/tokens', { method: 'POST', body: { name: tokenName.value } })
    newSecret.value = secret
    tokenName.value = ''
    await refreshTokens()
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t create the token', description: errorMessage(error) })
  }
  finally {
    tokenBusy.value = false
  }
}

function closeTokenModal() {
  creatingToken.value = false
  newSecret.value = undefined
}

async function copySecret() {
  if (!newSecret.value) return
  try {
    await navigator.clipboard.writeText(newSecret.value)
    toast.add({ title: 'Token copied', icon: 'i-lucide-clipboard-check' })
  }
  catch {
    toast.add({ color: 'error', title: 'Couldn’t copy', description: 'Select the token and copy it yourself.' })
  }
}

const revoking = ref<{ id: number, name: string }>()
const revokeOpen = computed({
  get: () => !!revoking.value,
  set: (open) => {
    if (!open) revoking.value = undefined
  },
})
async function revoke() {
  if (!revoking.value) return
  try {
    await $fetch(`/api/tokens/${revoking.value.id}`, { method: 'DELETE' })
    await refreshTokens()
    toast.add({ title: 'Token revoked', icon: 'i-lucide-key-round' })
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t revoke the token', description: errorMessage(error) })
    throw error
  }
}

// Tags.
const { tags, refresh: refreshTags } = useTags()
async function deleteTag(tag: Tag) {
  try {
    await $fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
    await refreshTags()
    toast.add({ title: `Tag “${tag.name}” deleted`, description: 'It’s been removed from every task.' })
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t delete the tag', description: errorMessage(error) })
  }
}

// Deleting the account (or ending the demo early).
const deletingAccount = ref(false)
async function deleteAccount() {
  try {
    await $fetch('/api/me', { method: 'DELETE' })
  }
  catch (error) {
    toast.add({ color: 'error', title: 'Couldn’t delete the account', description: errorMessage(error) })
    throw error
  }
  await clear()
  await navigateTo('/')
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: user.value?.timezone }).format(new Date(value))
}
</script>

<template>
  <AppPage title="Settings">
    <div class="mx-auto max-w-3xl space-y-8">
      <section class="space-y-4">
        <header>
          <h2 class="font-semibold">
            Profile
          </h2>
          <p class="text-sm text-muted">
            Due dates, “today” and the charts follow your time zone.
          </p>
        </header>
        <form
          class="grid gap-4 sm:grid-cols-2"
          @submit.prevent="saveProfile"
        >
          <UFormField
            label="Name"
            name="name"
          >
            <UInput
              v-model="profile.name"
              class="w-full"
              :maxlength="80"
              required
            />
          </UFormField>
          <UFormField
            label="Time zone"
            name="timezone"
          >
            <USelectMenu
              v-model="profile.timezone"
              :items="zoneItems"
              class="w-full"
              virtualize
              :search-input="{ placeholder: 'Search time zones' }"
            />
          </UFormField>
          <div class="sm:col-span-2">
            <UButton
              type="submit"
              label="Save profile"
              :loading="savingProfile"
              :disabled="!profileChanged || !profile.name.trim()"
            />
          </div>
        </form>
      </section>

      <USeparator />

      <section class="space-y-4">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">
              API tokens
            </h2>
            <p class="text-sm text-muted">
              For scripts and tools that use the REST API at <code class="rounded bg-elevated px-1">/api/v1</code>.
              A token can do anything you can, so keep it secret.
            </p>
          </div>
          <UButton
            label="New token"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            @click="creatingToken = true"
          />
        </header>
        <ul
          v-if="tokens.length"
          class="divide-y divide-default rounded-lg border border-default"
        >
          <li
            v-for="token in tokens"
            :key="token.id"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="font-medium">
                {{ token.name }}
              </p>
              <p class="text-xs text-muted">
                <code>{{ token.prefix }}…</code> · created {{ formatTimestamp(token.createdAt) }} ·
                {{ token.lastUsedAt ? `last used ${formatTimestamp(token.lastUsedAt)}` : 'never used' }}
              </p>
            </div>
            <UButton
              label="Revoke"
              color="error"
              variant="ghost"
              size="sm"
              @click="revoking = token"
            />
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          No tokens yet.
        </p>
      </section>

      <USeparator />

      <section class="space-y-4">
        <header>
          <h2 class="font-semibold">
            Tags
          </h2>
          <p class="text-sm text-muted">
            Create tags from any task. Deleting one removes it from every task.
          </p>
        </header>
        <ul
          v-if="tags.length"
          class="flex flex-wrap gap-2"
        >
          <li
            v-for="tag in tags"
            :key="tag.id"
            class="flex items-center gap-0.5 rounded-md border border-default py-0.5 pr-0.5 pl-1"
          >
            <TagBadge :tag="tag" />
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              :aria-label="`Delete tag ${tag.name}`"
              @click="deleteTag(tag)"
            />
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          No tags yet.
        </p>
      </section>

      <USeparator />

      <section class="space-y-3 rounded-lg border border-error/40 p-4">
        <h2 class="font-semibold text-error">
          {{ user?.isDemo ? 'End the demo' : 'Delete your account' }}
        </h2>
        <p class="text-sm text-muted">
          {{ user?.isDemo
            ? 'Deletes this demo workspace now instead of when it expires. You can start a fresh one any time.'
            : 'Deletes your account with every project, task, session and token. This can’t be undone.' }}
        </p>
        <UButton
          :label="user?.isDemo ? 'End the demo now' : 'Delete my account'"
          color="error"
          variant="outline"
          @click="deletingAccount = true"
        />
      </section>
    </div>

    <UModal
      :open="creatingToken"
      :title="newSecret ? 'Copy your token' : 'New API token'"
      :description="newSecret ? 'This is the only time it’s shown. Store it somewhere safe.' : 'Name it after where it will be used.'"
      @update:open="(open) => { if (!open) closeTokenModal() }"
    >
      <template #body>
        <div
          v-if="newSecret"
          class="space-y-3"
        >
          <UInput
            :model-value="newSecret"
            readonly
            class="w-full font-mono"
            aria-label="Your new token"
            @focus="(event: FocusEvent) => (event.target as HTMLInputElement).select()"
          />
          <p class="text-sm text-muted">
            Use it as <code class="rounded bg-elevated px-1">Authorization: Bearer &lt;token&gt;</code>.
          </p>
        </div>
        <form
          v-else
          id="token-form"
          @submit.prevent="createToken"
        >
          <UFormField
            label="Name"
            name="name"
          >
            <UInput
              v-model="tokenName"
              placeholder="CI script"
              class="w-full"
              :maxlength="60"
              autofocus
              required
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <template v-if="newSecret">
            <UButton
              label="Copy"
              icon="i-lucide-clipboard"
              color="neutral"
              variant="outline"
              @click="copySecret"
            />
            <UButton
              label="Done"
              @click="closeTokenModal"
            />
          </template>
          <template v-else>
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="closeTokenModal"
            />
            <UButton
              type="submit"
              form="token-form"
              label="Create token"
              :loading="tokenBusy"
              :disabled="!tokenName.trim()"
            />
          </template>
        </div>
      </template>
    </UModal>

    <ConfirmDialog
      v-model:open="revokeOpen"
      title="Revoke this token?"
      :description="`Anything using “${revoking?.name}” will stop working straight away.`"
      confirm-label="Revoke token"
      :confirm="revoke"
    />
    <ConfirmDialog
      v-model:open="deletingAccount"
      :title="user?.isDemo ? 'End the demo now?' : 'Delete your account?'"
      description="Everything in this workspace is deleted for good."
      :confirm-label="user?.isDemo ? 'End the demo' : 'Delete my account'"
      :confirm="deleteAccount"
    />
  </AppPage>
</template>
