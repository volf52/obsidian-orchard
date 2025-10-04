import { Plugin } from "obsidian"
import { McpServer } from "./mcp-server"

interface McpSettings {
  enabled: boolean
}

const DEFAULT_SETTINGS: McpSettings = { enabled: true }

export default class OrchardMcpPlugin extends Plugin {
  settings!: McpSettings
  mcp: McpServer | null = null

  override async onload() {
    console.log("Orchard MCP Plugin loading...")
    await this.loadSettings()

    if (this.settings.enabled) {
      this.mcp = new McpServer()
      await this.mcp.start()
    }

    this.addCommand({
      id: "orchard-mcp-restart",
      name: "Restart MCP Server",
      callback: async () => {
        if (this.mcp) await this.mcp.stop()
        this.mcp = new McpServer()
        await this.mcp.start()
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
        } else {
          this.mcp = new McpServer()
          await this.mcp.start()
          this.settings.enabled = true
        }
        await this.saveSettings()
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
}
