<script lang="ts">
import { serializeTaskFrontmatter, type TaskFrontmatter } from "@orchard/core"
import ModalContent from "@/components/primitives/ModalContent.svelte"
import DropdownSettingItem, {
  type DropdownItem,
} from "@/components/primitives/DropdownSettingItem.svelte"
import SettingItem from "@/components/primitives/SettingItem.svelte"
import TextSettingItem from "@/components/primitives/TextSettingItem.svelte"
import type { TaskSchema } from "@/services/task"

export type TaskModalSubmitDetail = {
  title: string
  status: string
  project: string | null
  due: string | null
  priority: string | null
  frontmatter: TaskFrontmatter
  body: string
}

type TaskModalProps = {
  schema: TaskSchema
  onSubmit: (detail: TaskModalSubmitDetail) => void
}

const { schema, onSubmit }: TaskModalProps = $props()

const initialStatus = schema.statuses[0] ?? "todo"
const statusItems: DropdownItem[] =
  schema.statuses.length > 0
    ? schema.statuses.map((status) => ({ label: status, value: status }))
    : [{ label: initialStatus, value: initialStatus }]

const initialPriority = schema.priorities[0] ?? ""
const priorityItems: DropdownItem[] =
  schema.priorities.length > 0
    ? schema.priorities.map((priority) => ({ label: priority, value: priority }))
    : initialPriority
      ? [{ label: initialPriority, value: initialPriority }]
      : []

let title = $state("")
let status = $state(initialStatus)
let project = $state("")
let due = $state("")
let priority = $state(initialPriority)
let notes = $state("")

const handleSubmit = () => {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return
  }

  const trimmedProject = project.trim()
  const trimmedDue = due.trim()
  const trimmedPriority = priority.trim()
  const trimmedNotes = notes.replace(/\s+$/u, "")

  const serialized = serializeTaskFrontmatter({
    status,
    project: trimmedProject || null,
    due: trimmedDue || null,
    priority: trimmedPriority || null,
    mcpSyncState: null,
  })

  const frontmatter = (serialized.frontmatter ?? {}) as TaskFrontmatter

  onSubmit({
    title: trimmedTitle,
    status,
    project: trimmedProject || null,
    due: trimmedDue || null,
    priority: trimmedPriority || null,
    frontmatter,
    body: trimmedNotes,
  })
}
</script>

<ModalContent onSubmit={handleSubmit}>
  <TextSettingItem
    name="Title"
    placeholder="What needs to get done?"
    bind:value={title}
    fullWidth
  />

  <DropdownSettingItem
    name="Status"
    value={status}
    items={statusItems}
    isPromise={false}
    onChange={(value) => {
      status = value
    }}
  />

  <TextSettingItem
    name="Project"
    placeholder="Optional project label"
    bind:value={project}
    fullWidth
  />

  <SettingItem name="Due Date">
    {#snippet controlItem()}
      <input
        type="date"
        bind:value={due}
        style:width="100%"
      />
    {/snippet}
  </SettingItem>

  {#if priorityItems.length > 0}
    <DropdownSettingItem
      name="Priority"
      value={priority}
      items={priorityItems}
      isPromise={false}
      onChange={(value) => {
        priority = value
      }}
    />
  {/if}

  <SettingItem name="Notes">
    {#snippet controlItem()}
      <textarea
        bind:value={notes}
        rows={4}
        class="task-notes"
        placeholder="Add extra context or links"
      ></textarea>
    {/snippet}
  </SettingItem>
</ModalContent>

<style>
  .task-notes {
    width: 100%;
    resize: vertical;
    min-height: 6rem;
  }
</style>
