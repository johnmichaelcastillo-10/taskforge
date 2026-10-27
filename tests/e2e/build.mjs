// The production build the end-to-end tests run, in .nuxt/test-build. Run by global-setup.ts in
// its own Node process: Nuxt's build doesn't work inside Vitest's module runner.
import { fileURLToPath } from 'node:url'
import { buildNuxt, loadNuxt } from 'nuxt/kit'

const rootDir = fileURLToPath(new URL('../..', import.meta.url))
const buildDir = fileURLToPath(new URL('../../.nuxt/test-build', import.meta.url))

const nuxt = await loadNuxt({
  cwd: rootDir,
  dev: false,
  overrides: { buildDir, nitro: { output: { dir: `${buildDir}/output` } } },
})
try {
  await buildNuxt(nuxt)
}
finally {
  await nuxt.close()
}
