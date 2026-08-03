import { create } from 'zustand'
import type { Direction } from '../types'

interface AppState {
  direction: Direction
  setDirection: (direction: Direction) => void
  toggleDirection: () => void
}

export const useAppStore = create<AppState>((set) => ({
  direction: 'rtl',
  setDirection: (direction) => set({ direction }),
  toggleDirection: () =>
    set((state) => ({
      direction: state.direction === 'rtl' ? 'ltr' : 'rtl',
    })),
}))
