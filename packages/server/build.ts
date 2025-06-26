import { build } from 'bun';
import builtins from "builtin-modules"

await build({
  entrypoints: ['./src/plugin.ts'],
  outdir: './dist',
  naming: { entry: '[dir]/main.[ext]' },
  target: 'node',
  format: 'cjs',
  splitting: true,
  sourcemap: "linked",
  minify: true,
  external: ['obsidian',
 "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",

    ...builtins,

  ],
});

console.log('Server build completed successfully!');