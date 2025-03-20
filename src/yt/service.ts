import type Orchard from "../plugin";
import ky, { type KyInstance } from "ky";
import type { YtSearchResponse } from "./types";
import { notifyErr } from "../error";

const DEFAULT_PARAMS = {
  part: "snippet,contentDetails",
};

class YtServ {
  http: KyInstance;

  constructor(
    private apiKey: string,
    readonly plugin: Orchard,
  ) {
    this.plugin.et.onSettingUpdate((s) => {
      this.updateApiKey(s.googleApiKey);
    });

    this.http = ky.extend({
      prefixUrl: "https://www.googleapis.com/youtube/v3/videos",
      searchParams: { key: apiKey, ...DEFAULT_PARAMS },
    });
  }

  updateApiKey(newKey: string) {
    this.apiKey = newKey;
    this.http = this.http.extend({
      searchParams: { ...DEFAULT_PARAMS, key: this.apiKey },
    });
  }

  async fetchVideoDetails(videoId: string) {
    const detailRes = await this.http.get("", {
      searchParams: { id: videoId },
    });
    const data: YtSearchResponse = await detailRes.json();

    if (data.items.length === 1) {
      notifyErr("Got more than 1 results");
    }
  }
}

export default YtServ;
