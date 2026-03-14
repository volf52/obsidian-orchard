import ky, { type KyInstance } from 'ky'
import { notifyErr } from '@/notify'
import { onSettingChange, trackSubscription } from '@/stores/settings'
import type { ChannelResp, VideoMetadata, YtSearchResponse } from './types'
import { extractChapters, toVideoMeta } from './utils'

class YoutubeApiService {
  private http: KyInstance
  private unsub: () => void

  constructor(private apiKey: string) {
    // Subscribe to Google API key changes specifically
    this.unsub = onSettingChange('googleApiKey', (newApiKey) => {
      this.updateApiKey(newApiKey)
    })

    trackSubscription(this.unsub)

    this.http = ky.extend({
      prefixUrl: 'https://www.googleapis.com/youtube/v3',
      searchParams: { key: apiKey },
    })
  }

  updateApiKey(newKey: string) {
    this.apiKey = newKey
    this.http = this.http.extend({
      searchParams: { key: this.apiKey },
    })
  }

  async fetchVideoDetails(videoId: string): Promise<VideoMetadata | null> {
    const detailRes = await this.http.get('videos', {
      searchParams: { id: videoId, part: 'snippet,contentDetails' },
    })
    const data: YtSearchResponse = await detailRes.json()

    const item = data.items[0]
    if (!item) {
      notifyErr('Got >< 1 results')
      return null
    }
    console.log('Item', item)

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
    const res = await this.http.get('channels', {
      searchParams: { id: channelId, part: 'snippet' },
    })
    const data: ChannelResp = await res.json()

    if (data.items.length !== 1) {
      notifyErr('Invalid number of channel results')
      return null
    }

    return data.items[0]?.snippet?.customUrl || null
  }

  destroy() {
    this.unsub()
  }
}

export default YoutubeApiService
