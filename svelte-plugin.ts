import type { BunPlugin } from "bun";

export const sveltePlugin: BunPlugin = {
  name: "svelte-loader",
  async setup(build) {
    const { compile } = await import("svelte/compiler");
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      // console.debug("Loading Svelte file:", path);
      const file = await Bun.file(path).text();
      const contents = compile(file, {
        filename: path,
        generate: "client",
      }).js.code;
      return { contents, loader: "js" };
    });
  },
};
