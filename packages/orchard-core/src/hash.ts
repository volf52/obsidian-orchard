import { createHash } from "node:crypto"

// Deterministic version hash over sorted frontmatter keys + body
export function computeNoteVersion(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const h = createHash("sha256")
  const keys = Object.keys(frontmatter).sort()
  for (const k of keys) {
    const v = frontmatter[k]
    h.update(k)
    h.update(":")
    h.update(JSON.stringify(v))
    h.update("\n")
  }
  h.update("\n\n")
  h.update(body.replace(/\r\n/g, "\n"))
  return h.digest("hex")
}
