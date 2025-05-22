import { Notice } from "obsidian";

export const notifyErr = (message: string, err?: unknown) => {
  console.error(message);
  if (err) console.error(err);
  const notice = new Notice(message);
  notice.messageEl.style.color = "red";
};
