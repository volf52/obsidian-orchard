import type { EventBus, NoteService } from "@orchard/core"

export interface LateAttachOptions<TInfra> {
  // Called each attempt; return { noteService, events } when available.
  probe: () => TInfra | null | undefined
  // Apply the newly discovered note service to a target (e.g., McpServer.setNoteService)
  apply: (infra: TInfra) => void
  // Interval between probes.
  intervalMs?: number
  // Total time before giving up.
  timeoutMs?: number
  // Optional callback for logging / telemetry.
  onAttempt?: (attempt: number) => void
  onAttached?: (infra: TInfra, attempt: number) => void
  onTimeout?: (attempts: number) => void
}

export interface CancelHandle {
  cancel: () => void
  completed: Promise<boolean> // resolves true if attached, false if timed out/cancelled
}

/**
 * Polls for infrastructure (e.g. another plugin's note service) and applies it when ready.
 * Keeps orchestration logic out of core domain.
 */
export function lateAttach<
  TInfra extends { noteService: NoteService; events?: EventBus | null },
>(opts: LateAttachOptions<TInfra>): CancelHandle {
  const interval = Math.max(50, opts.intervalMs ?? 1000)
  const timeout = Math.max(interval, opts.timeoutMs ?? 10_000)
  let attempt = 0
  let attached = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  let resolveCompleted: (v: boolean) => void = () => {}
  const completed = new Promise<boolean>((resolve) => {
    resolveCompleted = resolve
  })

  const startedAt = Date.now()

  const tick = () => {
    if (stopped) return
    attempt += 1
    opts.onAttempt?.(attempt)
    try {
      const infra = opts.probe()
      if (infra?.noteService) {
        opts.apply(infra)
        attached = true
        opts.onAttached?.(infra, attempt)
        resolveCompleted(true)
        return // stop
      }
    } catch {
      // swallow probe errors; continue until timeout
    }
    if (Date.now() - startedAt >= timeout) {
      opts.onTimeout?.(attempt)
      resolveCompleted(false)
      return
    }
    timer = setTimeout(tick, interval)
  }

  timer = setTimeout(tick, 0)

  return {
    cancel() {
      if (stopped) return
      stopped = true
      if (timer) clearTimeout(timer)
      if (!attached) resolveCompleted(false)
    },
    completed,
  }
}
