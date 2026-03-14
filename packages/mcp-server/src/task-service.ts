import {
  type Note,
  type NoteFilters,
  type NoteId,
  type NoteService,
  type NoteVersion,
  normalizeTaskFrontmatter,
  type TaskFrontmatter,
  type TaskNote,
  TaskNoteService,
  toTaskNote,
  validateTaskFrontmatter,
} from '@orchard/core'

export interface TaskLinks {
  note: { scheme: 'obsidian'; path: string }
  base?: { scheme: 'obsidian'; path: string }
  folder?: { path: string }
}

export interface TaskSummary {
  id: NoteId
  title: string
  version: NoteVersion
  tags: string[]
  updatedAt: number
  status: string
  project: string | null
  due: string | null
  priority: string | null
  mcpSyncState: string | null
  links: TaskLinks
}

export interface TaskServiceOptions {
  noteService: NoteService
  taskFolder: string
  taskBaseFile: string | null
}

export interface TaskListFilters {
  tag?: string
  search?: string
  status?: string
  project?: string
}

export interface TaskCreateArgs {
  id: string
  title: string
  tags?: string[]
  frontmatter: Record<string, unknown>
}

export interface TaskUpdateArgs {
  id: string
  version: NoteVersion
  title?: string
  tags?: string[]
  frontmatter: Record<string, unknown>
}

export interface TaskTransitionArgs {
  id: string
  version: NoteVersion
  status: string
  project?: string | null
  due?: string | null
  priority?: string | null
  mcpSyncState?: string | null
}

export class TaskToolService {
  private readonly noteService: NoteService
  private readonly taskNotes: TaskNoteService
  private readonly taskFolder: string
  private readonly taskBaseFile: string | null
  private readonly taskFolderPrefix: string

  constructor(options: TaskServiceOptions) {
    this.noteService = options.noteService
    this.taskNotes = new TaskNoteService(this.noteService)
    this.taskFolder = options.taskFolder
    this.taskBaseFile = options.taskBaseFile
    this.taskFolderPrefix = this.taskFolder ? `${this.taskFolder}/` : ''
  }

  parseFrontmatter(value: unknown): TaskFrontmatter {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw {
        code: 'InvalidTaskFrontmatter',
        details: { message: 'Task frontmatter must be an object' },
      }
    }
    try {
      return validateTaskFrontmatter(value as Record<string, unknown>)
    } catch (error) {
      const message = (error as Error)?.message ?? 'InvalidTaskFrontmatter'
      throw {
        code: 'InvalidTaskFrontmatter',
        details: { message },
      }
    }
  }

  async list(filters: TaskListFilters = {}): Promise<TaskSummary[]> {
    const noteFilters: NoteFilters = {}
    if (filters.tag) noteFilters.tag = filters.tag
    if (filters.search) noteFilters.search = filters.search

    const tasks = await this.taskNotes.list(noteFilters)
    const withinFolder = tasks.filter((task) =>
      this.isWithinTaskFolder(task.id),
    )

    const statusFilter = filters.status?.trim().toLowerCase()
    const projectFilter = filters.project?.trim().toLowerCase()

    const subset = withinFolder.filter((task) => {
      if (
        statusFilter &&
        task.frontmatter.status.toLowerCase() !== statusFilter
      )
        return false
      if (projectFilter !== undefined && projectFilter !== '') {
        return (task.frontmatter.project ?? '').toLowerCase() === projectFilter
      }
      if (projectFilter === '') {
        return task.frontmatter.project == null
      }
      return true
    })

    return subset.map((task) => this.toSummary(task))
  }

  async create(args: TaskCreateArgs): Promise<TaskSummary> {
    const id = this.ensureTaskId(args.id)
    const frontmatter = this.parseFrontmatter(args.frontmatter)
    const created = await this.taskNotes.create({
      id,
      title: args.title,
      tags: args.tags,
      status: frontmatter.status,
      project: frontmatter.project,
      due: frontmatter.due,
      priority: frontmatter.priority,
      mcpSyncState: frontmatter.mcpSyncState,
    })
    return this.toSummary(created)
  }

  async update(args: TaskUpdateArgs): Promise<TaskSummary> {
    const id = this.ensureTaskId(args.id)
    const frontmatter = this.parseFrontmatter(args.frontmatter)
    const updated = await this.taskNotes.update(
      id,
      {
        title: args.title,
        tags: args.tags,
        status: frontmatter.status,
        project: frontmatter.project,
        due: frontmatter.due,
        priority: frontmatter.priority,
        mcpSyncState: frontmatter.mcpSyncState,
      },
      args.version,
    )
    return this.toSummary(updated)
  }

  async transition(args: TaskTransitionArgs): Promise<TaskSummary> {
    const id = this.ensureTaskId(args.id)
    const current = await this.taskNotes.read(id)
    if (!current) {
      throw { code: 'TaskNotFound' }
    }
    const normalized = normalizeTaskFrontmatter({
      status: args.status,
      project:
        args.project !== undefined ? args.project : current.frontmatter.project,
      due: args.due !== undefined ? args.due : current.frontmatter.due,
      priority:
        args.priority !== undefined
          ? args.priority
          : current.frontmatter.priority,
      mcpSyncState:
        args.mcpSyncState !== undefined
          ? args.mcpSyncState
          : current.frontmatter.mcpSyncState,
    })

    const updated = await this.taskNotes.update(
      id,
      {
        status: normalized.status,
        project: normalized.project,
        due: normalized.due,
        priority: normalized.priority,
        mcpSyncState: normalized.mcpSyncState,
      },
      args.version,
    )
    return this.toSummary(updated)
  }

  async read(id: NoteId): Promise<TaskNote | null> {
    return this.taskNotes.read(id)
  }

  tryConvertNote(note: Note): TaskSummary | null {
    if (!this.isWithinTaskFolder(note.id as NoteId)) return null
    try {
      const task = toTaskNote(note)
      return this.toSummary(task)
    } catch {
      return null
    }
  }

  isWithinTaskFolder(id: NoteId): boolean {
    if (!this.taskFolder) return true
    if (id === this.taskFolder) return true
    if (this.taskFolderPrefix && id.startsWith(this.taskFolderPrefix))
      return true
    return false
  }

  buildLinks(id: NoteId): TaskLinks {
    const links: TaskLinks = {
      note: { scheme: 'obsidian', path: id },
    }
    if (this.taskBaseFile) {
      links.base = { scheme: 'obsidian', path: this.taskBaseFile }
    }
    if (this.taskFolder) {
      links.folder = { path: this.taskFolder }
    }
    return links
  }

  toSummary(task: TaskNote): TaskSummary {
    return {
      id: task.id,
      title: task.title,
      version: task.version,
      tags: task.tags,
      updatedAt: task.updatedAt,
      status: task.frontmatter.status,
      project: task.frontmatter.project,
      due: task.frontmatter.due,
      priority: task.frontmatter.priority,
      mcpSyncState: task.frontmatter.mcpSyncState,
      links: this.buildLinks(task.id),
    }
  }

  private ensureTaskId(id: string): NoteId {
    const normalized = this.normalizeNoteId(id)
    if (normalized.includes('..')) {
      throw {
        code: 'TaskOutsideFolder',
        details: { folder: this.taskFolder || '', id: normalized },
      }
    }
    if (!this.isWithinTaskFolder(normalized)) {
      throw {
        code: 'TaskOutsideFolder',
        details: { folder: this.taskFolder || '', id: normalized },
      }
    }
    return normalized
  }

  private normalizeNoteId(id: string): NoteId {
    let normalized = id.trim()
    if (!normalized.endsWith('.md')) normalized = `${normalized}.md`
    normalized = normalized.replace(/\\+/g, '/')
    normalized = normalized.toLowerCase()
    return normalized as NoteId
  }
}
