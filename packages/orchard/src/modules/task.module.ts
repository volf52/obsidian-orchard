import type { App, Command } from 'obsidian'
import { TFile } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { TaskService } from '@/services/task'
import type { OrchardServices } from '@/services/utils'
import type { OrchardSettings } from '@/settings/types'
import type { NoteId, TaskNote } from '@orchard/core'
import TaskModal, {
  type TaskModalSubmitDetail,
} from '@/components/TaskModal.svelte'
import TaskQuickActions, {
  type TaskQuickActionDetail,
} from '@/components/TaskQuickActions.svelte'
import { notifyErr, notifySuccess } from '@/notify'
import BetterModal from '@/obsidian-extended/better-modal'

class TaskModule {
  readonly app: App
  readonly tasks: TaskService

  constructor(app: App, _settings: OrchardSettings, services: OrchardServices) {
    this.app = app
    this.tasks = services.tasks
  }

  async registerCommands(): Promise<Command[]> {
    const commands: Command[] = []

    commands.push({
      id: 'orchard-task-create',
      name: 'Create Task',
      callback: () => {
        void this.openCreateTaskModal()
      },
    })

    commands.push({
      id: 'orchard-task-mark-done',
      name: 'Mark Task Done',
      callback: () => {
        void this.markTaskDone()
      },
    })

    commands.push({
      id: 'orchard-task-open-base',
      name: 'Open Task Base',
      callback: () => {
        void this.openTaskBase()
      },
    })

    return commands
  }

  private async openCreateTaskModal(): Promise<void> {
    const modal = new BetterModal(this.app, 'Create Orchard Task')

    const component = mount(TaskModal, {
      target: modal.contentEl,
      props: {
        schema: this.tasks.schema,
        onSubmit: async (detail: TaskModalSubmitDetail) => {
          modal.disableClose()
          try {
            const task = await this.tasks.createTask(this.app.vault, {
              title: detail.title,
              frontmatter: detail.frontmatter,
              body: detail.body,
            })
            await this.openTaskNote(task)
            notifySuccess('Task created')
            modal.enableClose(true)
            modal.close()
          } catch (err) {
            notifyErr('Failed to create task', err)
            modal.enableClose(true)
          }
        },
      },
    })

    modal.registerOnClose(async () => {
      await unmount(component)
    })

    modal.open()
  }

  private async markTaskDone(): Promise<void> {
    const task = await this.getActiveTask()
    if (!task) {
      notifyErr('Open a task note before running this command')
      return
    }

    await this.openQuickActions(
      task,
      this.resolveDoneStatus(task.frontmatter.status),
    )
  }

  private async openQuickActions(
    task: TaskNote,
    doneStatus: string,
  ): Promise<void> {
    const modal = new BetterModal(this.app, 'Update Task')

    const component = mount(TaskQuickActions, {
      target: modal.contentEl,
      props: {
        task,
        schema: this.tasks.schema,
        defaultStatus: doneStatus,
        onSubmit: async (detail: TaskQuickActionDetail) => {
          modal.disableClose()
          try {
            const updated = await this.tasks.updateTask(
              this.app.vault,
              detail.noteId,
              detail.version,
              {
                frontmatter: detail.frontmatter,
                body: detail.body,
              },
            )
            await this.openTaskNote(updated)
            notifySuccess('Task updated')
            modal.enableClose(true)
            modal.close()
          } catch (err) {
            notifyErr('Failed to update task', err)
            modal.enableClose(true)
          }
        },
      },
    })

    modal.registerOnClose(async () => {
      await unmount(component)
    })

    modal.open()
  }

  private resolveDoneStatus(current: string): string {
    const statuses = this.tasks.schema.statuses
    const done = statuses.find((status) => status.toLowerCase() === 'done')
    if (done) return done
    return statuses[statuses.length - 1] ?? current
  }

  private async openTaskBase(): Promise<void> {
    try {
      await this.tasks.refreshBaseDefinition(this.app.vault)
      const source = this.app.workspace.getActiveFile()?.path ?? ''
      await Promise.resolve(
        this.app.workspace.openLinkText(
          this.tasks.schema.baseFile,
          source,
          false,
        ),
      )
    } catch (err) {
      notifyErr('Failed to open Orchard task base', err)
    }
  }

  private async getActiveTask(): Promise<TaskNote | null> {
    const file = this.app.workspace.getActiveFile()
    if (!file) return null
    return this.tasks.loadTask(file.path as NoteId)
  }

  private async openTaskNote(task: TaskNote): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.id)
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(true)
      await leaf.openFile(file)
      return
    }
    await Promise.resolve(this.app.workspace.openLinkText(task.id, '', false))
  }
}

export default TaskModule
