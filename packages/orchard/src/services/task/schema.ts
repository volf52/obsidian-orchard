import type {
  OrchardSettings,
  TaskPriorityId,
  TaskProjectGroupSetting,
  TaskStatusId,
} from "@/settings/types"

export interface TaskSchema {
  folder: string
  baseFile: string
  statuses: TaskStatusId[]
  priorities: TaskPriorityId[]
  projectGroups: TaskProjectGroupSetting[]
}

export const createTaskSchema = (settings: OrchardSettings): TaskSchema => {
  return {
    folder: normalizeFolder(settings.taskFolder),
    baseFile: normalizeBaseFile(settings.taskBaseFile),
    statuses: dedupe(normalizeList(settings.taskStatuses)),
    priorities: dedupe(normalizeList(settings.taskPriorityDefinitions)),
    projectGroups: normalizeGroups(settings.taskProjectGroups),
  }
}

const normalizeFolder = (folder: string): string => {
  const trimmed = folder.trim()
  if (!trimmed) return "tasks"
  return trimmed.replace(/^\/+|\/+$/g, "")
}

const normalizeBaseFile = (baseFile: string): string => {
  const trimmed = baseFile.trim()
  if (!trimmed) return ".obsidian/bases/orchard-tasks.base.json"
  return trimmed.replace(/^\/+/, "")
}

const normalizeList = (values: string[] | undefined | null): string[] => {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => (typeof value === "string" ? value.trim() : String(value)))
    .filter((value) => value.length > 0)
}

const normalizeGroups = (
  groups: TaskProjectGroupSetting[] | undefined,
): TaskProjectGroupSetting[] => {
  if (!Array.isArray(groups)) return []
  const normalized: TaskProjectGroupSetting[] = []
  for (const group of groups) {
    const id = typeof group.id === "string" ? group.id.trim() : ""
    const name = typeof group.name === "string" ? group.name.trim() : ""
    if (!id || !name) continue
    normalized.push({
      id,
      name,
      statuses: dedupe(normalizeList(group.statuses)),
    })
  }
  return normalized
}

const dedupe = <T extends string>(values: T[]): T[] => {
  return Array.from(new Set(values)) as T[]
}
