// Points the desktop app at a Taskforge site before a build. Writes two generated files:
//
//   src-tauri/tauri.site.conf.json      the URL the window loads (merged with --config)
//   src-tauri/capabilities/site.json    lets that site, and only that site, call the shell
//
//   TASKFORGE_URL=https://taskforge.example.com node scripts/configure.mjs
//
// Without TASKFORGE_URL it uses the local Docker app, http://localhost:8094.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// In CI an installer pointing at localhost would be useless to everyone, so the URL is required.
if (process.env.CI && !process.env.TASKFORGE_URL) {
  console.error('Set TASKFORGE_URL (a repository variable in GitHub Actions) to the site the installers should open.')
  process.exit(1)
}
const siteUrl = new URL(process.env.TASKFORGE_URL || 'http://localhost:8094')
if (siteUrl.protocol !== 'https:' && siteUrl.hostname !== 'localhost') {
  console.error(`TASKFORGE_URL must use https (got ${siteUrl.href}); only localhost may use http.`)
  process.exit(1)
}

const tauriDir = join(dirname(fileURLToPath(import.meta.url)), '../src-tauri')
const origin = siteUrl.origin

writeFileSync(join(tauriDir, 'tauri.site.conf.json'), `${JSON.stringify({ build: { frontendDist: origin } }, null, 2)}\n`)

mkdirSync(join(tauriDir, 'capabilities'), { recursive: true })
writeFileSync(join(tauriDir, 'capabilities/site.json'), `${JSON.stringify({
  $schema: '../gen/schemas/desktop-schema.json',
  identifier: 'site',
  description: 'The Taskforge site in the main window may update the tray, notify and listen for tray events.',
  windows: ['main'],
  remote: { urls: [`${origin}/*`] },
  permissions: ['core:default', 'notification:default'],
}, null, 2)}\n`)

console.log(`Desktop app configured for ${origin}`)
