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

    new Setting(containerEl).setName("Latex Snippets").setHeading();

    new Setting(containerEl).setName("Video and Book Data").setHeading();

    new Setting(containerEl)
      .setName("Google API Key")
      .setDesc("For fetching video and book data")
      .setTooltip("AI....")
      .addText((txt) =>
        txt.onChange((key) => {
          this.plugin.settings.googleApiKey = key;
          this.plugin.settingsUpdated();
        }),
      );

    new Setting(containerEl)
      .setName("Video Note Folder")
      .addSearch((search) => {});
  }
}

export default OrchardSettingsTab;
