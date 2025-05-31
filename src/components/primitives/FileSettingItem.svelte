<script lang="ts">
  import SettingItem, {
    type SettingItemExtensionProps,
  } from "./SettingItem.svelte";

  type FileSettingItemProps = SettingItemExtensionProps & {
    fullWidth?: boolean;
    accept?: string;
    setFile: (file: File) => void;
  };

  let { description = $bindable(""), ...constProps }: FileSettingItemProps =
    $props();
  const { fullWidth, name, setFile, accept } = constProps;

  let files = $state<FileList>();

  $effect(() => {
    if (files) {
      const file = files.item(0);
      if (file) {
        console.log("File selected", file.name, file.type, file.size);
        setFile(file);
      }
    }
  });
</script>

<SettingItem {name} bind:description>
  {#snippet controlItem()}
    <input
      style:width={fullWidth ? "100%" : undefined}
      type="file"
      bind:files
      {accept}
      name="fileInput"
    />
  {/snippet}
</SettingItem>
