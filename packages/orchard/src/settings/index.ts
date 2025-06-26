import { type App, PluginSettingTab } from "obsidian"
import { mount, unmount } from "svelte"
import SettingsPage from "@/components/SettingsPage.svelte"
import { notifyErr, notifySuccess } from "@/notify"
import type Orchard from "@/plugin"
import type { OrchardSettings } from "./types"

export const DEFAULT_SETTINGS: OrchardSettings = {
  googleApiKey: "",
  videoNoteFolder: "",
}

class OrchardSettingsTab extends PluginSettingTab {
  plugin: Orchard
  #onDestroy: (() => void) | null = null

  constructor(app: App, plugin: Orchard) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    const settingsPage = mount(SettingsPage, {
      target: containerEl,
      props: {
        heading: "Video and Book data",
        initialSettings: this.plugin.settings,
        dropdownItems: this.app.vault
          .getAllFolders(false)
          .map((folder) => ({ label: folder.path, value: folder.path })),
        onSubmit: (newSettings: OrchardSettings) => {
          this.plugin.settings = newSettings
          this.plugin
            .saveSettings()
            .then(() => {
              notifySuccess("Updated orchard settings")
            })
            .catch((_err) => {
              notifyErr("Unable to save settings")
            })
        },
      },
    })

    this.#onDestroy = () => {
      unmount(settingsPage).then(() => {
        console.log("Bye bye")
      })
    }
  }

  override hide() {
    this.#onDestroy?.()
    this.#onDestroy = null
  }
}

export default OrchardSettingsTab
