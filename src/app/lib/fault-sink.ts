export interface FaultSink {
  /** Reporting will never arrive — the code that sends it could not be fetched. */
  abandon(): void
  install(reporter: Reporter): void
  report(error: Error, tags: FaultTags): void
}

export type Reporter = (error: Error, tags: FaultTags) => void

/** What a report is tagged with: where the fault was caught, and which kind it was. */
type FaultTags = Readonly<Record<string, string>>

/**
 * The few hundred bytes of monitoring that are in the first load.
 *
 * The code that sends a report is fetched when the page is idle (OBS-5), so a
 * fault in the first second has nowhere to go yet. This holds it until that code
 * arrives and hands everything over in the order it happened. It holds ten:
 * enough to outlast a burst while the page loads, and few enough that a page
 * stuck in a loop of errors is not also filling the reader's memory.
 *
 * A reporter that throws is swallowed. A tracker that is down, over its quota or
 * blocked by an extension changes nothing the reader sees, and is not itself
 * reported (OBS-6).
 */
export function faultSink(limit = 10): FaultSink {
  let held: null | { error: Error; tags: FaultTags }[] = []
  let reporter: null | Reporter = null

  function send(error: Error, tags: FaultTags): void {
    try {
      reporter?.(error, tags)
    } catch {
      // Reporting never breaks the app, and a failed report is not reported.
    }
  }

  return {
    abandon() {
      held = null
    },
    install(installed) {
      reporter = held === null ? null : installed

      for (const fault of held ?? []) {
        send(fault.error, fault.tags)
      }

      held = []
    },
    report(error, tags) {
      if (reporter !== null) {
        send(error, tags)
      } else if (held !== null) {
        held = [...held, { error, tags }].slice(-limit)
      }
    },
  }
}
