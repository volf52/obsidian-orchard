import builtins from 'builtin-modules'
import { defineConfig } from 'bunup'
import { sveltePlugin } from '@internal/build-plugins/svelte'

const cfg = defineConfig({
  name: '@orchard/plugin',
  entry: './src/plugin.ts',
  target: 'browser',
  format: 'cjs',
  sourcemap: 'linked',
  minify: true,
  dts: false,
  plugins: [sveltePlugin],
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
})

export default cfg
