import { describe, expect, test } from "bun:test"
import { cleanTag, cleanTitle, jsonToMdFrontmatter } from "./utils"

describe("jsonToMdFrontmatter", () => {
  test("should return empty string for empty object", () => {
    expect(jsonToMdFrontmatter({})).toBe("")
  })

  test("should return empty string for null/undefined", () => {
    expect(
      jsonToMdFrontmatter(null as unknown as Record<string, unknown>),
    ).toBe("")
    expect(
      jsonToMdFrontmatter(undefined as unknown as Record<string, unknown>),
    ).toBe("")
  })

  test("should format simple string properties", () => {
    const input = { title: "My Note", author: "John Doe" }
    const expected = "---\ntitle: My Note\nauthor: John Doe\n---\n"
    expect(jsonToMdFrontmatter(input)).toBe(expected)
  })

  test("should format number and boolean properties", () => {
    const input = { count: 42, published: true, rating: 4.5, draft: false }
    const expected =
      "---\ncount: 42\npublished: true\nrating: 4.5\ndraft: false\n---\n"
    expect(jsonToMdFrontmatter(input)).toBe(expected)
  })

  test("should handle null and undefined values", () => {
    const input = { nullable: null, undefinedVal: undefined }
    const expected = "---\nnullable: null\nundefinedVal: null\n---\n"
    expect(jsonToMdFrontmatter(input)).toBe(expected)
  })

  test("should escape strings with special YAML characters", () => {
    const input = {
      title: "Note: Important",
      description: 'This is a "quoted" string',
      comment: "Has # hash",
      quote: "Has 'single' quotes",
    }
    const result = jsonToMdFrontmatter(input)

    expect(result).toContain('title: "Note: Important"')
    expect(result).toContain('description: "This is a \\"quoted\\" string"')
    expect(result).toContain('comment: "Has # hash"')
    expect(result).toContain("quote: \"Has 'single' quotes\"")
  })

  test("should not escape simple strings", () => {
    const input = { title: "Simple Title", name: "John" }
    const result = jsonToMdFrontmatter(input)

    expect(result).toContain("title: Simple Title")
    expect(result).toContain("name: John")
  })

  test("should format empty arrays", () => {
    const input = { tags: [], categories: [] }
    const expected = "---\ntags: []\ncategories: []\n---\n"
    expect(jsonToMdFrontmatter(input)).toBe(expected)
  })

  test("should format arrays with primitive values", () => {
    const input = {
      tags: ["work", "important", "project"],
      numbers: [1, 2, 3],
      flags: [true, false, true],
    }
    const result = jsonToMdFrontmatter(input)

    expect(result).toContain("tags: [work, important, project]")
    expect(result).toContain("numbers: [1, 2, 3]")
    expect(result).toContain("flags: [true, false, true]")
  })

  test("should format arrays with strings requiring escaping", () => {
    const input = { tags: ["work: urgent", "note #1", 'has "quotes"'] }
    const result = jsonToMdFrontmatter(input)

    expect(result).toContain(
      'tags: ["work: urgent", "note #1", "has \\"quotes\\""]',
    )
  })

  test("should format empty objects", () => {
    const input = { metadata: {}, config: {} }
    const expected = "---\nmetadata: {}\nconfig: {}\n---\n"
    expect(jsonToMdFrontmatter(input)).toBe(expected)
  })

  test("should format simple inline objects", () => {
    const input = {
      author: { name: "John", age: 30 },
      settings: { theme: "dark", notifications: true, count: 5 },
    }
    const result = jsonToMdFrontmatter(input)

    expect(result).toContain("author: { name: John, age: 30 }")
    expect(result).toContain(
      "settings: { theme: dark, notifications: true, count: 5 }",
    )
  })

  test("should use JSON for complex objects", () => {
    const input = {
      complex: {
        nested: { deep: { value: "test" } },
        array: [1, 2, 3],
      },
      largeObject: { a: 1, b: 2, c: 3, d: 4, e: 5 }, // More than 3 properties
    }
    const result = jsonToMdFrontmatter(input)

    // Complex nested object should be JSON
    expect(result).toContain(
      'complex: {"nested":{"deep":{"value":"test"}},"array":[1,2,3]}',
    )
    // Large object should be JSON
    expect(result).toContain('largeObject: {"a":1,"b":2,"c":3,"d":4,"e":5}')
  })

  test("should handle mixed data types", () => {
    const input = {
      title: "Mixed Content",
      count: 42,
      active: true,
      tags: ["work", "important"],
      metadata: { type: "note", priority: "high" },
      nullable: null,
    }
    const result = jsonToMdFrontmatter(input)

    expect(result).toContain("title: Mixed Content")
    expect(result).toContain("count: 42")
    expect(result).toContain("active: true")
    expect(result).toContain("tags: [work, important]")
    expect(result).toContain("metadata: { type: note, priority: high }")
    expect(result).toContain("nullable: null")
    expect(result.startsWith("---\n")).toBe(true)
    expect(result.endsWith("\n---\n")).toBe(true)
  })

  test("should handle nested arrays", () => {
    const input = {
      matrix: [
        [1, 2],
        [3, 4],
      ],
      mixed: ["string", 42, true, ["nested", "array"]],
    }
    const result = jsonToMdFrontmatter(input)

    // Nested arrays should be formatted recursively
    expect(result).toContain("matrix: [[1, 2], [3, 4]]")
    expect(result).toContain("mixed: [string, 42, true, [nested, array]]")
  })

  test("should handle objects with string keys that need escaping", () => {
    const input = {
      config: { "key:with:colons": "value", "key#with#hash": "another" },
    }
    const result = jsonToMdFrontmatter(input)

    // The object has special characters in the key names but only 2 properties with simple values,
    // so it will be formatted as inline YAML (keys aren't escaped in this case)
    expect(result).toContain(
      "config: { key:with:colons: value, key#with#hash: another }",
    )
  })
})

describe("cleanTitle", () => {
  test("should remove forbidden filename characters", () => {
    expect(cleanTitle("file*name")).toBe("file_name")
    expect(cleanTitle("file/name")).toBe("file_name")
    expect(cleanTitle("file\\name")).toBe("file_name")
    expect(cleanTitle("file<name>")).toBe("file_name_")
    expect(cleanTitle("file:name")).toBe("file_name")
    expect(cleanTitle("file|name")).toBe("file_name")
    expect(cleanTitle("file?name")).toBe("file_name")
    expect(cleanTitle('file"name')).toBe("file_name")
    expect(cleanTitle("file'name")).toBe("file_name")
  })

  test("should handle multiple forbidden characters", () => {
    expect(cleanTitle("file*/\\<>:|?\"'name")).toBe("file__________name")
  })

  test("should leave clean filenames unchanged", () => {
    expect(cleanTitle("clean-filename")).toBe("clean-filename")
    expect(cleanTitle("file_name_123")).toBe("file_name_123")
  })
})

describe("cleanTag", () => {
  test("should replace ampersands with underscores", () => {
    expect(cleanTag("tag&name")).toBe("tag_name")
    expect(cleanTag("multiple&tags&here")).toBe("multiple_tags_here")
  })

  test("should replace spaces with hyphens", () => {
    expect(cleanTag("tag name")).toBe("tag-name")
    expect(cleanTag("multiple spaces here")).toBe("multiple-spaces-here")
  })

  test("should convert to lowercase", () => {
    expect(cleanTag("UpperCase")).toBe("uppercase")
    expect(cleanTag("MiXeD cAsE")).toBe("mixed-case")
  })

  test("should trim whitespace", () => {
    expect(cleanTag("  tag  ")).toBe("tag")
    expect(cleanTag("\ttag\n")).toBe("tag")
  })

  test("should handle combined transformations", () => {
    expect(cleanTag("  Tag & Name With Spaces  ")).toBe(
      "tag-_-name-with-spaces",
    )
  })

  test("should handle empty and whitespace-only strings", () => {
    expect(cleanTag("")).toBe("")
    expect(cleanTag("   ")).toBe("")
    expect(cleanTag("\t\n")).toBe("")
  })
})
