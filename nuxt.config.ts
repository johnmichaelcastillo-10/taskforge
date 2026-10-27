// Taskforge: project management and time tracking. Plan: docs/SPEC.md.

// File events don't cross from a Windows folder into a Linux container, so the Docker dev
// service polls (WATCH_POLLING=true in compose.yaml). Nuxt, Vite and Nitro each watch files.
const usePolling = process.env.WATCH_POLLING === 'true'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils'],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // Each value is overridden at runtime by its NUXT_ variable (databaseUrl: NUXT_DATABASE_URL,
  // public.registrationEnabled: NUXT_PUBLIC_REGISTRATION_ENABLED, and so on).
  runtimeConfig: {
    // A file: URL is a local SQLite file (development, Docker, tests); libsql:// is Turso.
    databaseUrl: 'file:./data/taskforge.db',
    databaseAuthToken: '',
    // How long a demo account lives before it's deleted.
    demoTtlHours: 72,
    // Read the client address from X-Forwarded-For (rate limits). Only behind a proxy that sets
    // it, such as Vercel; anywhere else the header could be forged.
    trustProxy: false,
    // Session cookies, encrypted with NUXT_SESSION_PASSWORD (32+ characters, never in the code).
    session: { maxAge: 60 * 60 * 24 * 7, password: '' },
    public: {
      // Sign-up is off unless switched on; the hosted demo uses demo accounts only.
      registrationEnabled: false,
    },
  },

  watchers: {
    chokidar: { usePolling },
  },

  compatibilityDate: '2026-10-01',

  nitro: {
    watchOptions: { usePolling },
  },

  vite: {
    server: {
      watch: { usePolling },
    },
  },

  eslint: {
    config: { stylistic: true },
  },
})
