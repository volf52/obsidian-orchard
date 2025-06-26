<script lang="ts">
import ModalContent from "./primitives/ModalContent.svelte"
import TextSettingItem from "./primitives/TextSettingItem.svelte"
import TabPanel from "./tabs/TabPanel.svelte"
import Tabs from "./tabs/Tabs.svelte"

type AddVideoModalProps = {
  onSubmit: (
    value: string,
    onErr: (_data: string, err: unknown) => void,
  ) => void
}

const { onSubmit }: AddVideoModalProps = $props()

let value = $state("")

const handleSubmit = () => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return
  }

  onSubmit(trimmedValue, (_errVal, _err) => {})
}
</script>

<ModalContent onSubmit={handleSubmit}>
  <TextSettingItem name="Video URL" bind:value fullWidth />
  <!-- <Tabs> -->
  <!--   <TabPanel label="Random stuff">Hello there</TabPanel> -->
  <!--   <TabPanel label="Video"> -->
  <!--     <TextSettingItem name="Video URL" bind:value fullWidth /> -->
  <!--   </TabPanel> -->
  <!-- </Tabs> -->
</ModalContent>
