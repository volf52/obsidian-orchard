const FILENAME_FORBID_CHARS = /[*/\\<>:|?"']/g
export const cleanTitle = (title: string) =>
  title.replace(FILENAME_FORBID_CHARS, "_")

export const cleanTag = (tag: string) =>
  tag.trim().replaceAll("&", "_").replaceAll(" ", "-").toLowerCase()

/**
 * Converts a JSON object to YAML frontmatter format
 * @param data - The object to convert to frontmatter
 * @returns Formatted YAML frontmatter string with --- delimiters
 */
export const jsonToMdFrontmatter = <T extends Record<string, unknown>>(
  data: T,
): string => {
  if (!data || Object.keys(data).length === 0) {
    return ""
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "null"
    }

    if (typeof value === "string") {
      // Escape strings that contain special YAML characters
      if (
        value.includes(":") ||
        value.includes("#") ||
        value.includes("'") ||
        value.includes('"')
      ) {
        return `"${value.replace(/"/g, '\\"')}"`
      }
      return value
    }

    if (typeof value === "boolean" || typeof value === "number") {
      return String(value)
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]"
      return `[${value.map((item) => formatValue(item)).join(", ")}]`
    }

    if (typeof value === "object") {
      // For nested objects, format as YAML nested structure
      const nestedEntries = Object.entries(value as Record<string, unknown>)
      if (nestedEntries.length === 0) return "{}"

      // Simple inline format for small objects
      if (
        nestedEntries.length <= 3 &&
        nestedEntries.every(
          ([_k, v]) =>
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean",
        )
      ) {
        return `{ ${nestedEntries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(", ")} }`
      }

      // For complex objects, we'll need proper indentation
      // For now, fall back to JSON for deep nesting to avoid complexity
      return JSON.stringify(value)
    }

    return String(value)
  }

  const yamlLines = Object.entries(data).map(([key, value]) => {
    return `${key}: ${formatValue(value)}`
  })

  return `---\n${yamlLines.join("\n")}\n---\n`
}
