import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The end-to-end tests build and boot the app once per file, which takes a while.
    hookTimeout: 300_000,
    testTimeout: 60_000,
  },
})
