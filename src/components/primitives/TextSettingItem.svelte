<script lang="ts">
import { onMount } from "svelte"
import SettingItem, {
  type SettingItemExtensionProps,
} from "./SettingItem.svelte"

type TextSettingItemProps = SettingItemExtensionProps & {
  placeholder?: string
  value: string
  fullWidth?: boolean
  onChange?: (value: string) => void
}

let {
  value = $bindable(),
  description = $bindable(""),
  ...constProps
}: TextSettingItemProps = $props()
const { fullWidth, name, placeholder, onChange } = constProps

$effect(() => {
  onChange?.(value)
})

onMount(() => {
  console.log("Adding setting item", name)
  return () => {
    console.log("Bye bye setting item", name)
  }
})
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
