import type { NoteId, VaultAdapter, VaultAdapterFileInfo } from "@orchard/core"
import { TFile, type Vault } from "obsidian"

function normalize(id: string): NoteId {
  let n = id.trim()
  if (!n.endsWith(".md")) n = `${n}.md`
  n = n.replace(/\\+/g, "/").toLowerCase()
  return n as NoteId
}

export function createObsidianVaultAdapter(vault: Vault): VaultAdapter {
  return {
    async readFile(id: NoteId) {
      const file = vault.getAbstractFileByPath(id)
      if (file instanceof TFile && file.extension === "md") {
        return vault.read(file)
      }
      const t = vault.getAbstractFileByPath(normalize(id))
      if (t instanceof TFile) return vault.read(t)
      return null
    },
    async writeFile(id: NoteId, data: string) {
      const existing = vault.getAbstractFileByPath(id)
      if (existing instanceof TFile) {
        await vault.modify(existing, data)
        return
      }
      await vault.create(id, data)
    },
    async fileInfo(id: NoteId) {
      const file = vault.getAbstractFileByPath(id)
      if (!(file instanceof TFile)) return null
      return {
        id,
        mtime: file.stat.mtime,
        size: file.stat.size,
      } satisfies VaultAdapterFileInfo
    },
    async list() {
      const files = vault
        .getFiles()
        .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
      return files.map((f) => ({
        id: f.path as NoteId,
        mtime: f.stat.mtime,
        size: f.stat.size,
      }))
    },
    async deleteFile(id: NoteId) {
      const file = vault.getAbstractFileByPath(id)
      if (!(file instanceof TFile)) return false
      await vault.delete(file)
      return true
    },
  }
}
