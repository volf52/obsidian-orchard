<script lang="ts">
  type TextSettingItemProps = {
    name: string;
    placeholder?: string;
    description?: string;
    value: string;
    fullWidth?: boolean;
  };

  let { value = $bindable(), ...constProps }: TextSettingItemProps = $props();
  const { fullWidth, name, description, placeholder } = constProps;
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
    <input
      style:width={fullWidth ? "100%" : undefined}
      type="text"
      spellcheck="false"
      {placeholder}
      bind:value
    />
  </div>
</div>
