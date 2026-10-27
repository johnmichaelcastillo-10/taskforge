import { fileURLToPath } from 'node:url'

export const rootDir = fileURLToPath(new URL('../..', import.meta.url))

// Where build.mjs puts the server the end-to-end tests run.
export const testOutputDir = fileURLToPath(new URL('../../.nuxt/test-build/output', import.meta.url))
