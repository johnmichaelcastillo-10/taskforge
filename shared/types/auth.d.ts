// What the encrypted session cookie carries. The server still loads the account from the
// database on every protected request; this is only enough to render the app shell.
declare module '#auth-utils' {
  interface User {
    id: number
    name: string
    email: string | null
    isDemo: boolean
    /** Milliseconds since the epoch; null for regular accounts. */
    demoExpiresAt: number | null
  }

  interface UserSession {
    loggedInAt: number
  }
}

export {}
