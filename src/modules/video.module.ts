import { type App, type Command, Modal } from "obsidian"
import { mount, unmount } from "svelte"
import AddVideoModal from "@/components/AddVideoModal.svelte"
import { notifyErr, notifySuccess } from "@/notify"
import type { OrchardServices } from "@/services/utils"
import type { YoutubeApiService } from "@/services/video"
import { extractYtId, videoMetaToContent } from "@/services/video/utils"
import type { OrchardSettings } from "@/settings/types"
import { cleanTitle } from "@/utils"

class VideoModule {
  #ytServ: YoutubeApiService
  #closeModal: (() => void) | null = null

  constructor(
    readonly app: App,
    readonly settings: OrchardSettings,
    services: OrchardServices,
  ) {
    this.#ytServ = services.youtube
  }

  async registerCommands(): Promise<Command[]> {
    const commands: Command[] = []

    commands.push({
      id: "orchard-video-add",
      name: "Add Video Note",
      callback: () => {
        this.addVideo()
      },
    })

    return commands
  }

  private addVideo() {
    const m = new Modal(this.app)

    m.setTitle("Add Video Note")
    m.contentEl.empty()

    const svModal = mount(AddVideoModal, {
      target: m.contentEl,
      props: {
        onSubmit: async (value, errFunc) => {
          const videoId = extractYtId(value)
          if (videoId === null) {
            errFunc(value, "Invalid YouTube URL or ID")
            return
          }

          this.#closeModal?.()

          const videoFolder = this.settings.videoNoteFolder

          if (!videoFolder) {
            notifyErr("Video note folder is not set in settings.")
            return
          }

          const metadata = await this.#ytServ.fetchVideoDetails(videoId)
          if (!metadata) {
            notifyErr("Failed to fetch video details.")
            return
          }

          const now = new Date().toISOString()
          const content = videoMetaToContent(videoId, metadata, now)
          const title = cleanTitle(metadata.title)

          const file = await this.app.vault.create(
            `${videoFolder}/${title}.md`,
            content,
          )
          const leaf = this.app.workspace.getLeaf("tab")
          notifySuccess("Video imported")
          await leaf.openFile(file)
        },
      },
    })

    this.#closeModal = () => {
      unmount(svModal).then(() => {
        m.close()
      })
    }

    m.open()
  }
}

export default VideoModule
