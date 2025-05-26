import { MarkdownView, Plugin } from "obsidian"
import { YtInputModal } from "@/services/yt"
import YtServ from "@/services/yt/service"
import { ICON, ORCHAR_RSB_VIEW_TYPE } from "./constants"
import OrchardModal from "./latex/modal"
import RightSidebarView from "./right-sidebar-view"
import OrchardSettingsTab, { DEFAULT_SETTINGS } from "./settings"
import "./styles.css"
import "./components/svelte.css"
import {
  clearAllSettingUpdates,
  notifySettingUpdate,
} from "./events/settings-store"
import { notifySuccess } from "./notify"
import { videoMetaToContent } from "./services/yt/utils"
import type { OrchardSettings } from "./settings/types"
import { cleanTitle } from "./utils"

class Orchard extends Plugin {
  settings!: OrchardSettings
  ytServ!: YtServ

  override async onload(): Promise<void> {
    await this.loadSettings()
    this.ytServ = new YtServ(this.settings.googleApiKey, this)

    this.addRibbonIcon(ICON, "Open Orchard", (_evt) => {
      this.activateView()
    })

    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Orchard");

    this.addSettingTab(new OrchardSettingsTab(this.app, this))
    await this.registerCommands()

    this.registerView(ORCHAR_RSB_VIEW_TYPE, (leaf) => {
      return new RightSidebarView(leaf, this)
    })
  }

  private async registerCommands() {
    this.addCommand({
      id: "orchard-picker",
      name: "Insert latex snippet",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView)

        if (view) {
          if (!checking) {
            new OrchardModal(this.app).open()
          }

          return true
        }

        return false
      },
    })

    this.addCommand({
      id: "orchard-open",
      name: "Open",
      callback: () => {
        this.activateView()
      },
    })

    this.addCommand({
      id: "orchard-recenter",
      name: "Recenter",
      callback: () => {
        this.ytServ.destroy()
        // this.centerView();
      },
    })

    this.addCommand({
      id: "orchard-add-video",
      name: "Add video note",
      callback: () => {
        this.addVideo()
      },
    })
  }

  override onunload() {
    clearAllSettingUpdates()
  }

  private async loadSettings() {
    const loadedSettings = await this.loadData()

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
    }
  }

  async saveSettings() {
    notifySettingUpdate(this.settings)
    await this.saveData(this.settings)
  }

  async activateView() {
    const leaf = await RightSidebarView.getOrCreateLeaf(this.app)
    if (!leaf) return
    await this.app.workspace.revealLeaf(leaf)
  }

  private centerView() {
    const editor = this.app.workspace.activeEditor?.editor
    if (!editor) return editor

    editor.scrollIntoView(
      {
        from: editor.getCursor("from"),
        to: editor.getCursor("to"),
      },
      true,
    )
  }

  private addVideo() {
    new YtInputModal(this.app, async (videoId) => {
      const meta = await this.ytServ.fetchVideoDetails(videoId)
      if (!meta) return

      // const now = moment().format("DD/MM/YYYY HH:mm");
      const now = new Date().toISOString()
      const content = videoMetaToContent(videoId, meta, now)
      const title = cleanTitle(meta.title)
      const file = await this.app.vault.create(
        `/500Videos/${title}.md`,
        content,
      )
      notifySuccess("Video imported")

      const leaf = this.app.workspace.getLeaf("tab")
      await leaf.openFile(file)
    }).open()
  }

  settingsUpdated() {
    return notifySettingUpdate(this.settings)
  }
}

export default Orchard
