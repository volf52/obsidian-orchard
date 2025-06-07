<script lang="ts">
import type { Snippet } from "svelte"
import SubmitButton from "./SubmitButton.svelte"

type ModalProps = {
  children: Snippet

  // onSubmit: <T, E = unknown>(
  //   value: T,
  //   errFunc: (data: T, err: E) => void,
  // ) => void;
  onSubmit: () => void
}

const { children, onSubmit }: ModalProps = $props()
</script>

<div class="modal-content">
  {@render children()}

  <SubmitButton {onSubmit} />
</div>
