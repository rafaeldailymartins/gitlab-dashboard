import { useEffect, useState } from 'react'

/**
 * How long a search box waits before it asks the provider.
 *
 * One number for every search in the app. They are the same question asked of
 * the same provider, and a reader moving between them should not find one of
 * them twitchier than the next.
 *
 * Three hundred milliseconds is chosen against the round trip rather than
 * against a feeling. A search of GitLab's own index takes longer than that, so
 * a shorter wait buys a request that is still in flight when the next keystroke
 * supersedes it — paid for by the provider, then thrown away. Much longer and
 * the box reads as one that is not listening.
 */
export const SEARCH_SETTLE_MS = 300

/**
 * `value`, once it has stopped changing for `delayMs`.
 *
 * The first render answers at once: a value that arrives already settled should
 * not be withheld, and an empty box has nothing to wait for.
 *
 * **What is debounced is the request, never the field.** The reader sees their
 * own typing immediately — the input renders the raw value and only the query
 * reads this — because a field that lags behind the keyboard is a worse bug
 * than the one this fixes. Holding the input's own value here would also fight
 * the browser over the caret on every settle.
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value)
    }, delayMs)

    return () => {
      clearTimeout(timer)
    }
  }, [delayMs, value])

  return settled
}
