import { createHash } from "node:crypto"

/**
 * Compute a deterministic SHA-256 hex digest from the note's frontmatter and body.
 *
 * The hash is computed by iterating sorted frontmatter keys, hashing each key followed
 * by a colon, the JSON-serialized value, and a newline; then hashing two newlines
 * and the body after normalizing CRLF to LF.
 *
 * @param frontmatter - Mapping of frontmatter keys to their values
 * @param body - Note body text (line endings will be normalized to LF)
 * @returns The resulting SHA-256 digest as a hexadecimal string
 */
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