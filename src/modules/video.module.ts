import type { App, Command } from "obsidian"
import { mount, unmount } from "svelte"
import AddVideoModal from "@/components/AddVideoModal.svelte"
import { notifyErr, notifySuccess } from "@/notify"
import BetterModal from "@/obsidian-extended/better-modal"
import type { OrchardServices } from "@/services/utils"
import type { YoutubeApiService } from "@/services/video"
import { extractYtId, videoMetaToContent } from "@/services/video/utils"
import type { OrchardSettings } from "@/settings/types"
import { cleanTitle } from "@/utils"

class VideoModule {
  #ytServ: YoutubeApiService

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
    const m = new BetterModal(this.app, "Add Video Note")

    const svelteModal = mount(AddVideoModal, {
      target: m.contentEl,
      props: {
        onSubmit: async (value, errFunc) => {
          m.disableClose()
          const videoId = extractYtId(value)
          if (videoId === null) {
            errFunc(value, "Invalid YouTube URL or ID")
            return
          }

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

export default VideoModule
