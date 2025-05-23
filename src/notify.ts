import { Notice } from "obsidian"

export const notifyErr = (message: string, err?: unknown) => {
  console.error(message)
  if (err) console.error(err)
  const notice = new Notice(message)
  notice.messageEl.style.color = "red"
}

export const notifySuccess = (message: string) => {
  const notice = new Notice(message, 5000)
  notice.messageEl.style.color = "green"
}
