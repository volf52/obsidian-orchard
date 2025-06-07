<script lang="ts">
import SettingItem, {
  type SettingItemExtensionProps,
} from "./SettingItem.svelte"
import Spinner from "./Spinner.svelte"

type DropdownItem = {
  label: string
  value: string
}

type NoPromise = {
  isPromise: false
  items: DropdownItem[]
}

type WithPromise = {
  isPromise: true
  itemLoader: () => Promise<DropdownItem[]>
}

type ItemProps = NoPromise | WithPromise

export type DropdownSettingItemProps = SettingItemExtensionProps &
  ItemProps & {
    value: string
    fullWidth?: boolean
    onChange?: (value: string) => void
  }

let {
  value = $bindable(),
  description = $bindable(""),
  ...constProps
}: DropdownSettingItemProps = $props()
const { name, onChange } = constProps

$effect(() => {
  onChange?.(value)
})
</script>

{#snippet dropdown(items: DropdownItem[])}
  <select class="dropdown" bind:value>
    {#each items as item}
      <option value={item.value}>{item.label}</option>
    {/each}
  </select>
{/snippet}

<SettingItem {name} bind:description>
  {#snippet controlItem()}
    {#if constProps.isPromise}
      <Spinner />
    {:else}
      {@render dropdown(constProps.items)}
    {/if}
  {/snippet}
</SettingItem>
