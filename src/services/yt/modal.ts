import type { App } from "obsidian"
import { Modal } from "obsidian"
import { mount, unmount } from "svelte"
import InputModal from "@/components/InputModal.svelte"
import { extractYtId } from "./utils"

type OnSubmit = (videoId: string) => void

class YtInputModal extends Modal {
  #sveltePart: ReturnType<typeof InputModal> | null = null

  constructor(app: App, onSubmit: OnSubmit) {
    super(app)

    this.init(onSubmit)
  }

  init(onSubmit: OnSubmit) {
    this.contentEl.empty()

    this.setTitle("Add Video Note")

    this.#sveltePart = mount(InputModal, {
      target: this.contentEl,
      props: {
        label: "Video URL",
        onSubmit: (value: string, errFunc) => {
          const id = extractYtId(value)
          if (id === null) {
            errFunc(value, "Invalid YouTube URL or ID")
            return
          }

          this.close()
          onSubmit(id)
        },
      },
    })
  }

  override onClose(): void {
    if (this.#sveltePart) {
      unmount(this.#sveltePart)
      this.#sveltePart = null
    }
  }
}

export default YtInputModal
