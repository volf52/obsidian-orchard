import type { OrchardSettings } from "@/settings/types"
import { YoutubeApiService } from "./video"

export const wireUpServices = (settings: OrchardSettings) => {
  const youtubeService = new YoutubeApiService(settings.googleApiKey)

  return { youtube: youtubeService } as const
}

export type OrchardServices = ReturnType<typeof wireUpServices>
