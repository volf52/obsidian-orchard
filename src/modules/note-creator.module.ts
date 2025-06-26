import type { App } from "obsidian"
import type { OrchardServices } from "@/services/utils"
import type { OrchardSettings } from "@/settings/types"

class NoteCreatorModule {
  constructor(
    readonly app: App,
    readonly settings: OrchardSettings,
    readonly services: OrchardServices,
  ) {}
}
