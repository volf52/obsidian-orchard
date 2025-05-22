import { notifyErr } from "@/error";

export const extractYtId = (url: string) => {
  if (!url) return null;

  try {
    const u = new URL(url);
    let videoId = "";

    if (u.host === "youtu.be") videoId = u.pathname.slice(1);
    else videoId = u.searchParams.get("v") || "";

    return videoId;
  } catch (err) {
    notifyErr("Invalid URL", err);

    return null;
  }
};
