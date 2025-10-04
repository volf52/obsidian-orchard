import builtins from "builtin-modules"
import type { BunPlugin } from "bun"
import { sveltePlugin } from "./svelte-plugin"

// Alias @orchard/core to source (avoid needing prebuilt dist or version bumps)
const coreAliasPlugin: BunPlugin = {
  name: "core-alias",
  setup(build) {
    build.onResolve({ filter: /^@orchard\/core$/ }, () => ({
      path: new URL("../orchard-core/src/index.ts", import.meta.url).pathname,
    }))
  },
}

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
  plugins: [coreAliasPlugin, sveltePlugin],
})
