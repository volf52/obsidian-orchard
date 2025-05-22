import { type App, PluginSettingTab, Setting } from "obsidian";
import type Orchard from "./plugin";

export interface OrchardSettings {
  googleApiKey: string;
}

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
    const currentSettings = this.plugin.settings;

    new Setting(containerEl).setName("Latex Snippets").setHeading();

    new Setting(containerEl).setName("Video and Book Data").setHeading();

    new Setting(containerEl)
      .setName("Google API Key")
      .setDesc("For fetching video and book data")
      .setTooltip("AI....")
      .addText((txt) =>
        txt.setValue(currentSettings.googleApiKey).onChange((key) => {
          this.plugin.settings.googleApiKey = key;
          this.plugin.settingsUpdated();
        }),
      );

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

    new Setting(containerEl).addButton((b) => {
      b.buttonEl.style.width = "100%";
      b.setButtonText("Save Settings").onClick(() => {
        this.plugin.saveSettings();
      });
    });
  }
}

export default OrchardSettingsTab;
