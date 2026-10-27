// Taskforge: project management and time tracking. Plan: docs/SPEC.md.

// File events don't cross from a Windows folder into a Linux container, so the Docker dev
// service polls (WATCH_POLLING=true in compose.yaml). Nuxt, Vite and Nitro each watch files.
const usePolling = process.env.WATCH_POLLING === 'true'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils', 'nuxt-security'],

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
    // Gzip and Brotli copies of the static files, made at build time and served to browsers
    // that accept them (the Node server doesn't compress on the fly; Vercel's CDN does).
    compressPublicAssets: { gzip: true, brotli: true },
  },

  vite: {
    server: {
      watch: { usePolling },
    },
  },

  eslint: {
    config: { stylistic: true },
  },

  // Security headers and a strict Content Security Policy: scripts run only with this
  // response's nonce (or are loaded by one), and nothing loads from other origins.
  security: {
    headers: {
      contentSecurityPolicy: {
        'default-src': ['\'self\''],
        // 'https:' and 'unsafe-inline' are ignored by browsers that understand nonces and
        // 'strict-dynamic'; they're the fallback for those that don't.
        'script-src': ['\'self\'', 'https:', '\'unsafe-inline\'', '\'strict-dynamic\'', '\'nonce-{{nonce}}\''],
        'script-src-attr': ['\'none\''],
        // Vue and Nuxt UI set inline style attributes (transitions, positioning).
        'style-src': ['\'self\'', '\'unsafe-inline\''],
        'img-src': ['\'self\'', 'data:'],
        'font-src': ['\'self\'', 'data:'],
        'connect-src': ['\'self\''],
        'object-src': ['\'none\''],
        'base-uri': ['\'none\''],
        'form-action': ['\'self\''],
        'frame-ancestors': ['\'none\''],
        // Off: it would break the local http:// Docker app. Hosting forces HTTPS anyway.
        'upgrade-insecure-requests': false,
      },
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
    },
    // Rate limits live in the database (server/utils/rate-limit.ts); the built-in one keeps
    // counts in memory, which serverless instances don't share.
    rateLimiter: false,
    // Input is validated with Zod and Vue escapes output; this filter would reject ordinary
    // text such as "<b>" in a task description.
    xssValidator: false,
    // Same-origin only: the app calls its own API, and API clients aren't browsers.
    corsHandler: false,
  },
})
