import builtins from 'builtin-modules'
import { build } from 'bun'
import { rm } from 'node:fs/promises'
import { coreAliasPlugin } from '../orchard-core/build-utils/core-alias-plugin'

// Clean previous output (ignore errors if first run)
try {
  await rm('./dist', { recursive: true, force: true })
} catch {}

await build({
  entrypoints: ['./src/plugin.ts'],
  outdir: './dist',
  naming: { entry: '[dir]/main.[ext]' },
  target: 'node',
  format: 'cjs',
  // Obsidian plugin loader expects a single self-contained CJS file; disable splitting.
  splitting: false,
  sourcemap: 'linked',
  minify: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  plugins: [coreAliasPlugin()],
})

console.log('Server build completed successfully!')
