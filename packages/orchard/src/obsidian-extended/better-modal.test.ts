import { describe, expect, mock, test } from "bun:test"

type StyleRecord = Record<string, string> & { cursor: string }

class ElementStub {
  className = ""
  readonly style: StyleRecord = { cursor: "" }
  parentElement: ElementStub | null = null
  private children: ElementStub[] = []

  constructor(readonly tagName: string) {}

  appendChild(child: ElementStub) {
    if (child.parentElement) {
      child.parentElement.removeChild(child)
    }
    child.parentElement = this
    this.children.push(child)
    return child
  }

  removeChild(child: ElementStub) {
    const index = this.children.indexOf(child)
    if (index === -1) {
      throw new Error("Child not found")
    }
    this.children.splice(index, 1)
    child.parentElement = null
    return child
  }

  replaceChild(newChild: ElementStub, oldChild: ElementStub) {
    const index = this.children.indexOf(oldChild)
    if (index === -1) {
      throw new Error("Child not found")
    }
    if (newChild.parentElement) {
      newChild.parentElement.removeChild(newChild)
    }
    newChild.parentElement = this
    this.children[index] = newChild
    oldChild.parentElement = null
    return oldChild
  }

  contains(target: ElementStub): boolean {
    if (target === this) return true
    return this.children.some((child) => child.contains(target))
  }

  find(selector: string) {
    return this.querySelector(selector)
  }

  querySelector(selector: string): ElementStub | null {
    const [tagSelector, classSelector] = selector.split(".")
    const matches = (node: ElementStub) => {
      const tagMatches = tagSelector
        ? node.tagName.toLowerCase() === tagSelector.toLowerCase()
        : true
      const classMatches = classSelector
        ? node.className.split(/\s+/).includes(classSelector)
        : true
      return tagMatches && classMatches
    }

    const visit = (node: ElementStub): ElementStub | null => {
      for (const child of node.children) {
        if (matches(child)) return child
        const descendant = visit(child)
        if (descendant) return descendant
      }
      return null
    }

    return visit(this)
  }

  setCssStyles(styles: Record<string, string>) {
    for (const [key, value] of Object.entries(styles)) {
      this.style[key] = value
    }
  }

  empty() {
    for (const child of [...this.children]) {
      this.removeChild(child)
    }
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this)
    }
  }

  cloneNode(deep?: boolean) {
    const clone = new ElementStub(this.tagName)
    clone.className = this.className
    for (const [key, value] of Object.entries(this.style)) {
      clone.style[key] = value
    }
    if (deep) {
      for (const child of this.children) {
        clone.appendChild(child.cloneNode(true))
      }
    }
    return clone
  }
}

mock.module("obsidian", () => {
  class MockNotice {
    messageEl: ElementStub

    constructor(public message: string) {
      this.messageEl = new ElementStub("div")
      this.messageEl.appendChild(new ElementStub("span"))
    }
  }

  class MockModal {
    app: unknown
    containerEl: HTMLDivElement
    modalEl: HTMLDivElement
    contentEl: HTMLDivElement

    constructor(app: unknown) {
      this.app = app

      const container = new ElementStub("div")
      const bg = new ElementStub("div")
      bg.className = "modal-bg"
      container.appendChild(bg)

      const modal = new ElementStub("div")
      modal.className = "modal"
      const close = new ElementStub("div")
      close.className = "modal-close-button"
      modal.appendChild(close)

      const content = new ElementStub("div")
      content.className = "modal-content"
      modal.appendChild(content)

      container.appendChild(modal)

      this.containerEl = container as unknown as HTMLDivElement
      this.modalEl = modal as unknown as HTMLDivElement
      this.contentEl = content as unknown as HTMLDivElement
    }

    setTitle() {}
    onClose() {}
  }

  return { Modal: MockModal, Notice: MockNotice }
})

const { default: BetterModal } = await import("./better-modal")

const getBg = (modal: BetterModal) =>
  modal.containerEl.find("div.modal-bg") as unknown as ElementStub

const getClose = (modal: BetterModal) =>
  modal.modalEl.find("div.modal-close-button") as unknown as ElementStub

describe("BetterModal closing controls", () => {
  test("disableClose and enableClose swap control elements safely", () => {
    const modal = new BetterModal({}, "Test Modal")

    expect(modal.canClose).toBe(false)

    expect(() => modal.disableClose()).not.toThrow()
    expect(getBg(modal).style.cursor).toBe("")
    expect(getClose(modal).style.cursor).toBe("")

    modal.enableClose()
    expect(modal.canClose).toBe(true)
    expect(getBg(modal).style.cursor).toBe("")
    expect(getClose(modal).style.cursor).toBe("")

    modal.disableClose()
    expect(modal.canClose).toBe(false)
    expect(getBg(modal).style.cursor).toBe("not-allowed")
    expect(getClose(modal).style.cursor).toBe("not-allowed")

    modal.enableClose()
    expect(modal.canClose).toBe(true)
    expect(getBg(modal).style.cursor).toBe("")
    expect(getClose(modal).style.cursor).toBe("")
  })

  test("toggleClose flips closing ability without throwing", () => {
    const modal = new BetterModal({}, "Toggle Modal")

    modal.enableClose()
    expect(modal.canClose).toBe(true)
    expect(getBg(modal).style.cursor).toBe("")

    modal.toggleClose()
    expect(modal.canClose).toBe(false)
    expect(getBg(modal).style.cursor).toBe("not-allowed")

    modal.toggleClose()
    expect(modal.canClose).toBe(true)
    expect(getBg(modal).style.cursor).toBe("")
  })

  test("guards skip replacements when nodes are detached", () => {
    const modal = new BetterModal({}, "Detached Modal")

    const bg = getBg(modal)
    const close = getClose(modal)
    bg.remove()
    close.remove()

    expect(() => modal.disableClose()).not.toThrow()
    expect(() => modal.enableClose()).not.toThrow()
  })
})
