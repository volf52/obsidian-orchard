<script lang="ts">
type TextSettingItemProps = {
  name: string
  placeholder?: string
  description?: string
  value: string
  fullWidth?: boolean
}

const {
  name,
  description,
  placeholder,
  value = $bindable(),
  fullWidth,
}: TextSettingItemProps = $props()
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
      class={fullWidth ? "full-width" : ""}
      type="text"
      spellcheck="false"
      {placeholder}
      bind:value
    />
  </div>
</div>

<style>
  input.full-width {
    width: 100%;
  }
</style>
