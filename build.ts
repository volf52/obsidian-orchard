import { sveltePlugin } from "./svelte-plugin";

Bun.build({
  entrypoints: ["./src/plugin.ts"],
  outdir: "./dist",
  naming: { entry: "[dir]/main.[ext]" },
  target: "browser",
  format: "cjs",
  splitting: false,
  sourcemap: "inline",
  minify: false,
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
  ],
  plugins: [sveltePlugin],
});
