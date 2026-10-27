import { execFileSync } from 'node:child_process'
import { rootDir } from './paths'

// One production build for every end-to-end file. Building per file (what @nuxt/test-utils does
// by default) takes minutes each on a Windows folder mounted into Docker.
export default function buildForTests() {
  execFileSync(process.execPath, ['tests/e2e/build.mjs'], { cwd: rootDir, stdio: 'inherit' })
}
