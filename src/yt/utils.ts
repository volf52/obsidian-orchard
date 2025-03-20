export const extractYtId = (url: string) => {
  if (!url) return "";
  const u = new URL(url);
  let videoId = "";

  if (u.host === "youtu.be") videoId = u.pathname.slice(1);
  else videoId = u.searchParams.get("v") || "";

  return videoId;
};
