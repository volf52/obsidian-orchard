<script lang="ts">
type SubmitButtonProps = {
  name?: string
  onSubmit: () => void
  cls?: string
}

const { name, onSubmit, cls }: SubmitButtonProps = $props()

const inner = name || "Submit"
</script>

<div style:justify-content="center" class:cls class="submit-btn-div">
  <div class="setting-item-control">
    <button style:width="100%" type="submit" class="mod-cta" onclick={onSubmit}>
      {inner}
    </button>
  </div>
</div>

<style>
  .submit-btn-div {
    padding-top: var(--padding-top, 1rem);
  }
</style>
