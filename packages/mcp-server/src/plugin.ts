import { createEventBus, createMemoryAdapter, NoteService } from "@orchard/core"
import { Notice, Plugin, TFile, type Vault } from "obsidian"
import { McpServer } from "./mcp-server"

/**
 * Creates a NoteService-compatible adapter that maps Obsidian vault file operations to MCP storage operations.
 *
 * @param vault - The Obsidian Vault instance used for file access and modification.
 * @returns An object with the following methods:
 *  - `readFile(id)` — Returns the file contents for the given path or `null` if no Markdown file is found.
 *  - `writeFile(id, data)` — Creates a new Markdown file at `id` or replaces the contents of an existing file.
 *  - `fileInfo(id)` — Returns `{ id, mtime, size }` for the file at `id`, or `null` if not found or not a Markdown file.
 *  - `list()` — Returns an array of `{ id, mtime, size }` for all Markdown files in the vault.
 *  - `deleteFile(id)` — Deletes the file at `id` and returns `true` on success, or `false` if the file was not found.
 */
function createObsidianVaultAdapter(vault: Vault) {
  function normalize(id: string): string {
    let n = id.trim()
    if (!n.endsWith(".md")) n = `${n}.md`
    n = n.replace(/\\+/g, "/").toLowerCase()
    return n
  }
  return {
    async readFile(id: string) {
      const file = vault.getAbstractFileByPath(id)
      if (file instanceof TFile && file.extension === "md")
        return vault.read(file)
      const t = vault.getAbstractFileByPath(normalize(id))
      if (t instanceof TFile) return vault.read(t)
      return null
    },
    async writeFile(id: string, data: string) {
      const existing = vault.getAbstractFileByPath(id)
      if (existing instanceof TFile) {
        await vault.modify(existing, data)
        return
      }
      await vault.create(id, data)
    },
    async fileInfo(id: string) {
      const file = vault.getAbstractFileByPath(id)
      if (!(file instanceof TFile)) return null
      return { id, mtime: file.stat.mtime, size: file.stat.size }
    },
    async list() {
      return vault
        .getFiles()
        .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
        .map((f) => ({ id: f.path, mtime: f.stat.mtime, size: f.stat.size }))
    },
    async deleteFile(id: string) {
      const file = vault.getAbstractFileByPath(id)
      if (!(file instanceof TFile)) return false
      await vault.delete(file)
      return true
    },
  }
}

interface McpSettings {
  enabled: boolean
  apiKey: string
  storage: "vault" | "memory"
}

const DEFAULT_SETTINGS: McpSettings = {
  enabled: true,
  apiKey: "",
  storage: "vault",
}

export default class OrchardMcpPlugin extends Plugin {
  settings!: McpSettings
  mcp: McpServer | null = null

  override async onload() {
    console.log("Orchard MCP Plugin (standalone) loading...")
    await this.loadSettings()

    if (this.settings.enabled) {
      await this.startServer()
    }

    this.addCommand({
      id: "orchard-mcp-restart",
      name: "Restart MCP Server",
      callback: async () => {
        await this.restartServer()
      },
    })

    this.addCommand({
      id: "orchard-mcp-toggle",
      name: "Toggle MCP Server",
      callback: async () => {
        if (this.mcp) {
          await this.stopServer()
          this.settings.enabled = false
          console.log("[MCP] Disabled")
        } else {
          this.settings.enabled = true
          await this.startServer()
          console.log("[MCP] Enabled")
        }
        await this.saveSettings()
      },
    })

    this.addCommand({
      id: "orchard-mcp-show-key",
      name: "Show MCP API Key",
      callback: async () => {
        if (!this.settings.apiKey) {
          this.settings.apiKey = this.generateKey()
          await this.saveSettings()
        }
        const tail = this.settings.apiKey.slice(-6)
        new Notice(`MCP API Key: ${this.settings.apiKey}`)
        console.log(`[MCP] API key shown to user ***${tail}`)
        const clipboard =
          typeof navigator !== "undefined" ? navigator.clipboard : undefined
        await clipboard?.writeText?.(this.settings.apiKey)
        new Notice("MCP API Key copied to clipboard")
      },
    })

    this.addCommand({
      id: "orchard-mcp-regenerate-key",
      name: "Regenerate MCP API Key",
      callback: async () => {
        this.settings.apiKey = this.generateKey()
        await this.saveSettings()
        const tail = this.settings.apiKey.slice(-6)
        new Notice("MCP API Key regenerated")
        console.log(`[MCP] API key regenerated ***${tail}`)
        await this.restartServer()
      },
    })
  }

  override async onunload() {
    await this.stopServer()
  }

  private async startServer() {
    if (!this.settings.apiKey) {
      this.settings.apiKey = this.generateKey()
      await this.saveSettings()
      console.log(
        `[MCP] Generated new API key ***${this.settings.apiKey.slice(-6)}`,
      )
    }

    const events = createEventBus()
    const adapter =
      this.settings.storage === "vault"
        ? createObsidianVaultAdapter(this.app.vault)
        : createMemoryAdapter()
    const noteService = new NoteService({ adapter, events })

    this.mcp = new McpServer({ noteService, apiKey: this.settings.apiKey })
    await this.mcp.start()
    console.log(`[MCP] Server started (storage=${this.settings.storage})`)
  }

  private async stopServer() {
    if (this.mcp) {
      await this.mcp.stop()
      this.mcp = null
    }
  }

  private async restartServer() {
    await this.stopServer()
    await this.startServer()
    console.log("[MCP] Restart complete")
  }

  private async loadSettings() {
    const saved = await this.loadData()
    this.settings = { ...DEFAULT_SETTINGS, ...saved }
  }

  private async saveSettings() {
    await this.saveData(this.settings)
  }

  private generateKey(): string {
    const arr = new Uint8Array(24)
    type RandomSource = { getRandomValues?: (data: Uint8Array) => Uint8Array }
    const cryptoObj =
      typeof globalThis !== "undefined" && "crypto" in globalThis
        ? ((globalThis as { crypto?: RandomSource }).crypto ?? null)
        : null
    if (cryptoObj?.getRandomValues) {
      cryptoObj.getRandomValues(arr)
    } else {
      for (let i = 0; i < arr.length; i++)
        arr[i] = Math.floor(Math.random() * 256)
    }
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }
}