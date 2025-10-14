# MCP Server / Orchard Plugin Working Notes

_Last updated: 2025-10-04_

These notes capture the current implementation state, rationale, and next actions for the Orchard MCP server + Obsidian plugin integration. Reference this file to quickly resume work.

---
## 1. Current Implementation Snapshot
- **Standalone MCP Plugin**: `packages/mcp-server/src/plugin.ts` starts `McpServer` directly (no dependency on the Orchard plugin lifecycle).
- **NoteService Backend Selection**: Chosen at startup via `settings.storage` (`vault` | `memory`). Vault = real Obsidian markdown files (via inline lightweight adapter). Memory = ephemeral in‑process storage using `@orchard/core` memory adapter.
- **API Key Handling (Current)**:
  - Generated locally on first run (24 random bytes → hex) using `crypto.getRandomValues` fallback to `Math.random`.
  - Commands: show key, regenerate key, restart server.
  - Rotation via HTTP: `POST /config/key` with `{ rotate: true }` or `{ newKey: "..." }` changes the server's in-memory key only.
  - Plugin does **not** persist rotated server-generated keys automatically (desynchronization risk).
- **Config Endpoints Added**:
  - `POST /config/key` → rotate/set key (requires Authorization or query param `key`).
  - `POST /config/storage` → acknowledge requested storage mode change (no live switch yet; just returns `{ ok, mode }`).
- **Tests**:
  - Core MCP server tools + CRUD covered in `mcp-server.test.ts`.
  - Config endpoint behaviors covered in `mcp-config-routes.test.ts`.
- **Key Generation Code Simplified**: Removed brittle `globalThis/window` fallback logic.

---
## 2. Purpose of Memory Storage Mode
| Aspect | Memory Mode | Vault Mode |
| ------ | ----------- | ---------- |
| Persistence | Lost on restart | Stored as markdown files |
| Use Cases | Testing, sandbox agents, ephemeral scratch notes | Real note authoring | 
| Performance | Faster (no disk I/O) | Dependent on vault FS |
| Safety | No risk to vault files | Modifies user files |
| Integration | Not visible in Obsidian file tree | Visible & indexed |

Rationale: Allows safe experimentation (e.g., LLM/agent note generation) without touching real notes; enables deterministic test fixtures. Not intended for long-term content.

---
## 3. Key Rotation: Problems & Improvements
### 3.1 Issues Now
- Rotating via `{ rotate: true }` leaves plugin settings stale.
- Server restart (triggered later) will reinitialize with outdated saved key.
- No metadata endpoint to verify rotation state without full key disclosure.
- Tests currently use white-box `server.setApiKey` in one path (acceptable for now but not ideal).

### 3.2 Improvement Options
| Option | Pros | Cons |
| ------ | ---- | ---- |
| Client-supplied newKey only | Plugin already knows key; easy persistence | Requires plugin to manage entropy & formatting |
| Server-generated + returns full key once | Simple client API | Must guard against logging/exposure |
| Add `onKeyChange` callback | Clean persistence hook | Requires minor server API change |
| Add `GET /config/key` metadata | Enables verification without key exposure | Slightly broader surface |
| Return tail + timestamps only | Safe for logs & UI | Needs local copy of full key for comparisons |

### 3.3 Recommended Composite Approach
1. Enhance constructor to accept `onKeyChange(newKey: string)`.
2. Modify `POST /config/key` response:
   - On rotation or newKey: `{ ok: true, tail: <last6>, createdAt, rotatedAt, key?: <full only if server-generated this call> }`.
   - If client provided `newKey`, omit full key in response (it already has it).
3. Add `GET /config/key` (auth required) → `{ tail, createdAt, rotatedAt }` (never returns full key).
4. Plugin workflow:
   - Generate key locally (preferred) → POST with `{ newKey }`.
   - Persist immediately on success; restart server using new key.
5. Update tests to assert old key now 401 & `GET /config/key` tail matches.

---
## 4. Proposed New Endpoint Specs
### 4.1 POST /config/key
Request bodies:
- `{ "rotate": true }` (server generates)
- `{ "newKey": "<clientGenerated>" }`
Response (success):
```
{
  "ok": true,
  "tail": "abcdef",           // last 6 chars
  "createdAt": 173xx...,        // ms epoch when first key created
  "rotatedAt": 173xx...,        // ms epoch when last rotation applied
  "key": "<full>"               // ONLY if server generated this rotation
}
```
Errors: `401 Unauthorized`, `503 ServerNotReady`, `400 BadRequest` (invalid shape).

### 4.2 GET /config/key
Auth Required.
Response:
```
{ "tail": "abcdef", "createdAt": 173..., "rotatedAt": 173... }
```
Never includes full key.

---
## 5. Outstanding Tasks / TODOs
(Use this list to drive next PRs.)

| ID | Task | Status | Priority | Notes |
| -- | ---- | ------ | -------- | ----- |
| T1 | Add `onKeyChange` callback to `McpServer` | Pending | High | Invoked in `/config/key` handler |
| T2 | Track `createdAt` / `rotatedAt` timestamps | Pending | High | Initialize on first non-null key |
| T3 | Implement enhanced POST `/config/key` response contract | Pending | High | Include tail & conditional full key |
| T4 | Add GET `/config/key` endpoint (metadata only) | Pending | High | Reuse auth path |
| T5 | Refactor plugin regenerate command to use HTTP rotation (client-supplied key) | Pending | High | Persist + restart |
| T6 | Persist server-generated rotation (if used) via `onKeyChange` | Pending | Medium | Only needed if rotate=true path retained |
| T7 | Remove white-box `server.setApiKey` usage from tests | Pending | Medium | Replace with real rotation flow |
| T8 | Add tests covering new endpoints & metadata invariants | Pending | High | Tail correctness, timestamp monotonicity |
| T9 | (Optional) Auto-restart on storage mode change + persist | Pending | Low | Plugin watches `/config/storage` result |
| T10 | (Optional) Improve memory→vault migration (export) | Deferred | Low | Future enhancement |

---
## 6. Implementation Order Proposal
1. (T1, T2) Extend `McpServer` state & constructor options.
2. (T3) Enhance POST `/config/key` logic + tests.
3. (T4) Add GET endpoint + tests.
4. (T5) Update plugin command to call server instead of local regeneration.
5. (T7, T8) Adjust test suite; remove direct `setApiKey` calls.
6. (T9) Evaluate storage mode auto-restart (if still desired).

---
## 7. Testing Strategy Notes
- Use existing port (27126) to stay consistent.
- Add new test file `mcp-key-mgmt.test.ts` or extend `mcp-config-routes.test.ts`.
- Assertions:
  - Old key 401 after rotation.
  - New key accepted.
  - Tail length & match (regex `/^[0-9a-f]{6}$/`).
  - `rotatedAt >= createdAt` and increases on subsequent rotations.
  - No `key` field in GET response.
- Negative: invalid body → 400; unauthenticated GET → 401/503.

---
## 8. Security Considerations
- Never log full key; log tail only (`***<tail>` pattern).
- One-time full key disclosure only if server generates it (optional; can disable entirely for stricter posture).
- Consider lengthening key (currently 48 hex chars = 192 bits) – already strong; ok to keep.
- Avoid timing side channels: constant-time comparison not yet implemented (could introduce subtlety later if key usage frequency rises).

---
## 9. Open Questions (Decide Before Implementing)
| Question | Options | Default Assumption |
| -------- | ------- | ------------------ |
| Server or client generates rotation key? | Client, Server, Both | Support both; prefer client-provided |
| Include full key in server-generated rotation response? | Yes (one-time), No | Yes (one-time) |
| Auto-restart on storage mode change? | Yes, Manual, Deferred | Deferred |
| Keep memory mode hidden or expose UI toggle? | Hidden, UI Later | Hidden for now |

---
## 10. Quick Resume Checklist
When you pick this back up:
1. Confirm decisions in Section 9 or adjust.
2. Implement tasks T1–T5 sequentially.
3. Update tests (T7, T8).
4. Run `bun test` (expect all green + new cases).
5. Consider documenting rotation usage in README (optional after feature stabilizes).

---
## 11. Suggested Future Enhancements (Non-blocking)
- Add hashed key verification (`hash = SHA256(serverSalt || key)`), enabling clients to compare without full key.
- Implement streaming note change events over SSE beyond current notifications (subscribe with filters, etc.).
- Add partial text search index for faster `list_notes` search queries.
- Provide export command from memory mode to vault.

---
## 12. Reference File Paths
- MCP Server: `packages/mcp-server/src/mcp-server.ts`
- Plugin: `packages/mcp-server/src/plugin.ts`
- Config Tests: `packages/mcp-server/src/mcp-config-routes.test.ts`
- Core Note Service: `packages/orchard-core/src/note-service.ts`

---
## 13. Glossary
- **Tail**: Last 6 hex characters of API key; safe to display.
- **Rotation**: Replacing the active API key with a new one.
- **Ephemeral Notes**: Notes stored only in memory adapter; lost on restart.

---
Feel free to append decisions you make below this line.

> _Append future decisions here:_
