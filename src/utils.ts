import { type App, MarkdownView } from "obsidian"

export const getActiveEditor = (app: App) => {
  return app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null
}

const FILENAME_FORBID_CHARS = /[*\/\\<>:|?"']/g
export const cleanTitle = (title: string) =>
  title.replace(FILENAME_FORBID_CHARS, "_")

export const cleanTag = (tag: string) =>
  tag.replaceAll("&", "_").replaceAll(" ", "-").toLowerCase().trim()
