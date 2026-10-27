/** Starts the visitor's demo workspace (or resumes their current one), then opens the dashboard. */
export function useStartDemo() {
  const { fetch: refreshSession } = useUserSession()
  const toast = useToast()
  const starting = ref(false)

  async function startDemo() {
    starting.value = true
    try {
      await $fetch('/api/auth/demo', { method: 'POST', body: { timezone: browserTimeZone() } })
      await refreshSession()
      await navigateTo('/dashboard')
    }
    catch (error) {
      toast.add({ color: 'error', title: 'Couldn’t start the demo', description: errorMessage(error) })
    }
    finally {
      starting.value = false
    }
  }

  return { starting, startDemo }
}
