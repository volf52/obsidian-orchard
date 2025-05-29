<script lang="ts">
  import type { Snippet } from "svelte";

  export type SettingItemExtensionProps = {
    name: string;
    description?: string;
    ariaLabel?: string;
    removeInfo?: boolean;
    cls?: string;
  };

  type SettingItemNoCtrl = SettingItemExtensionProps & {
    removeCtrl: true;
  };

  type SettingItemWithCtrl = SettingItemExtensionProps & {
    removeCtrl?: false;
    controlItem: Snippet;
  };

  type SettingItemProps = SettingItemNoCtrl | SettingItemWithCtrl;

  let { description = $bindable(""), ...constProps }: SettingItemProps =
    $props();
  const { ariaLabel, name, removeInfo = false, cls = "" } = constProps;
</script>

<div
  class={`setting-item ${cls}`}
  style:justify-content={constProps.removeCtrl ? "center" : undefined}
>
  {#if !removeInfo}
    <div class="setting-item-info">
      <div class="setting-item-name" aria-label={ariaLabel}>{name}</div>
      {#if description}
        <div class="setting-item-description">
          {description}
        </div>
      {/if}
    </div>
  {/if}

  {#if !constProps.removeCtrl}
    <div class="setting-item-control">
      {@render constProps.controlItem()}
    </div>
  {/if}
</div>
