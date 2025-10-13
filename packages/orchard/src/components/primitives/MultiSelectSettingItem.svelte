<script lang="ts">
import SettingItem, {
  type SettingItemExtensionProps,
} from "./SettingItem.svelte"

export type MultiSelectOption = {
  value: string
  label: string
  description?: string
}

type MultiSelectSettingItemProps = SettingItemExtensionProps & {
  value: string[]
  options: MultiSelectOption[]
  onChange?: (value: string[]) => void
}

let {
  value = $bindable<string[]>([]),
  description = $bindable(""),
  ...constProps
}: MultiSelectSettingItemProps = $props()

const { options, onChange, ...settingItemProps } = constProps

const toggleOption = (option: MultiSelectOption, checked: boolean) => {
  if (checked) {
    value = Array.from(new Set([...value, option.value]))
    return
  }
  value = value.filter((item) => item !== option.value)
}

$effect(() => {
  onChange?.(value)
})
</script>

<SettingItem {...settingItemProps} bind:description>
  {#snippet controlItem()}
    <div class="multi-select">
      {#each options as option (option.value)}
        <label class="multi-select__option">
          <input
            type="checkbox"
            checked={value.includes(option.value)}
            onchange={(event) => {
              const target = event.currentTarget as HTMLInputElement
              toggleOption(option, target.checked)
            }}
          />
          <span class="multi-select__label">{option.label}</span>
          {#if option.description}
            <span class="multi-select__description">{option.description}</span>
          {/if}
        </label>
      {/each}
    </div>
  {/snippet}
</SettingItem>

<style>
  .multi-select {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .multi-select__option {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background-color: var(--background-modifier-form-field);
  }

  .multi-select__option input[type="checkbox"] {
    align-self: flex-start;
  }

  .multi-select__label {
    font-weight: 500;
  }

  .multi-select__description {
    font-size: 0.85em;
    color: var(--text-muted);
  }
</style>
