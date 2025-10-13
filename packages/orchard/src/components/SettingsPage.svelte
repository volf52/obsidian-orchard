<script lang="ts">
import type { OrchardSettings } from "@/settings/types"
import DropdownSettingItem, {
  type DropdownItem,
} from "./primitives/DropdownSettingItem.svelte"
import SettingHeading from "./primitives/SettingHeading.svelte"
import SubmitButton from "./primitives/SubmitButton.svelte"
import TextSettingItem from "./primitives/TextSettingItem.svelte"
import MultiSelectSettingItem, {
  type MultiSelectOption,
} from "./primitives/MultiSelectSettingItem.svelte"
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/settings/presets"

type SettingsPageProps = {
  heading: string
  initialSettings: OrchardSettings
  dropdownItems: DropdownItem[]
  onSubmit: (newSettings: OrchardSettings) => void
}

const { heading, initialSettings, dropdownItems, onSubmit }: SettingsPageProps =
  $props()

let apiKey = $state(initialSettings.googleApiKey)
let videoNoteFolder = $state(initialSettings.videoNoteFolder)
let taskFolder = $state(initialSettings.taskFolder)
let taskBaseFile = $state(initialSettings.taskBaseFile)
let taskStatuses = $state([...initialSettings.taskStatuses])
let taskPriorities = $state([...initialSettings.taskPriorityDefinitions])

const statusOptions: MultiSelectOption[] = TASK_STATUS_OPTIONS.map((option) => ({
  label: option.label,
  value: option.id,
  description: option.description,
}))

const priorityOptions: MultiSelectOption[] = TASK_PRIORITY_OPTIONS.map((option) => ({
  label: option.label,
  value: option.id,
  description: option.description,
}))

const handleSubmit = () => {
  const newSettings: OrchardSettings = {
    ...initialSettings,
    googleApiKey: apiKey,
    videoNoteFolder: videoNoteFolder,
    taskFolder,
    taskBaseFile,
    taskStatuses: [...taskStatuses],
    taskPriorityDefinitions: [...taskPriorities],
  }

  onSubmit(newSettings)
}
</script>

<SettingHeading {heading} />
<TextSettingItem
  name="Google API Key"
  description="For fetching video and book data"
  ariaLabel="Google API key input"
  bind:value={apiKey}
/>
<DropdownSettingItem
  name="Video Notes Folder"
  bind:value={videoNoteFolder}
  isPromise={false}
  items={dropdownItems}
  description="Folder where imported video notes will be stored."
/>

<SettingHeading heading="Tasks" />

<DropdownSettingItem
  name="Task Folder"
  bind:value={taskFolder}
  isPromise={false}
  items={dropdownItems}
  description="Folder where Orchard will create task notes."
  ariaLabel="Select the folder that will contain Orchard task notes"
/>

<TextSettingItem
  name="Task Base File"
  bind:value={taskBaseFile}
  description="Relative path to the Dataview base definition for tasks."
  ariaLabel="Task base file"
  fullWidth
/>

<MultiSelectSettingItem
  name="Default Task Statuses"
  bind:value={taskStatuses}
  options={statusOptions}
  description="Statuses made available when creating new Orchard tasks."
/>

<MultiSelectSettingItem
  name="Priority Definitions"
  bind:value={taskPriorities}
  options={priorityOptions}
  description="Priorities that can be assigned to tasks by default."
/>

<SubmitButton
  --padding-top="2rem"
  name="Save Settings"
  onSubmit={handleSubmit}
/>
