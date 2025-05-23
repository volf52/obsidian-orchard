type Thumbnail = {
  url: string
}

type Thumbnails = {
  default: Thumbnail
  medium: Thumbnail
  high: Thumbnail
  standard: Thumbnail
  maxres: Thumbnail
}

type Snippet = {
  title: string
  description: string
  channelTitle: string
  channelId: string
  publishedAt: string
  tags: string[]
  thumbnails: Thumbnails
}

type ContentDetails = {
  duration: string
}

export type YtSearchItem = {
  contentDetails: ContentDetails
  snippet: Snippet
}

export type YtSearchResponse = {
  items: Array<YtSearchItem>
}

export type Chapter = {
  link: string
  start: string
  name: string
}

export type ChannelSnippet = {
  customUrl: string
}

export type ChannelItem = {
  snippet: ChannelSnippet
}

export type ChannelResp = {
  items: ChannelItem[]
}

export type VideoMetadata = {
  title: string
  description: string
  duration: string
  uploadedAt: string
  channel: string
  channelId: string
  channelHandle: string
  thumbnail: string
  chapters: Chapter[]
  tags: string[]
}
