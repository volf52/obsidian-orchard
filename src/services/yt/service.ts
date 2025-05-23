import { onSettingUpdate } from "@/events/settings-store"
import { notifyErr } from "@/notify"
import type Orchard from "@/plugin"
import ky, { type KyInstance } from "ky"
import type { ChannelResp, VideoMetadata, YtSearchResponse } from "./types"
import { extractChapters, toVideoMeta } from "./utils"

class YtServ {
  #http: KyInstance
  #unsub: () => void

  constructor(
    private apiKey: string,
    readonly plugin: Orchard,
  ) {
    this.#unsub = onSettingUpdate((s) => {
      this.updateApiKey(s.googleApiKey)
    })

    this.#http = ky.extend({
      prefixUrl: "https://www.googleapis.com/youtube/v3",
      searchParams: { key: apiKey },
    })
  }

  updateApiKey(newKey: string) {
    this.apiKey = newKey
    this.#http = this.#http.extend({
      searchParams: { key: this.apiKey },
    })
  }

  async fetchVideoDetails(videoId: string): Promise<VideoMetadata | null> {
    const detailRes = await this.#http.get("videos", {
      searchParams: { id: videoId, part: "snippet,contentDetails" },
    })
    const data: YtSearchResponse = await detailRes.json()

    const item = data.items[0]
    if (!item) {
      notifyErr("Got >< 1 results")
      return null
    }

    const meta = toVideoMeta(item)

    const channelHandle = await this.getChannelHandle(meta.channelId)
    if (!channelHandle) return null

    meta.channelHandle = channelHandle
    const { chapters, cleanedDescription } = extractChapters(
      videoId,
      meta.description,
    )

    meta.chapters = chapters
    meta.description = cleanedDescription

    return meta
  }

  async getChannelHandle(channelId: string): Promise<string | null> {
    const res = await this.#http.get("channels", {
      searchParams: { id: channelId, part: "snippet" },
    })
    const data: ChannelResp = await res.json()

    if (data.items.length !== 1) {
      notifyErr("Invalid number of channel results")
      return null
    }

    return data.items[0]?.snippet?.customUrl || null
  }

  destroy() {
    this.#unsub()
  }
}

export default YtServ
