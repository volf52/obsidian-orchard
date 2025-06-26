import type { Command } from "obsidian"

export type AppModule = {
  registerCommands: () => Promise<Command[]>
}
