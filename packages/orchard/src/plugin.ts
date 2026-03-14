import { type Command, Plugin } from 'obsidian'
import type { TaskService } from '@/services/task'
import type { OrchardServices } from '@/services/utils'
import type { OrchardSettings } from '@/settings/types'
import { ICON, ORCHAR_RSB_VIEW_TYPE } from '@/constants'
import { migrateTaskNotes } from '@/modules/task-migration'
import './styles.css'
import './components/svelte.css'
import TaskModule from '@/modules/task.module'
import VideoModule from '@/modules/video.module'
import RightSidebarView from '@/right-sidebar-view'
import { createObsidianVaultAdapter } from '@/services/note-adapter'
import { wireUpServices } from '@/services/utils'
import OrchardSettingsTab, { DEFAULT_SETTINGS } from '@/settings'
import {
  clearAllSubscriptions,
  initializeSettingsStore,
  updateSettings,
} from '@/stores/settings'
import {
  createEventBus,
  type EventBus,
  type InlineTaskService,
  NoteService,
  type TaskNoteService,
} from '@orchard/core'
import TranscriptionModule from './modules/transcribe.module'

class Orchard extends Plugin {
  settings!: OrchardSettings
  services!: OrchardServices

  videoModule!: VideoModule
  transcriptionModule!: TranscriptionModule
  taskModule!: TaskModule

  noteService!: NoteService
  taskService!: TaskService
  taskNotes!: TaskNoteService
  inlineTasks!: InlineTaskService
  events!: EventBus

  override async onload(): Promise<void> {
    await this.loadSettings()

    // Initialize the signal-based settings store
    initializeSettingsStore(this.settings)

    // Core note service wiring
    const adapter = createObsidianVaultAdapter(this.app.vault)
    const events = createEventBus()
    this.events = events
    this.noteService = new NoteService({ adapter, events })

    this.services = wireUpServices(this.settings, {
      noteService: this.noteService,
    })

    this.taskService = this.services.tasks
    this.taskNotes = this.taskService.taskNotes
    this.inlineTasks = this.taskService.inlineTasks

    this.videoModule = new VideoModule(this.app, this.settings, this.services)
    this.transcriptionModule = new TranscriptionModule(
      this.app,
      this.settings,
      this.services,
    )
    this.taskModule = new TaskModule(this.app, this.settings, this.services)

    await migrateTaskNotes(this.app, this.taskNotes, this.inlineTasks)

    this.addRibbonIcon(ICON, 'Open Orchard', (_evt) => {
      this.activateView()
    })

    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Orchard");

    this.addSettingTab(new OrchardSettingsTab(this.app, this))
    await this.registerCommands()

    this.registerView(ORCHAR_RSB_VIEW_TYPE, (leaf) => {
      return new RightSidebarView(leaf, this)
    })
  }

  private async registerCommands() {
    const commands: Command[] = [
      {
        id: 'orchard-open',
        name: 'Open Orchard',
        callback: () => this.activateView(),
      },
      {
        id: 'orchard-create-test-note',
        name: 'Create Test Orchard Note',
        callback: async () => {
          try {
            const note = await this.noteService.create({
              id: 'Orchard Test',
              body: 'Hello from Orchard core',
            })
            console.log('Created test note', note.id)
          } catch (err) {
            console.error('Failed to create test note', err)
          }
        },
      },
      {
        id: 'orchard-list-notes-log',
        name: 'List Orchard Notes (log)',
        callback: async () => {
          const notes = await this.noteService.list()
          console.log(
            'Orchard notes:',
            notes.map((n: { id: string; version: string }) => ({
              id: n.id,
              v: n.version.slice(0, 8),
            })),
          )
        },
      },
    ]

    const videoCommands = await this.videoModule.registerCommands()
    commands.push(...videoCommands)

    const transcriptionCommands =
      await this.transcriptionModule.registerCommands()
    commands.push(...transcriptionCommands)

    const taskCommands = await this.taskModule.registerCommands()
    commands.push(...taskCommands)

    // this.addCommand({
    //   id: "orchard-picker",
    //   name: "Insert latex snippet",
    //   checkCallback: (checking) => {
    //     const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    //
    //     if (view) {
    //       if (!checking) {
    //         new OrchardModal(this.app).open()
    //       }
    //
    //       return true
    //     }
    //
    //     return false
    //   },
    // })

    // this.addCommand({
    //   id: "orchard-recenter",
    //   name: "Recenter",
    //   callback: () => {
    //     this.centerView()
    //   },
    // })

    for (const cmd of commands) {
      this.addCommand(cmd)
    }
  }

  override onunload() {
    clearAllSubscriptions()
  }

  private async loadSettings() {
    const loadedSettings = await this.loadData()

    const settings = {
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
    }

    this.settings = settings
  }

  async saveSettings() {
    updateSettings(this.settings)
    await this.saveData(this.settings)
  }

  async activateView() {
    const leaf = await RightSidebarView.getOrCreateLeaf(this.app)
    if (!leaf) return
    await this.app.workspace.revealLeaf(leaf)
  }
}

export default Orchard
