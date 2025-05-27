<script lang="ts">
type SubmitButtonProps = {
  name?: string
  onSubmit: () => void
}

const { name, onSubmit }: SubmitButtonProps = $props()

const _inner = name || "Submit"
</script>

<div class="setting-item">
  <div class="setting-item-control">
    <button type="button" class="mod-cta" onclick={onSubmit}>
      {inner}
    </button>
  </div>
</div>

<style>
  div.setting-item {
    justify-content: center;
  }

  button {
    width: 100%;
  }
</style>
