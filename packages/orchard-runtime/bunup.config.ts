import { defineConfig } from "bunup"

export default defineConfig({
  format: "esm",
  clean: true,
  outDir: "dist",
  dts: true,
  entry: "./src/index.ts",
  target: "bun",
})
