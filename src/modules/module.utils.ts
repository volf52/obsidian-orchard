import { type App, Modal as ObsidianModal } from "obsidian"
import { type Component, type ComponentProps, mount, unmount } from "svelte"

// biome-ignore lint/suspicious/noExplicitAny: Intentional
export type AddModalOptions<C extends Component<any, any>> = {
  app: App
  title: string
  modalComponent: C
  componentProps: ComponentProps<C>
}

// biome-ignore lint/suspicious/noExplicitAny: Intentional
export const addModal = <C extends Component<any, any>>({
  app,
  title,
  modalComponent,
  componentProps,
}: AddModalOptions<C>) => {
  const m = new ObsidianModal(app)
  m.setTitle(title)

  m.contentEl.empty()

  const svelteModal = mount(modalComponent, {
    target: m.contentEl,
    props: componentProps,
  })

  const originalClose = m.onClose.bind(m)
  m.onClose = () => {
    console.warn("Modal close overridden by Svelte component")
    originalClose()

    unmount(svelteModal).finally(() => {
      originalClose()
    })
  }

  return m
}
