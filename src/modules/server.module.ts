import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http2"
import { type ServerType, serve } from "@hono/node-server"
import type { Hono } from "hono"
import type { App } from "obsidian"
import type { OrchardServices } from "@/services/utils"
import type { OrchardSettings } from "@/settings/types"
import { initRouter } from "./server"

const PORT = 27125

export class ServerModule {
  private readonly router: Hono
  private server: ServerType | null = null

  constructor(
    readonly app: App,
    readonly settings: OrchardSettings,
    readonly services: OrchardServices,
  ) {
    this.router = initRouter(this.settings.serverApiKey)
  }

  static getApiKey() {
    return createHash("sha256").update(randomBytes(32)).digest("hex")
  }

  async loadServer() {
    this.server = serve(
      {
        fetch: this.router.fetch,
        createServer,
        port: PORT,
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

  async closeServer() {
    if (!this.server) return

    this.server.close(console.error)
    this.server = null
  }
}
