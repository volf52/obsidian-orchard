<script lang="ts">
  import SettingItem, {
    type SettingItemExtensionProps,
  } from "./SettingItem.svelte";
  type TextSettingItemProps = SettingItemExtensionProps & {
    placeholder?: string;
    value: string;
    fullWidth?: boolean;
  };

  let {
    value = $bindable(),
    description = $bindable(""),
    ...constProps
  }: TextSettingItemProps = $props();
  const { fullWidth, name, placeholder } = constProps;
</script>

<SettingItem {name} bind:description>
  {#snippet controlItem()}
    <input
      style:width={fullWidth ? "100%" : undefined}
      type="text"
      spellcheck="false"
      {placeholder}
      bind:value
    />
  {/snippet}
</SettingItem>
