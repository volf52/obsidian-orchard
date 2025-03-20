import { defineConfig } from "@rsbuild/core";
import builtins from "builtin-modules";
import { pluginSvelte } from "@rsbuild/plugin-svelte";

export default defineConfig({
  plugins: [pluginSvelte()],
  source: {
    entry: {
      main: "./src/plugin.ts",
    },
    assetsInclude: ["./styles.css", "./manifest.json"],
  },
  resolve: {
    extensions: [".ts"],
  },
  output: {
    injectStyles: true,
    target: "web",
    // target: "node",
    externals: [
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
    // manifest: {
    //   generate: ({ files, manifestData }) => ({
    //     manifest_version: 2,
    //     version: manifestData.
    //   }),
    // },
  },
});
