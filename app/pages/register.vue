<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })
useSeoMeta({ title: 'Create an account' })

const { fetch: refreshSession } = useUserSession()
const { starting, startDemo } = useStartDemo()
const { registrationEnabled } = useRuntimeConfig().public

const form = useTemplateRef('form')
const failure = ref<string>()

const fields: AuthFormField[] = [
  { name: 'name', type: 'text', label: 'Name', autocomplete: 'name', required: true },
  { name: 'email', type: 'email', label: 'Email', autocomplete: 'email', required: true },
  { name: 'password', type: 'password', label: 'Password', autocomplete: 'new-password', required: true, description: 'At least 8 characters.' },
]

async function register({ data }: FormSubmitEvent<RegisterInput>) {
  failure.value = undefined
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: data })
    await refreshSession()
    await navigateTo('/dashboard')
  }
  catch (error) {
    form.value?.formRef?.setErrors(fieldErrors(error))
    failure.value = errorMessage(error)
  }
}
</script>

<template>
  <UContainer class="flex justify-center py-16">
    <UPageCard class="w-full max-w-sm">
      <UAuthForm
        v-if="registrationEnabled"
        ref="form"
        title="Create an account"
        icon="i-lucide-user-plus"
        :fields="fields"
        :schema="registerSchema"
        :submit="{ label: 'Create account', block: true }"
        @submit="register"
      >
        <template #description>
          Already have one?
          <ULink
            to="/login"
            class="font-medium text-primary"
          >Sign in</ULink>.
        </template>

        <template #validation>
          <UAlert
            v-if="failure"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="failure"
          />
        </template>
      </UAuthForm>

      <UEmpty
        v-else
        icon="i-lucide-door-closed"
        title="Registration is closed"
        description="This copy of Taskforge doesn't take new accounts. The demo has everything, in a private workspace of your own."
        variant="naked"
      >
        <template #actions>
          <UButton
            label="Try the demo"
            :loading="starting"
            @click="startDemo"
          />
        </template>
      </UEmpty>
    </UPageCard>
  </UContainer>
</template>
