import type { App, Command } from "obsidian"
import { mount, unmount } from "svelte"
import TranscribeFileModal from "@/components/TranscribeFileModal.svelte"
import BetterModal from "@/obsidian-extended/better-modal"
import type { OrchardServices } from "@/services/utils"
import type { OrchardSettings } from "@/settings/types"

class TranscriptionModule {
  constructor(
    readonly app: App,
    readonly settings: OrchardSettings,
    _services: OrchardServices,
  ) {}

  async registerCommands(): Promise<Command[]> {
    const commands: Command[] = []

    commands.push({
      id: "orchard-transcribe-meeting",
      name: "Transcribe File",
      callback: () => {
        this.trascribeFlow()
      },
    })

    return commands
  }

  private trascribeFlow() {
    const m = new BetterModal(this.app, "Transcribe File")

    m.modalEl.removeChild(m.contentEl)

    const svelteModal = mount(TranscribeFileModal, {
      target: m.modalEl,
      props: {
        onSubmit: async (
          file: File,
          onErr: (_data: string, err: unknown) => void,
        ) => {
          m.disableClose()

          console.log("File submitted", file.name, file.type, file.size)

          onErr("transcribe", new Error("Transcription not yet implemented"))

          m.enableClose()
          m.close()
        },
      },
    })

    m.registerOnClose(async () => {
      await unmount(svelteModal)
    })

    m.open()
  }
}

export default TranscriptionModule
