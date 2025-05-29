import builtins from "builtin-modules"
import { sveltePlugin } from "./svelte-plugin"

// import packageJson from "./package.json"

Bun.build({
  entrypoints: ["./src/plugin.ts"],
  outdir: "./dist",
  naming: { entry: "[dir]/main.[ext]" },
  target: "browser",
  format: "cjs",
  splitting: true,
  sourcemap: "linked",
  minify: true,
  external: [
    "obsidian",
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
  plugins: [sveltePlugin],
})
