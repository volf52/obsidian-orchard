<script lang="ts">
  import type { OrchardSettings } from "@/settings/types";
  import DropdownSettingItem, {
    type DropdownSettingItemProps,
  } from "./primitives/DropdownSettingItem.svelte";
  import SettingHeading from "./primitives/SettingHeading.svelte";
  import SubmitButton from "./primitives/SubmitButton.svelte";
  import TextSettingItem from "./primitives/TextSettingItem.svelte";

  type SettingsPageProps = {
    heading: string;
    initialSettings: OrchardSettings;
    dropdownItems: DropdownSettingItemProps["items"];
    onSubmit: (newSettings: OrchardSettings) => void;
  };

  const {
    heading,
    initialSettings,
    dropdownItems,
    onSubmit,
  }: SettingsPageProps = $props();

  let apiKey = $state(initialSettings.googleApiKey);
  let videoNoteFolder = $state(initialSettings.videoNoteFolder);

  const handleSubmit = () => {
    const newSettings: OrchardSettings = {
      googleApiKey: apiKey,
      videoNoteFolder: videoNoteFolder,
    };

    onSubmit(newSettings);
  };
</script>

<SettingHeading {heading} />
<TextSettingItem
  name="Google API Key"
  description="For fetching video and book data"
  ariaLabel="Hehe"
  bind:value={apiKey}
/>
<DropdownSettingItem
  name="Video Notes Folder"
  bind:value={videoNoteFolder}
  items={dropdownItems}
/>

<SubmitButton
  --padding-top="2rem"
  name="Save Settings"
  onSubmit={handleSubmit}
/>
