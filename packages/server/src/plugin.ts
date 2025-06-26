import { Plugin } from "obsidian"
import { ServerModule } from "./server-module"

interface ServerSettings {
  apiKey: string
}

const DEFAULT_SETTINGS: ServerSettings = {
  apiKey: "",
}

export default class OrchardServerPlugin extends Plugin {
  settings!: ServerSettings
  serverModule: ServerModule | null = null

  override async onload() {
    console.log("Orchard Server Plugin loading...")
    await this.loadSettings()

    // Generate API key if none exists
    if (!this.settings.apiKey) {
      this.settings.apiKey = ServerModule.generateApiKey()
      await this.saveSettings()
    }

    // Initialize and start server
    this.serverModule = new ServerModule(this.settings.apiKey)
    await this.serverModule.start()

    // Add command to regenerate API key
    this.addCommand({
      id: "regenerate-api-key",
      name: "Regenerate Server API Key",
      callback: async () => {
        this.settings.apiKey = ServerModule.generateApiKey()
        await this.saveSettings()

        // Restart server with new key
        if (this.serverModule) {
          await this.serverModule.stop()
          this.serverModule = new ServerModule(this.settings.apiKey)
          await this.serverModule.start()
        }
      },
    })

    console.log("Orchard Server Plugin loaded with API Key:", this.settings.apiKey)
  }

  override async onunload() {
    if (this.serverModule) {
      await this.serverModule.stop()
    }
  }

  async loadSettings() {
    const savedSettings = await this.loadData()
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
    }
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
