export type NoteId = string // normalized relative path, lowercase, with .md
export type NoteVersion = string // hex sha256

export interface NoteMeta {
  id: NoteId
  title: string
  tags: string[]
  updatedAt: number // epoch ms
}

export interface NoteContent {
  frontmatter: Record<string, unknown>
  body: string // markdown body without frontmatter block
}

export interface Note extends NoteMeta, NoteContent {
  version: NoteVersion
}

export interface NoteFilters {
  tag?: string
  search?: string // naive substring search for MVP
}

export interface CreateNoteInput extends Omit<NoteContent, 'frontmatter'> {
  id: NoteId
  title?: string
  frontmatter?: Record<string, unknown>
  tags?: string[]
}

export interface UpdateNoteMutation {
  title?: string
  body?: string
  frontmatter?: Record<string, unknown>
  tags?: string[]
}

export interface VaultAdapterFileInfo {
  id: NoteId
  mtime: number // ms
  size: number
}

export interface VaultAdapter {
  readFile(id: NoteId): Promise<string | null>
  writeFile(id: NoteId, data: string): Promise<void>
  fileInfo(id: NoteId): Promise<VaultAdapterFileInfo | null>
  list(): Promise<VaultAdapterFileInfo[]>
  deleteFile(id: NoteId): Promise<boolean>
}

export type NoteEvent =
  | { type: 'note.created'; note: Note }
  | { type: 'note.updated'; note: Note; previousVersion: NoteVersion }
  | { type: 'note.deleted'; id: NoteId; previousVersion: NoteVersion }

export interface EventBus {
  publish(event: NoteEvent): void
  subscribe(handler: (event: NoteEvent) => void): () => void
}
