import type Orchard from "@/plugin";
import { type App, PluginSettingTab } from "obsidian";
import type { OrchardSettings } from "./types";
import { createCenterBtn, createHeading, createTextSetting } from "./utils";

export const DEFAULT_SETTINGS: OrchardSettings = {
  googleApiKey: "",
};

class OrchardSettingsTab extends PluginSettingTab {
  plugin: Orchard;

  constructor(app: App, plugin: Orchard) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const pluginSettings = this.plugin.settings;

    // new Setting(containerEl).setName("Latex Snippets").setHeading();

    createHeading(containerEl, "Video and Book data");

    createTextSetting({
      containerEl,
      name: "Google API Key",
      description: "For fetching video and book data",
      tooltip: "AI....",
      initialValue: pluginSettings.googleApiKey,
      fullWidth: true,
      onChange: (_txt, value) => {
        pluginSettings.googleApiKey = value;
      },
    });

    // new Setting(containerEl)
    //   .setName("Video Note Folder")
    //   .addDropdown((dropdown) => {
    //     const folders = this.app.vault.getAllFolders(false);
    //
    //     for (const folder of folders) {
    //       dropdown.addOption(folder.path, folder.name);
    //     }
    //     dropdown.onChange((newVal) => {
    //       console.log("Selected folder", newVal);
    //     });
    //   });

    createCenterBtn({
      containerEl,
      cta: true,
      text: "Save Settings",
      onClick: (b, e) => {
        e.preventDefault();

        b.setDisabled(true);
        this.plugin.saveSettings().finally(() => {
          b.setDisabled(false);
        });
      },
    });
  }
}

export default OrchardSettingsTab;
