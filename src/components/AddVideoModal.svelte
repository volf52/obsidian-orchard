<script lang="ts">
  import ModalContent from "./primitives/ModalContent.svelte";
  import TextSettingItem from "./primitives/TextSettingItem.svelte";

  type AddVideoModalProps = {
    onSubmit: (
      value: string,
      onErr: (_data: string, err: unknown) => void,
    ) => void;
  };

  const { onSubmit }: AddVideoModalProps = $props();

  let value = $state("");

  const handleSubmit = () => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    onSubmit(trimmedValue, (_errVal, _err) => {});
  };
</script>

<ModalContent onSubmit={handleSubmit}>
  <TextSettingItem name="Video URL" bind:value fullWidth />
</ModalContent>
