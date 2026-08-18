import { useEffect } from 'react'
import { ensureOnlineWiring, useOnlineStore } from '../store/onlineStore'

/**
 * React entry point for Online screens.
 *
 * Wires the online service subscriptions into the Zustand store once (safe
 * to call repeatedly), then exposes the current online session state and
 * room actions. Components may also select slices directly, e.g.
 * `useOnlineStore((state) => state.players)`.
 */
export function useOnlineRoom() {
  useEffect(() => {
    ensureOnlineWiring()
  }, [])

  return useOnlineStore()
}
