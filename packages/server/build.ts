import builtins from 'builtin-modules'
import { build } from 'bun'
import { coreAliasPlugin } from '../orchard-core/build-utils/core-alias-plugin'

await build({
  entrypoints: ['./src/plugin.ts'],
  outdir: './dist',
  naming: { entry: '[dir]/main.[ext]' },
  target: 'node',
  format: 'cjs',
  splitting: true,
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
