import { MarkdownView, Notice, Plugin } from "obsidian";
import { ICON, ORCHAR_RSB_VIEW_TYPE } from "./constants";
import AppEventTarget from "./events";
import OrchardModal from "./latex/modal";
import RightSidebarView from "./right-sidebar-view";
import OrchardSettingsTab, {
  DEFAULT_SETTINGS,
  type OrchardSettings,
} from "./settings";
import { YtInputModal } from "./yt";
import YtServ from "./yt/service";
import "../styles.css";

class Orchard extends Plugin {
  settings: OrchardSettings;
  ytServ: YtServ;
  et = new AppEventTarget();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.ytServ = new YtServ(this.settings.googleApiKey, this);

    this.addRibbonIcon(ICON, "Open Orchard", (_evt) => {
      this.activateView();
    });

    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Orchard");

    this.addSettingTab(new OrchardSettingsTab(this.app, this));
    await this.registerCommands();

    this.registerView(ORCHAR_RSB_VIEW_TYPE, (leaf) => {
      return new RightSidebarView(leaf, this);
    });
  }

  private async registerCommands() {
    this.addCommand({
      id: "orchard-picker",
      name: "Insert latex snippet",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (view) {
          if (!checking) {
            new OrchardModal(this.app).open();
          }

          return true;
        }

        return false;
      },
    });

    this.addCommand({
      id: "orchard-open",
      name: "Open",
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: "orchard-recenter",
      name: "Recenter",
      callback: () => {
        this.centerView();
      },
    });

    this.addCommand({
      id: "orchard-add-video",
      name: "Add video note",
      callback: () => {
        this.addVideo();
      },
    });
  }

  onunload() {
    this.et.clear();
  }

  private async loadSettings() {
    const loadedSettings = await this.loadData();

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
    };
    // this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const leaf = await RightSidebarView.getOrCreateLeaf(this.app);
    await this.app.workspace.revealLeaf(leaf);
  }

  private centerView() {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) return editor;

    editor.scrollIntoView(
      {
        from: editor.getCursor("from"),
        to: editor.getCursor("to"),
      },
      true,
    );
  }

  private addVideo() {
    new YtInputModal(this.app, (videoId) => {
      this.ytServ.fetchVideoDetails(videoId);
    }).open();
  }

  settingsUpdated() {
    this.et.notifySettingUpdate(this.settings);
  }
}

export default Orchard;
