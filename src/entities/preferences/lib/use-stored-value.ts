import { useCallback, useState } from 'react'

/**
 * State that is read from storage once and written back on every change.
 *
 * Reading lazily rather than in an effect means the first render already shows
 * the reader's own settings, with no flash of the defaults.
 */
export function useStoredValue<T>(
  read: () => T,
  write: (value: T) => void,
): readonly [T, (next: T) => void] {
  const [value, setValue] = useState(read)

  const store = useCallback(
    (next: T) => {
      write(next)
      setValue(next)
    },
    [write],
  )

  return [value, store]
}
