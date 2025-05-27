<script lang="ts">
import SubmitButton from "./SubmitButton.svelte"
import TextSettingItem from "./TextSettingItem.svelte"

type InputModalProps = {
  label: string
  initialValue?: string
  onSubmit: (
    value: string,
    onErr: (_data: string, err: unknown) => void,
  ) => void
}

const { label: name, initialValue, onSubmit }: InputModalProps = $props()

let value = $state(initialValue || "")

const handleSubmit = () => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return
  }

  onSubmit(trimmedValue, (_errVal, _err) => {})
}
</script>

<div class="modal-content">
  <TextSettingItem {name} bind:value fullWidth />
  <SubmitButton onSubmit={handleSubmit} />
</div>
