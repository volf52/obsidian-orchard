import { notifyErr } from "@/notify"
import type { Prettify } from "@/types"
import { cleanTag } from "@/utils"
import type { Chapter, VideoMetadata, YtSearchItem } from "./types"

export const extractYtId = (url: string) => {
  if (!url) return null

  try {
    const u = new URL(url)
    let videoId = ""

    if (u.host === "youtu.be") videoId = u.pathname.slice(1)
    else videoId = u.searchParams.get("v") || ""

    return videoId
  } catch (err) {
    notifyErr("Invalid URL", err)

    return null
  }
}

export const TIME_REGEX = /\b(\d{1,2}(:\d{2})?:\d{2})\b/
// export const TIME_REGEX = /\b(\d{1,2}:\d{2})\b/

export function extractChapters(
  videoId: string,
  description: string,
): { chapters: Chapter[]; cleanedDescription: string } {
  const lines = description.split("\n")
  const chapters: Chapter[] = []
  const newDescLines: string[] = []

  for (const line of lines) {
    const match = line.match(TIME_REGEX)
    if (match) {
      const timestamp = match[1]
      if (!timestamp) continue

      let name = line.replace(timestamp, "").trim()
      if (name.startsWith("-")) name = name.slice(1).trim()
      if (name.startsWith(":")) name = name.slice(1).trim()

      const linkTime = `${timestamp.replace(":", "m")}s`
      const link = `https://www.youtube.com/watch?v=${videoId}&t=${linkTime}`
      chapters.push({ link, start: timestamp, name })
    } else {
      newDescLines.push(line)
    }
  }

  return {
    chapters,
    cleanedDescription: newDescLines.join("\n"),
  }
}

export function toVideoMeta(item: YtSearchItem): VideoMetadata {
  const { snippet, contentDetails } = item
  const meta: VideoMetadata = {
    title: snippet.title,
    description: snippet.description,
    channel: snippet.channelTitle,
    channelId: snippet.channelId,
    uploadedAt: snippet.publishedAt,
    duration: contentDetails.duration.replace(/^PT/i, "").toLowerCase(),
    tags: snippet.tags ?? [],
    channelHandle: "",
    thumbnail: "",
    chapters: [],
  }

  const thumbs = snippet.thumbnails
  meta.thumbnail =
    thumbs.maxres.url ||
    thumbs.high.url ||
    thumbs.standard.url ||
    thumbs.medium.url ||
    thumbs.default.url

  return meta
}

export const videoMetaToContent = (
  id: string,
  meta: VideoMetadata,
  now: string,
): string => {
  const {
    title,
    description = "",
    channel,
    channelHandle,
    duration,
    uploadedAt,
    thumbnail,
    tags = [],
    chapters = [],
  } = meta

  const cleanTags = tags
    .map(cleanTag)
    .filter(Boolean)
    .map((t) => `🎥/${t}`)
  const cleanTagsJoined = cleanTags.join(", ")

  const url = `https://www.youtu.be/${id}`
  const channelLink = channelHandle
    ? `https://www.youtube.com/${channelHandle}`
    : ""

  const fm = {
    id,
    type: "video",
    tags: `["draft", ${cleanTagsJoined}]`,
    title: `"${title}"`,
    url,
    channel: `"[[${channel}]]"`,
    channelUrl: `"${channelLink}"`,
    duration: `"${duration}"`,
    uploaded: uploadedAt,
    createdAt: now,
    up: `["[[Uncategorized]]"]`,
  }

  const fmLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`)

  const out = ["---", ...fmLines, "---", `# 🎥 ${title}`]

  if (thumbnail) {
    out.push("", `![Thumbnail](${thumbnail})`)
  }

  if (chapters.length) {
    out.push(
      "",
      `[Watch (${duration})](<https://youtu.be/${id}>)`,
      "",
      ...chapters.map(
        ({ name, start, link }) => `- [[#${name}]] [${start}](<${link}>)`,
      ),
    )
  }

  if (description.trim()) {
    out.push("", "## Description", "```", description.trim(), "```")
  }

  if (chapters.length) {
    out.push(
      "",
      "## Notes",
      ...chapters.flatMap(({ name, start, link }) => [
        `### ${name}`,
        `[${start}](<${link}>)`,
      ]),
    )
  }

  out.push("", "## References", "")

  return out.join("\n")
}

type RightData<T> = {
  [K in keyof T as K extends `right${string}` ? K : never]: T[K]
}

class BaseClass {
  wrong!: number
  rightAA!: Date

  // @ts-expect-error
  serialize<ThisT>(this: ThisT): Prettify<RightData<ThisT>> {}
}

const _tt = new BaseClass().serialize()
//    ^?

class Sub extends BaseClass {
  rightB!: string
}

const _tu = new Sub().serialize()
//    ^?
