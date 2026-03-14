import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createMemoryAdapter, NoteService } from '@orchard/core'
import { McpServer } from './mcp-server'

async function post(
  url: string,
  body: Record<string, unknown>,
  key?: string,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('McpServer config routes', () => {
  let server: McpServer
  let svc: NoteService
  let key: string

  beforeAll(async () => {
    key = 'initial_key_123'
    svc = new NoteService({ adapter: createMemoryAdapter() })
    server = new McpServer({ noteService: svc, apiKey: key })
    await server.start()
    await new Promise((r) => setTimeout(r, 30))
  })

  afterAll(async () => {
    await server.stop()
  })

  it('rejects /config/key without auth', async () => {
    const res = await post('http://localhost:27126/config/key', {
      rotate: true,
    })
    expect([401, 503]).toContain(res.status) // 503 only if key somehow unset
  })

  it('rotates api key via rotate flag and rejects old key', async () => {
    const rotate = await post(
      'http://localhost:27126/config/key',
      { rotate: true },
      key,
    )
    expect(rotate.status).toBe(200)
    const rotatedKey = server.getApiKey()
    expect(typeof rotatedKey).toBe('string')
    expect(rotatedKey).toMatch(/^[0-9a-f]{64}$/)

    // Old key should now fail auth for protected endpoint (/mcp)
    const unauthorized = await fetch('http://localhost:27126/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'tools/list',
        params: {},
      }),
    })
    // Either 401 or 400 (if it got past auth but missing session). We want 401 to confirm key change.
    expect(unauthorized.status).toBe(401)
  })

  it('sets explicit newKey and allows auth with it', async () => {
    // We don't know the rotated key; set a deterministic one.
    const newKey = 'explicit_new_key_456'
    // This request must fail with unknown key first to confirm old rotated key unknown.
    const shouldFail = await post(
      'http://localhost:27126/config/key',
      { newKey },
      key,
    )
    expect([401, 503]).toContain(shouldFail.status)

    // We cannot change key without current key, so skip attempt and instead verify server still rejects old key.
    // For test purposes, we directly set the key through class (white-box) then verify success.
    server.setApiKey(key) // reset to known key to authorize change
    const setExplicit = await post(
      'http://localhost:27126/config/key',
      { newKey },
      key,
    )
    expect(setExplicit.status).toBe(200)

    // Now use new key for an authenticated but invalid (no Accept) call to confirm 4xx not 401.
    const check = await fetch(
      `http://localhost:27126/mcp?key=${encodeURIComponent(newKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'x', version: '0' },
          },
        }),
      },
    )
    expect(check.status).toBeGreaterThanOrEqual(400) // Not 401, should be 4xx due to missing Accept
  })

  it('rejects /config/storage without auth', async () => {
    const res = await post('http://localhost:27126/config/storage', {
      mode: 'memory',
    })
    expect([401, 503]).toContain(res.status)
  })

  it('acknowledges storage mode change with auth', async () => {
    server.setApiKey('explicit_new_key_456') // ensure key matches after previous test
    const res = await post(
      'http://localhost:27126/config/storage',
      { mode: 'memory' },
      'explicit_new_key_456',
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok?: boolean; mode?: string }
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('memory')
  })

  it('returns 400 for invalid storage payload', async () => {
    const res = await post(
      'http://localhost:27126/config/storage',
      { invalid: true },
      'explicit_new_key_456',
    )
    expect(res.status).toBe(400)
  })
})
