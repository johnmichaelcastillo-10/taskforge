// Nuxt's generated flat config (with the stylistic rules enabled in nuxt.config.ts).
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  // The desktop shell's build output (Rust target, generated schemas) isn't source.
  ignores: ['desktop/src-tauri/target/**', 'desktop/src-tauri/gen/**'],
})
