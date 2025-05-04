import { defineConfig } from "@rsbuild/core";
import builtins from "builtin-modules";
import { pluginSvelte } from "@rsbuild/plugin-svelte";

export default defineConfig({
  plugins: [
    pluginSvelte({
      // svelteLoaderOptions: { compilerOptions: { css: "injected" } },
    }),
  ],
  source: {
    entry: {
      main: {
        html: false,
        import: "./src/plugin.ts",
        filename: "main.js",
        library: { type: "umd" },
      },
    },
    assetsInclude: ["./styles.css", "./manifest.json"],
  },
  resolve: {
    extensions: [".ts", ".svelte", ".js"],
  },
  output: {
    minify: false,
    inlineStyles: false,
    injectStyles: true,
    target: "web",
    // target: "node",
    externals: [
      { obsidian: "commonjs2 obsidian" },
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
  },
  performance: { chunkSplit: { strategy: "all-in-one" } },
});
