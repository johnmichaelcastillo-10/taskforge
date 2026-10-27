import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
          environment: 'node',
          // Builds the app once; each test file then starts its own server and database.
          globalSetup: ['tests/e2e/global-setup.ts'],
          hookTimeout: 120_000,
          testTimeout: 60_000,
        },
      },
    ],
  },
})
