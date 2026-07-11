import { useRef, useCallback } from 'react'

// Returns a referentially-stable function that always calls the latest `fn`.
// Lets memoized children (e.g. BoardCard via React.memo) skip re-renders even
// though parent handlers are recreated on every render (and avoids stale
// closures over changing state).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableHandler<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, [])
}
