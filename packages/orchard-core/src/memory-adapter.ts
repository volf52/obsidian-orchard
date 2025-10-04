import type { NoteId, VaultAdapter, VaultAdapterFileInfo } from "./types"

interface Entry {
  data: string
  mtime: number
}

export function createMemoryAdapter(): VaultAdapter {
  const store = new Map<NoteId, Entry>()
  return {
    async readFile(id: NoteId): Promise<string | null> {
      const e = store.get(id)
      return e ? e.data : null
    },
    async writeFile(id: NoteId, data: string): Promise<void> {
      store.set(id, { data, mtime: Date.now() })
    },
    async fileInfo(id: NoteId): Promise<VaultAdapterFileInfo | null> {
      const e = store.get(id)
      if (!e) return null
      return {
        id,
        mtime: e.mtime,
        size: e.data.length,
      } satisfies VaultAdapterFileInfo
    },
    async list(): Promise<VaultAdapterFileInfo[]> {
      const out: VaultAdapterFileInfo[] = []
      for (const [id, e] of store.entries()) {
        out.push({ id, mtime: e.mtime, size: e.data.length })
      }
      return out
    },
    async deleteFile(id: NoteId): Promise<boolean> {
      return store.delete(id)
    },
  }
}
