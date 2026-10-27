// The session lives in a cookie, so it can outlast its account: a demo is deleted when it
// expires, whatever cookies are still around. Whenever the app loads the session (server
// rendering, useUserSession().fetch()), check the account and sign out if it's gone.
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (session.user && !await findActiveAccount(session.user.id)) {
      await clearUserSession(event)
      delete session.user
    }
  })
})
