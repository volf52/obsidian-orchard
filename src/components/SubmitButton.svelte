<script lang="ts">
  type SubmitButtonProps = {
    name?: string;
    onSubmit: () => void;
  };

  const { name, onSubmit }: SubmitButtonProps = $props();

  const inner = name || "Submit";
</script>

<div style:justify-content="center">
  <div class="setting-item-control">
    <button style:width="100%" type="submit" class="mod-cta" onclick={onSubmit}>
      {inner}
    </button>
  </div>
</div>
