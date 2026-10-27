// Sign-in and sign-up pages: someone already signed in goes straight to the app.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (loggedIn.value) {
    return navigateTo('/dashboard')
  }
})
