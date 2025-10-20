import type { BunPlugin } from "bun"

export const sveltePlugin: BunPlugin = {
  name: "svelte-transformer",

  setup: async (build) => {
    const { compile } = await import("svelte/compiler")

    const cssOutput: string[] = []
    let totalTime = 0

    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const file = await Bun.file(path).text()

      const start = performance.now()
      const compiled = compile(file, {
        filename: path,
        generate: "client",
        css: "external",
      })
      const end = performance.now()

      if (compiled.css) {
        cssOutput.push(compiled.css.code)
      }

      totalTime += end - start

      return { loader: "js", contents: compiled.js.code }
    })

    build.onLoad({ filter: /svelte\.css$/ }, async ({ defer }) => {
      await defer()

      if (cssOutput.length > 0) {
        const contents = cssOutput.join("\n")

        return { loader: "css", contents }
      }
    })

    build.onEnd(() => {
      console.debug(`[Svelte] Total Compilation Time: ${totalTime}`)
    })
  },
}
