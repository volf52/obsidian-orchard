type Thumbnail = {
  url: string;
};

type Thumbnails = {
  default: Thumbnail;
  medium: Thumbnail;
  hight: Thumbnail;
  standard: Thumbnail;
  maxres: Thumbnail;
};

type Snippet = {
  title: string;
  description: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  tags: string[];
  thumbnails: Thumbnails;
};

type ContentDetails = {
  duration: string;
};

type YtSearchItem = {
  contentDetails: ContentDetails;
  snippet: Snippet;
};

export type YtSearchResponse = {
  items: Array<YtSearchItem>;
};
