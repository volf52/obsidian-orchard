import { type App, MarkdownView } from "obsidian";

export const getActiveEditor = (app: App) => {
  return app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null;
};
