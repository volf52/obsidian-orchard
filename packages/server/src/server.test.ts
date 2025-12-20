import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { ServerModule } from "./server-module"

// We'll spin up the ServerModule with a known key, then hit routes.

describe("ServerModule API", () => {
  let server: ServerModule
  const key = "apitestkey123"

  beforeAll(async () => {
    server = new ServerModule(key)
    await server.start()
    // small delay to ensure server listening
    await new Promise((r) => setTimeout(r, 40))
  })

  afterAll(async () => {
    await server.stop()
  })

  it("health responds without auth", async () => {
    const res = await fetch("http://localhost:27125/health")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
  })

  it("rejects protected route without bearer", async () => {
    const res = await fetch("http://localhost:27125/api/status")
    expect(res.status).toBe(401)
  })

  it("rejects protected route with wrong bearer", async () => {
    const res = await fetch("http://localhost:27125/api/status", {
      headers: { Authorization: "Bearer WRONG" },
    })
    expect(res.status).toBe(401)
  })

  it("allows protected route with correct bearer", async () => {
    const res = await fetch("http://localhost:27125/api/status", {
      headers: { Authorization: `Bearer ${key}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("API is running")
    expect(typeof body.timestamp).toBe("string")
  })
})
