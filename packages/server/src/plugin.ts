import { Notice, Plugin } from "obsidian"
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
      id: "orchard-server-regenerate-apikey",
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

    this.addCommand({
      id: "orchard-server-show-apikey",
      name: "Show Server API Key",
      callback: () => {
        new Notice(`Server API Key: ${this.settings.apiKey}`)
        console.log("Current Server API Key:", this.settings.apiKey)

        // COpy to clipboard
        navigator.clipboard
          .writeText(this.settings.apiKey)
          .then(() => {
            new Notice("API Key copied to clipboard!")
          })
          .catch((err) => {
            console.error("Failed to copy API Key:", err)
            new Notice("Failed to copy API Key")
          })
      },
    })

    console.log(
      "Orchard Server Plugin loaded with API Key:",
      this.settings.apiKey,
    )
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
