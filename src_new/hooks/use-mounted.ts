'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Returns `true` on the client after hydration, `false` on the server.
 * Uses useSyncExternalStore to avoid hydration mismatches and
 * the React lint rule against setState in useEffect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
