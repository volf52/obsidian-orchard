export type TaskStatusId = string & {}

export type TaskPriorityId = string & {}

export interface TaskProjectGroupSetting {
  id: string
  name: string
  statuses: TaskStatusId[]
}

export type OrchardSettings = {
  googleApiKey: string
  videoNoteFolder: string
  taskFolder: string
  taskBaseFile: string
  taskStatuses: TaskStatusId[]
  taskPriorityDefinitions: TaskPriorityId[]
  taskProjectGroups: TaskProjectGroupSetting[]
}
