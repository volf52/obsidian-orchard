<script lang="ts">
import type { SimpleNoteType } from "@/modules/module.types"
import DropdownSettingItem, {
  type DropdownItem,
} from "./primitives/DropdownSettingItem.svelte"
import ModalContent from "./primitives/ModalContent.svelte"
import TextSettingItem from "./primitives/TextSettingItem.svelte"

type SimpleNoteCreatorModalProps = {
  // type: SimpleNoteType;
  onSubmit: (
    title: string,
    onErr: (_data: string, err: unknown) => void,
  ) => void
}

const { onSubmit }: SimpleNoteCreatorModalProps = $props()

const handleSubmit = () => {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return
  }

  onSubmit(trimmedTitle, (data, err) => {
    console.error("Error submitting note:", data, err)
  })
}

const itemLoader = async (): Promise<Array<DropdownItem>> => {
  return []
}

let title = $state("")
let location: string = $state("")
</script>

<ModalContent onSubmit={handleSubmit}>
  <TextSettingItem
    name="Title"
    placeholder="Enter note title"
    bind:value={title}
    fullWidth
  />
  <DropdownSettingItem name="Location" value={location} itemLoader={itemLoader} isPromise />
</ModalContent>
