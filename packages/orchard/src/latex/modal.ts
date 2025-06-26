import { type App, FuzzySuggestModal, Notice } from "obsidian"
import { getActiveEditor } from "@/utils/obsidian-utils"
import { insertLatexItem, type LatexItem, PREDEFINED_LATEX } from "./latexitem"

class OrchardSuggestionsModal extends FuzzySuggestModal<LatexItem> {
  constructor(app: App) {
    super(app)

    this.setPlaceholder("Select latext snippet to insert")
  }

  getItems(): LatexItem[] {
    return PREDEFINED_LATEX
  }

  getItemText(item: LatexItem): string {
    return item.display
  }

  onChooseItem(item: LatexItem, _evt: MouseEvent | KeyboardEvent): void {
    const editor = getActiveEditor(this.app)
    if (!editor) {
      new Notice("found no active markdown editor")
      return
    }

    insertLatexItem(item, editor)
    this.close()
  }
}

export default OrchardSuggestionsModal
