# Orchard

Orchard is an experimental Obsidian plug‑in that fetches video data from YouTube and provides helper commands for working with notes.

## Installing dependencies

This project uses [Bun](https://bun.sh) and [mise](https://mise.jdx.dev/) for development tasks.

```bash
bun install
# or, if you use mise
mise install
```

## Building the plug‑in

A Bun build script compiles `src/plugin.ts` to `./dist`. The `build` script from `package.json` runs:

```bash
bun --bun run build.ts
```

You can also run the `mise` task named `build` (alias `b`) which compiles and then copies the output to the directory set in `OUTPUT_DIR` inside `.env.json`:

```bash
mise run build
```

The compiled files `dist/main.js` and `dist/main.css` are copied to `${OUTPUT_DIR}/main.js` and `${OUTPUT_DIR}/styles.css`.

## Usage notes

After loading the plug‑in, open the settings tab named **Orchard** and enter your Google API key so the plug‑in can fetch video details.  Commands such as **Add video note** and **Insert latex snippet** are then available from the command palette or the ribbon icon.

Generated notes from YouTube metadata are created in your vault under `500Videos`.
