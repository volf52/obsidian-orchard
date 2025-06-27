import { createHash, randomBytes } from "node:crypto"
import { serve } from "@hono/node-server"
import type { Hono } from "hono"
import { initRouter } from "./router"

const PORT = 27125

export class ServerModule {
  private readonly router: Hono
  private server: ReturnType<typeof serve> | null = null
  private onShutdown: null | (() => void) = null

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
        port: PORT,
        hostname: '0.0.0.0',
      },
      (info) => {
        console.log(`🚀 Server started on http://localhost:${info.port}`)
        console.log(`📚 API documentation: http://localhost:${info.port}/`)
        console.log(`💚 Health check: http://localhost:${info.port}/health`)
        console.log(`🔑 API Key: ${this.apiKey}`)
      },
    )

    this.onShutdown = this.setupGracefulShutdown()
  }

  async stop(): Promise<void> {
    if (!this.server) return

    this.server.close()
    this.server = null
    this.onShutdown?.()
    console.log("🛑 Server stopped")
  }

  private setupGracefulShutdown() {
    const handleShutdown = () => {
      console.log("\n🔄 Shutting down server...")
      this.stop()
      process.exit(0)
    }

    process.on("SIGINT", handleShutdown)
    process.on("SIGTERM", handleShutdown)

    return () => {
      process.off("SIGINT", handleShutdown)
      process.off("SIGTERM", handleShutdown)
      console.log("🛑 Graceful shutdown handlers removed")
    }
  }
}