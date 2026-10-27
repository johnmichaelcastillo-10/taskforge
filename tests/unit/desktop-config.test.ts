import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// desktop/scripts/configure.mjs points the desktop build at a site.
const script = fileURLToPath(new URL('../../desktop/scripts/configure.mjs', import.meta.url))
const tauriDir = fileURLToPath(new URL('../../desktop/src-tauri/', import.meta.url))

function configure(env: Record<string, string | undefined>) {
  const { CI: _ci, TASKFORGE_URL: _url, ...base } = process.env
  return spawnSync(process.execPath, [script], { env: { ...base, ...env }, encoding: 'utf8' })
}

describe('desktop configure script', () => {
  it('points the window and the IPC permission at the site’s origin', () => {
    const result = configure({ TASKFORGE_URL: 'https://taskforge.example.com/some/path' })
    expect(result.status).toBe(0)
    const site = JSON.parse(readFileSync(`${tauriDir}tauri.site.conf.json`, 'utf8'))
    expect(site.build.frontendDist).toBe('https://taskforge.example.com')
    const capability = JSON.parse(readFileSync(`${tauriDir}capabilities/site.json`, 'utf8'))
    expect(capability.remote.urls).toEqual(['https://taskforge.example.com/*'])
    expect(capability.windows).toEqual(['main'])
  })

  it('accepts plain http only for localhost', () => {
    expect(configure({ TASKFORGE_URL: 'http://localhost:8094' }).status).toBe(0)
    const insecure = configure({ TASKFORGE_URL: 'http://taskforge.example.com' })
    expect(insecure.status).toBe(1)
    expect(insecure.stderr).toContain('must use https')
  })

  it('requires a URL in CI', () => {
    const result = configure({ CI: 'true' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('TASKFORGE_URL')
  })
})
