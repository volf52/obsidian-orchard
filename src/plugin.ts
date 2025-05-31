import { type Command, Plugin } from "obsidian"
import { ICON, ORCHAR_RSB_VIEW_TYPE } from "@/constants"
import RightSidebarView from "@/right-sidebar-view"
import OrchardSettingsTab, { DEFAULT_SETTINGS } from "@/settings"
import "./styles.css"
import "./components/svelte.css"
import {
  clearAllSettingUpdates,
  notifySettingUpdate,
} from "@/events/settings-store"
import VideoModule from "@/modules/video.module"
import { type OrchardServices, wireUpServices } from "@/services/utils"
import type { OrchardSettings } from "@/settings/types"
import TranscriptionModule from "./modules/transcribe.module"

class Orchard extends Plugin {
  settings!: OrchardSettings
  services!: OrchardServices

  videoModule!: VideoModule
  transcriptionModule!: TranscriptionModule

  override async onload(): Promise<void> {
    await this.loadSettings()

    this.services = wireUpServices(this.settings)

    this.videoModule = new VideoModule(this.app, this.settings, this.services)
    this.transcriptionModule = new TranscriptionModule(
      this.app,
      this.settings,
      this.services,
    )

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
    const commands: Command[] = [
      {
        id: "orchard-open",
        name: "Open Orchard",
        callback: () => this.activateView(),
      },
    ]

    const videoCommands = await this.videoModule.registerCommands()
    commands.push(...videoCommands)

    const transcriptionCommands =
      await this.transcriptionModule.registerCommands()
    commands.push(...transcriptionCommands)

    // this.addCommand({
    //   id: "orchard-picker",
    //   name: "Insert latex snippet",
    //   checkCallback: (checking) => {
    //     const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    //
    //     if (view) {
    //       if (!checking) {
    //         new OrchardModal(this.app).open()
    //       }
    //
    //       return true
    //     }
    //
    //     return false
    //   },
    // })

    // this.addCommand({
    //   id: "orchard-recenter",
    //   name: "Recenter",
    //   callback: () => {
    //     this.centerView()
    //   },
    // })

    for (const cmd of commands) {
      this.addCommand(cmd)
    }
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
}

export default Orchard
