import type { TaskPriorityId, TaskStatusId } from '@/settings/types'

export interface TaskOptionPreset {
  id: TaskStatusId | TaskPriorityId
  label: string
  description?: string
}

export const TASK_STATUS_OPTIONS: TaskOptionPreset[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'waiting', label: 'Waiting / Blocked' },
  { id: 'done', label: 'Done' },
] satisfies TaskOptionPreset[]

export const TASK_PRIORITY_OPTIONS: TaskOptionPreset[] = [
  { id: 'p0', label: 'P0 – Urgent' },
  { id: 'p1', label: 'P1 – High' },
  { id: 'p2', label: 'P2 – Medium' },
  { id: 'p3', label: 'P3 – Low' },
] satisfies TaskOptionPreset[]

export const DEFAULT_TASK_STATUSES = TASK_STATUS_OPTIONS.map(
  (option) => option.id as TaskStatusId,
)

export const DEFAULT_TASK_PRIORITIES = TASK_PRIORITY_OPTIONS.map(
  (option) => option.id as TaskPriorityId,
)
