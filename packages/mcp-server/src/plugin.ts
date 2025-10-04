import { Plugin, Notice } from "obsidian"
import { McpServer } from "./mcp-server"

// @ts-ignore ambient for Obsidian environment
declare const window: any;

interface McpSettings {
  enabled: boolean
  apiKey: string
}

const DEFAULT_SETTINGS: McpSettings = { enabled: true, apiKey: "" }

export default class OrchardMcpPlugin extends Plugin {
  settings!: McpSettings
  mcp: McpServer | null = null

  override async onload() {
    console.log("Orchard MCP Plugin loading...")
    await this.loadSettings()

    if (this.settings.enabled) {
      if (!this.settings.apiKey) {
        this.settings.apiKey = this.generateKey()
        await this.saveSettings()
        console.log(`[MCP] Generated new API key ***${this.settings.apiKey.slice(-6)}`)
      }
      console.log("[MCP] Starting HTTP/SSE server (no stdio)...")
      const { noteService, events } = this.extractNoteInfra()
      this.mcp = new McpServer({ noteService: noteService ?? undefined, apiKey: this.settings.apiKey })
      await this.mcp.start()
      if (events && this.mcp) {
        events.subscribe((evt: any) => {
          if (!this.mcp) return
          if (evt.type === "note.created") this.mcp.broadcast("note.created", { id: evt.note.id, version: evt.note.version })
          else if (evt.type === "note.updated") this.mcp.broadcast("note.updated", { id: evt.note.id, version: evt.note.version, previousVersion: evt.previousVersion })
          else if (evt.type === "note.deleted") this.mcp.broadcast("note.deleted", { id: evt.id, previousVersion: evt.previousVersion })
        })
      }
    }

    this.addCommand({
      id: "orchard-mcp-restart",
      name: "Restart MCP Server",
      callback: async () => {
        if (this.mcp) await this.mcp.stop()
        console.log("[MCP] Restarting...")
        const { noteService, events } = this.extractNoteInfra()
        this.mcp = new McpServer({ noteService: noteService ?? undefined, apiKey: this.settings.apiKey || undefined })
        await this.mcp.start()
        if (events && this.mcp) {
          events.subscribe((evt: any) => {
            if (!this.mcp) return
            if (evt.type === "note.created") this.mcp.broadcast("note.created", { id: evt.note.id, version: evt.note.version })
            else if (evt.type === "note.updated") this.mcp.broadcast("note.updated", { id: evt.note.id, version: evt.note.version, previousVersion: evt.previousVersion })
            else if (evt.type === "note.deleted") this.mcp.broadcast("note.deleted", { id: evt.id, previousVersion: evt.previousVersion })
          })
        }
        console.log("[MCP] Restart complete")
      },
    })

    this.addCommand({
      id: "orchard-mcp-toggle",
      name: "Toggle MCP Server",
      callback: async () => {
        if (this.mcp) {
          await this.mcp.stop()
          this.mcp = null
          this.settings.enabled = false
          console.log("[MCP] Disabled")
        } else {
          const { noteService, events } = this.extractNoteInfra()
          if (!this.settings.apiKey) {
            this.settings.apiKey = this.generateKey()
            await this.saveSettings()
            console.log(`[MCP] Generated new API key ***${this.settings.apiKey.slice(-6)}`)
          }
          this.mcp = new McpServer({ noteService: noteService ?? undefined, apiKey: this.settings.apiKey })
          await this.mcp.start()
          if (events && this.mcp) {
            events.subscribe((evt: any) => {
              if (!this.mcp) return
              if (evt.type === "note.created") this.mcp.broadcast("note.created", { id: evt.note.id, version: evt.note.version })
              else if (evt.type === "note.updated") this.mcp.broadcast("note.updated", { id: evt.note.id, version: evt.note.version, previousVersion: evt.previousVersion })
              else if (evt.type === "note.deleted") this.mcp.broadcast("note.deleted", { id: evt.id, previousVersion: evt.previousVersion })
            })
          }
          this.settings.enabled = true
          console.log("[MCP] Enabled")
        }
        await this.saveSettings()
      },
    })

    // Show API Key command
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
      },
    })

    // Regenerate API Key
    this.addCommand({
      id: "orchard-mcp-regenerate-key",
      name: "Regenerate MCP API Key",
      callback: async () => {
        this.settings.apiKey = this.generateKey()
        await this.saveSettings()
        const tail = this.settings.apiKey.slice(-6)
        new Notice("MCP API Key regenerated")
        console.log(`[MCP] API key regenerated ***${tail}`)
        if (this.mcp) {
          await this.mcp.stop()
          const { noteService, events } = this.extractNoteInfra()
          this.mcp = new McpServer({ noteService: noteService ?? undefined, apiKey: this.settings.apiKey })
          await this.mcp.start()
          if (events && this.mcp) {
            events.subscribe((evt: any) => {
              if (!this.mcp) return
              if (evt.type === "note.created") this.mcp.broadcast("note.created", { id: evt.note.id, version: evt.note.version })
              else if (evt.type === "note.updated") this.mcp.broadcast("note.updated", { id: evt.note.id, version: evt.note.version, previousVersion: evt.previousVersion })
              else if (evt.type === "note.deleted") this.mcp.broadcast("note.deleted", { id: evt.id, previousVersion: evt.previousVersion })
            })
          }
          console.log("[MCP] Server restarted with new key")
        }
      },
    })

  }

  override async onunload() {
    if (this.mcp) await this.mcp.stop()
  }

  private async loadSettings() {
    const saved = await this.loadData()
    this.settings = { ...DEFAULT_SETTINGS, ...saved }
  }

  private async saveSettings() {
    await this.saveData(this.settings)
  }

  private extractNoteInfra(): { noteService: any | null; events: any | null } {
    try {
      const plugins = (this.app as any).plugins
      if (!plugins?.plugins) return { noteService: null, events: null }
      const orchard = plugins.plugins["orchard-obsidian"]
      if (orchard?.instance?.noteService) {
        return { noteService: orchard.instance.noteService, events: orchard.instance.events ?? null }
      }
    } catch (e) {
      console.warn("[MCP] Failed to extract Note infra", e)
    }
    return { noteService: null, events: null }
  }

  private generateKey(): string {
    const arr = new Uint8Array(24)
    // use browser crypto in Obsidian renderer environment
    ;(window.crypto || (window as any).require?.("crypto")).getRandomValues(arr)
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("")
  }
}
