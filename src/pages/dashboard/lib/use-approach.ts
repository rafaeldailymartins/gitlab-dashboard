import { type RefObject, useEffect, useRef } from 'react'

/** Start loading a page before the reader reaches the end, not after. */
const MARGIN = '400px'

/**
 * Calls `onApproach` when the returned element comes near the viewport.
 *
 * This is what makes the feed extend on scroll. The explicit control beside it
 * stays: an observer never fires for someone tabbing through the page, and
 * "scroll further" is not an instruction a keyboard reader can follow.
 */
export function useApproach(
  onApproach: () => void,
  enabled: boolean,
): RefObject<HTMLDivElement | null> {
  const sentinel = useRef<HTMLDivElement | null>(null)
  const latest = useRef(onApproach)

  // The callback is read through a ref so a new one on every render does not
  // tear down and rebuild the observer.
  useEffect(() => {
    latest.current = onApproach
  }, [onApproach])

  useEffect(() => {
    const element = sentinel.current

    if (!enabled || !element) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          latest.current()
        }
      },
      { rootMargin: MARGIN },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [enabled])

  return sentinel
}
