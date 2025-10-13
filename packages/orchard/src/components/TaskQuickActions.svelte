<script lang="ts">
import {
  serializeTaskFrontmatter,
  type NoteId,
  type NoteVersion,
  type TaskFrontmatter,
  type TaskNote,
} from "@orchard/core"
import ModalContent from "@/components/primitives/ModalContent.svelte"
import DropdownSettingItem, {
  type DropdownItem,
} from "@/components/primitives/DropdownSettingItem.svelte"
import SettingItem from "@/components/primitives/SettingItem.svelte"
import TextSettingItem from "@/components/primitives/TextSettingItem.svelte"
import type { TaskSchema } from "@/services/task"

export type TaskQuickActionDetail = {
  noteId: NoteId
  version: NoteVersion
  status: string
  project: string | null
  due: string | null
  priority: string | null
  frontmatter: TaskFrontmatter
  body: string
}

type TaskQuickActionsProps = {
  task: TaskNote
  schema: TaskSchema
  defaultStatus?: string | null
  onSubmit: (detail: TaskQuickActionDetail) => void
}

const { task, schema, defaultStatus, onSubmit }: TaskQuickActionsProps = $props()

const fallbackStatus =
  schema.statuses[0] ?? task.frontmatter.status ?? "todo"
const statusItems: DropdownItem[] =
  schema.statuses.length > 0
    ? schema.statuses.map((status) => ({ label: status, value: status }))
    : [{ label: fallbackStatus, value: fallbackStatus }]

const fallbackPriority =
  schema.priorities[0] ?? task.frontmatter.priority ?? ""
const priorityItems: DropdownItem[] =
  schema.priorities.length > 0
    ? schema.priorities.map((priority) => ({ label: priority, value: priority }))
    : fallbackPriority
      ? [{ label: fallbackPriority, value: fallbackPriority }]
      : []

let status = $state(defaultStatus ?? fallbackStatus)
let project = $state(task.frontmatter.project ?? "")
let due = $state(task.frontmatter.due ?? "")
let priority = $state(
  task.frontmatter.priority ?? (priorityItems[0]?.value ?? ""),
)
let notes = $state((task.body ?? "").replace(/\s+$/u, ""))

$effect(() => {
  if (defaultStatus && defaultStatus !== status) {
    status = defaultStatus
  }
})

const quickSetStatus = (value: string) => {
  status = value
}

const handleSubmit = () => {
  const trimmedProject = project.trim()
  const trimmedDue = due.trim()
  const trimmedPriority = priority.trim()
  const trimmedNotes = notes.replace(/\s+$/u, "")

  const serialized = serializeTaskFrontmatter({
    status,
    project: trimmedProject || null,
    due: trimmedDue || null,
    priority: trimmedPriority || null,
    mcpSyncState: task.frontmatter.mcpSyncState ?? null,
  })

  const frontmatter = (serialized.frontmatter ?? {}) as TaskFrontmatter

  onSubmit({
    noteId: task.id,
    version: task.version,
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
  <SettingItem name="Quick Status" description="Common status presets">
    {#snippet controlItem()}
      <div class="status-grid">
        {#each statusItems.slice(0, 4) as item}
          <button
            type="button"
            class:active={item.value === status}
            class="status-chip"
            onclick={() => quickSetStatus(item.value)}
          >
            {item.label}
          </button>
        {/each}
      </div>
    {/snippet}
  </SettingItem>

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
    bind:value={project}
    placeholder="Optional project label"
    fullWidth
  />

  <SettingItem name="Due Date">
    {#snippet controlItem()}
      <input type="date" bind:value={due} style:width="100%" />
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
        placeholder="Add context or post-mortems"
      ></textarea>
    {/snippet}
  </SettingItem>
</ModalContent>

<style>
  .status-grid {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .status-chip {
    border: 1px solid var(--interactive-accent);
    background-color: transparent;
    border-radius: 9999px;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    color: var(--text-normal);
  }

  .status-chip.active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .task-notes {
    width: 100%;
    resize: vertical;
    min-height: 6rem;
  }
</style>
