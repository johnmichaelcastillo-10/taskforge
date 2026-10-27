<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })
useSeoMeta({ title: 'Sign in' })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const { starting, startDemo } = useStartDemo()
const { registrationEnabled } = useRuntimeConfig().public

const form = useTemplateRef('form')
const failure = ref<string>()

const fields: AuthFormField[] = [
  { name: 'email', type: 'email', label: 'Email', autocomplete: 'email', required: true },
  { name: 'password', type: 'password', label: 'Password', autocomplete: 'current-password', required: true },
]

async function signIn({ data }: FormSubmitEvent<LoginInput>) {
  failure.value = undefined
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: data })
    await refreshSession()
    await navigateTo(safeRedirect(route.query.redirect))
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
        ref="form"
        title="Sign in"
        icon="i-lucide-log-in"
        :fields="fields"
        :schema="loginSchema"
        :submit="{ label: 'Sign in', block: true }"
        @submit="signIn"
      >
        <template #description>
          <template v-if="registrationEnabled">
            New here?
            <ULink
              to="/register"
              class="font-medium text-primary"
            >Create an account</ULink>.
          </template>
          <template v-else>
            New accounts are closed here, but anyone can try the demo.
          </template>
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

        <template #footer>
          <UButton
            label="Try the demo instead"
            color="neutral"
            variant="subtle"
            block
            :loading="starting"
            @click="startDemo"
          />
        </template>
      </UAuthForm>
    </UPageCard>
  </UContainer>
</template>
