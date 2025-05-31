import { type App, Modal } from "obsidian"
import { createStore } from "zustand/vanilla"
import { notifyErr } from "@/notify"

type OnCloseFunction = (() => void) | (() => Promise<void>)

class BetterModal extends Modal {
  #canCloseStore = createStore(() => false)

  #bgEl: HTMLDivElement
  #bgDisabledEl: HTMLDivElement

  #closeBtnEl: HTMLDivElement
  #closeBtnDisabledEl: HTMLDivElement

  #onCloseFunctions: Array<OnCloseFunction> = []

  constructor(app: App, title?: string) {
    super(app)

    if (title) {
      this.setTitle(title)
    }

    const bgEl = this.containerEl.find("div.modal-bg")
    if (!bgEl) {
      notifyErr("Modal background element not found")
      throw new Error("Modal background element not found")
    }

    const btnEl = this.modalEl.find("div.modal-close-button")
    if (!btnEl) {
      notifyErr("Modal close button element not found")
      throw new Error("Modal close button element not found")
    }

    this.#bgEl = bgEl as HTMLDivElement
    this.#closeBtnEl = btnEl as HTMLDivElement

    this.#bgDisabledEl = bgEl.cloneNode(true) as HTMLDivElement
    this.#closeBtnDisabledEl = btnEl.cloneNode(true) as HTMLDivElement

    this.#bgDisabledEl.setCssStyles({
      cursor: "not-allowed",
    })
    this.#closeBtnDisabledEl.setCssStyles({
      cursor: "not-allowed",
    })

    this.#canCloseStore.subscribe((canClose) => {
      if (canClose) {
        this.#enableClosing()
      } else {
        this.#disableClosing()
      }
    })

    this.contentEl.empty()
  }

  get canClose(): boolean {
    return this.#canCloseStore.getState()
  }

  disableClose() {
    this.#canCloseStore.setState(false)
  }
  enableClose(enabled?: boolean) {
    this.#canCloseStore.setState(enabled ?? true)
  }
  toggleClose() {
    this.#canCloseStore.setState((prev) => !prev)
  }

  #enableClosing() {
    // console.log("Enabling modal closing")
    this.containerEl.replaceChild(this.#bgDisabledEl, this.#bgEl)
    this.modalEl.replaceChild(this.#closeBtnDisabledEl, this.#closeBtnEl)
  }

  #disableClosing() {
    // console.log("Disabling modal closing")
    this.containerEl.replaceChild(this.#bgEl, this.#bgDisabledEl)
    this.modalEl.replaceChild(this.#closeBtnEl, this.#closeBtnDisabledEl)
  }

  registerOnClose(fn: OnCloseFunction) {
    this.#onCloseFunctions.push(fn)

    return () => {
      this.#onCloseFunctions.remove(fn)
    }
  }

  override onClose() {
    // console.log("On close functions:", this.#onCloseFunctions)
    const promises: Promise<void>[] = []

    for (const fn of this.#onCloseFunctions) {
      const res = fn()
      if (res instanceof Promise) {
        promises.push(res)
      }
    }
    // console.log("Promises to resolve:", promises)
    Promise.all(promises).then(() => {
      // console.log("Finally closing")
      super.onClose()
    })
  }
}

export default BetterModal
