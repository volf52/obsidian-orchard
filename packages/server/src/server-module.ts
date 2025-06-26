import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http2"
import { type ServerType, serve } from "@hono/node-server"
import type { Hono } from "hono"
import { initRouter } from "./router"

const PORT = 27125

export class ServerModule {
  private readonly router: Hono
  private server: ServerType | null = null

  constructor(private readonly apiKey: string) {
    this.router = initRouter(this.apiKey)
  }

  static generateApiKey(): string {
    return createHash("sha256").update(randomBytes(32)).digest("hex")
  }

  async start(): Promise<void> {
    this.server = serve(
      {
        fetch: this.router.fetch,
        createServer,
        port: PORT,
        hostname: '0.0.0.0',
      },
      (info) => {
        console.log(`Server started on port ${info.port}`)
      },
    )

    process.on("SIGINT", () => {
      this.server?.close(console.error)
    })

    process.on("SIGTERM", () => {
      this.server?.close(console.error)
    })
  }

  async stop(): Promise<void> {
    if (!this.server) return

    this.server.close(console.error)
    this.server = null
  }
}
