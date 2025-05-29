<script lang="ts">
  import SettingItem from "./SettingItem.svelte";

  type SettingHeadingProps = {
    heading: string;
  };

  const { heading }: SettingHeadingProps = $props();
</script>

<SettingItem name={heading} cls="setting-item-heading" removeCtrl />
