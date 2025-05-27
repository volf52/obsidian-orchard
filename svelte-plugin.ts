import type { BunPlugin } from "bun"

export const sveltePlugin: BunPlugin = {
  name: "svelte-loader",
  async setup(build) {
    const { compile } = await import("svelte/compiler")

    let cssOutput: string = ""

    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      // console.debug("Loading Svelte file:", path)
      const file = await Bun.file(path).text()
      const compiled = compile(file, {
        filename: path,
        generate: "client",
        css: "external",
      })

      if (compiled.css) {
        // console.debug("Svelte CSS found", compiled.css.code)
        cssOutput += compiled.css.code
      }

      return { loader: "js", contents: compiled.js.code }
    })

    build.onLoad({ filter: /svelte\.css$/ }, async ({ defer, path }) => {
      await defer()
      // console.debug("Loading Svelte CSS file:", path)

      if (cssOutput) {
        return { loader: "css", contents: cssOutput }
      }
    })
  },
}
