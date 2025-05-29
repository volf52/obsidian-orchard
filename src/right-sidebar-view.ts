import { type App, ItemView, Notice, type WorkspaceLeaf } from "obsidian"
import { ICON, ORCHAR_RSB_VIEW_TYPE } from "./constants"
import { insertLatexItem, PREDEFINED_LATEX } from "./latex"
import type Orchard from "./plugin"
import { getActiveEditor } from "./utils"

class RightSidebarView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: Orchard,
  ) {
    super(leaf)
  }

  getViewType(): string {
    return ORCHAR_RSB_VIEW_TYPE
  }

  getDisplayText(): string {
    return "Orchard"
  }

  override getIcon(): string {
    return ICON
  }

  override async onOpen(): Promise<void> {
    const app = this.app
    const container = this.containerEl.children[1]
    if (!container) {
      return
    }

    container.empty()

    container.createEl("h1", { text: "Orchard", cls: "orchard-modal-title" })
    container.createEl("h2", { text: "Snippets", cls: "orchard-test" })

    const snippetsRoot = container.createDiv({ cls: "orchard-modal-list" })

    for (const lit of PREDEFINED_LATEX) {
      const itemEl = snippetsRoot.createDiv({
        text: lit.display,
        cls: "orchard-modal-item",
      })

      itemEl.onClickEvent((_ev) => {
        _ev.preventDefault()

        const editor = getActiveEditor(app)

        if (!editor) {
          new Notice("no active editor")
          return
        }

        insertLatexItem(lit, editor)
      })
    }
  }

  override async onClose(): Promise<void> {}

  static async getOrCreateLeaf(app: App) {
    const { workspace } = app

    const leaves = workspace.getLeavesOfType(ORCHAR_RSB_VIEW_TYPE)

    if (leaves.length > 0) {
      return leaves[0]
    }

    const leaf = workspace.getRightLeaf(false)
    if (!leaf) throw new Error("couldn't create leaf")

    await leaf.setViewState({ type: ORCHAR_RSB_VIEW_TYPE, active: true })

    return leaf
  }
}

export default RightSidebarView
