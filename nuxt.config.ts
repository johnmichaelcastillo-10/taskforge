// Taskforge: project management and time tracking. Plan: docs/SPEC.md.

// File events don't cross from a Windows folder into a Linux container, so the Docker dev
// service polls (WATCH_POLLING=true in compose.yaml). Nuxt, Vite and Nitro each watch files.
const usePolling = process.env.WATCH_POLLING === 'true'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint'],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // Overridden by NUXT_DATABASE_URL / NUXT_DATABASE_AUTH_TOKEN. A file: URL is a local SQLite
  // file (development, Docker, tests); libsql:// is Turso in production.
  runtimeConfig: {
    databaseUrl: 'file:./data/taskforge.db',
    databaseAuthToken: '',
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
