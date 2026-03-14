import type { OrchardSettings } from '@/settings/types'
import type { NoteService } from '@orchard/core'
import { createTaskSchema, TaskService } from '@/services/task'
import { YoutubeApiService } from './video'

type ServiceDeps = {
  noteService: NoteService
}

export const wireUpServices = (
  settings: OrchardSettings,
  deps: ServiceDeps,
) => {
  const youtubeService = new YoutubeApiService(settings.googleApiKey)
  const taskSchema = createTaskSchema(settings)
  const taskService = new TaskService(deps.noteService, taskSchema)

  return {
    youtube: youtubeService,
    notes: deps.noteService,
    tasks: taskService,
  } as const
}

export type OrchardServices = ReturnType<typeof wireUpServices>
