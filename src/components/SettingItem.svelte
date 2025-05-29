<script lang="ts">
  import type { Snippet } from "svelte";

  export type SettingItemExtensionProps = {
    name: string;
    description?: string;
  };

  type SettingItemProps = SettingItemExtensionProps & {
    controlItem: Snippet;
  };

  let { description = $bindable(""), ...constProps }: SettingItemProps =
    $props();
  const { name, controlItem } = constProps;
</script>

<div class="setting-item">
  <div class="setting-item-info">
    <span class="setting-item-name">{name}</span>
    {#if description}
      <span class="setting-item-description">
        {description}
      </span>
    {/if}
  </div>
  <div class="setting-item-control">
    {@render controlItem()}
  </div>
</div>
