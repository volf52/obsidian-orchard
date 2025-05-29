<script lang="ts">
  import SettingItem, {
    type SettingItemExtensionProps,
  } from "./SettingItem.svelte";

  export type DropdownSettingItemProps = SettingItemExtensionProps & {
    value: string;
    fullWidth?: boolean;
    items: Array<{ label: string; value: string }>;
    onChange?: (value: string) => void;
  };

  let {
    value = $bindable(),
    description = $bindable(""),
    ...constProps
  }: DropdownSettingItemProps = $props();
  const { name, items, onChange } = constProps;

  $effect(() => {
    onChange?.(value);
  });
</script>

<SettingItem {name} bind:description>
  {#snippet controlItem()}
    <select class="dropdown" bind:value>
      {#each items as item}
        <option value={item.value}>{item.label}</option>
      {/each}
    </select>
  {/snippet}
</SettingItem>
