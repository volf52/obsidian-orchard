import { Notice } from "obsidian";

export const notifyErr = (message: string, err?: unknown) => {
  console.error(err || message);
  const notice = new Notice(message);
  notice.noticeEl.style.color = "red";
};
