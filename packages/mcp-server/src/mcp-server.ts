// Minimal MCP server abstraction for Orchard.
// This is a placeholder; fill with actual MCP protocol handling logic.
export interface McpRequest<T = unknown> { type: string; payload?: T }
export interface McpResponse<T = unknown> { ok: boolean; data?: T; error?: string }

export type NoteSummary = { id: string; title: string; updated: string }

export class McpServer {
  private running = false
  constructor(/* inject services here */) {}

  async start(): Promise<void> {
    this.running = true
    console.log("[MCP] Server started (placeholder)")
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false
    console.log("[MCP] Server stopped")
  }

  async handle(_req: McpRequest): Promise<McpResponse> {
    return { ok: true, data: { message: "not implemented" } }
  }
}
