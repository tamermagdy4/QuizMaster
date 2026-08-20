import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CATEGORIES_PER_TEAM,
  LIFELINES_PER_TEAM,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type CategoryOwner,
  type TeamId,
} from '../types/game'
import type { LifelineId } from '../types/board'

interface GameSetupState {
  gameName: string
  team1Name: string
  team2Name: string
  team1Players: number
  team2Players: number
  team1CategoryIds: string[]
  team2CategoryIds: string[]
  team1LifelineIds: LifelineId[]
  team2LifelineIds: LifelineId[]
  activeTeam: TeamId

  setGameName: (name: string) => void
  setTeam1Name: (name: string) => void
  setTeam2Name: (name: string) => void
  adjustTeam1Players: (delta: number) => void
  adjustTeam2Players: (delta: number) => void
  toggleCategory: (categoryId: string) => void
  getCategoryOwner: (categoryId: string) => CategoryOwner
  toggleLifeline: (teamId: TeamId, lifelineId: LifelineId) => void
  canStartGame: () => boolean
  reset: () => void
  resetCategories: () => void
}

const clampPlayers = (count: number) =>
  Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count))

const initialState = {
  gameName: '',
  team1Name: '',
  team2Name: '',
  team1Players: 2,
  team2Players: 2,
  team1CategoryIds: [] as string[],
  team2CategoryIds: [] as string[],
  team1LifelineIds: [] as LifelineId[],
  team2LifelineIds: [] as LifelineId[],
  activeTeam: 1 as TeamId,
}

function normalizeCategoryId(categoryId: string): string {
  return categoryId.trim()
}

function resolveActiveTeam(
  team1Count: number,
  team2Count: number,
  current: TeamId,
): TeamId {
  if (team1Count < CATEGORIES_PER_TEAM) return 1
  if (team2Count < CATEGORIES_PER_TEAM) return 2
  return current
}

export const useGameSetupStore = create<GameSetupState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setGameName: (gameName) => set({ gameName }),
      setTeam1Name: (team1Name) => set({ team1Name }),
      setTeam2Name: (team2Name) => set({ team2Name }),

      adjustTeam1Players: (delta) =>
        set((state) => ({
          team1Players: clampPlayers(state.team1Players + delta),
        })),

      adjustTeam2Players: (delta) =>
        set((state) => ({
          team2Players: clampPlayers(state.team2Players + delta),
        })),

      getCategoryOwner: (categoryId) => {
        const { team1CategoryIds, team2CategoryIds } = get()
        if (team1CategoryIds.includes(categoryId)) return 1
        if (team2CategoryIds.includes(categoryId)) return 2
        return null
      },

      toggleCategory: (categoryId) =>
        set((state) => {
          const id = normalizeCategoryId(categoryId)
          if (!id) return state

          const inTeam1 = state.team1CategoryIds.includes(id)
          const inTeam2 = state.team2CategoryIds.includes(id)

          if (inTeam1) {
            const team1CategoryIds = state.team1CategoryIds.filter((value) => value !== id)
            return {
              team1CategoryIds,
              activeTeam: resolveActiveTeam(
                team1CategoryIds.length,
                state.team2CategoryIds.length,
                state.activeTeam,
              ),
            }
          }

          if (inTeam2) {
            const team2CategoryIds = state.team2CategoryIds.filter((value) => value !== id)
            return {
              team2CategoryIds,
              activeTeam: resolveActiveTeam(
                state.team1CategoryIds.length,
                team2CategoryIds.length,
                state.activeTeam,
              ),
            }
          }

          if (state.activeTeam === 1) {
            if (state.team1CategoryIds.length < CATEGORIES_PER_TEAM) {
              const team1CategoryIds = [...state.team1CategoryIds, id]
              return {
                team1CategoryIds,
                activeTeam: resolveActiveTeam(
                  team1CategoryIds.length,
                  state.team2CategoryIds.length,
                  state.activeTeam,
                ),
              }
            }

            if (state.team2CategoryIds.length < CATEGORIES_PER_TEAM) {
              const team2CategoryIds = [...state.team2CategoryIds, id]
              return {
                team2CategoryIds,
                activeTeam: resolveActiveTeam(
                  state.team1CategoryIds.length,
                  team2CategoryIds.length,
                  state.activeTeam,
                ),
              }
            }
          }

          if (state.activeTeam === 2) {
            if (state.team2CategoryIds.length < CATEGORIES_PER_TEAM) {
              const team2CategoryIds = [...state.team2CategoryIds, id]
              return {
                team2CategoryIds,
                activeTeam: resolveActiveTeam(
                  state.team1CategoryIds.length,
                  team2CategoryIds.length,
                  state.activeTeam,
                ),
              }
            }

            if (state.team1CategoryIds.length < CATEGORIES_PER_TEAM) {
              const team1CategoryIds = [...state.team1CategoryIds, id]
              return {
                team1CategoryIds,
                activeTeam: resolveActiveTeam(
                  team1CategoryIds.length,
                  state.team2CategoryIds.length,
                  state.activeTeam,
                ),
              }
            }
          }

          return state
        }),

      toggleLifeline: (teamId, lifelineId) =>
        set((state) => {
          const key = teamId === 1 ? 'team1LifelineIds' : 'team2LifelineIds'
          const current = state[key]

          if (current.includes(lifelineId)) {
            return { [key]: current.filter((id) => id !== lifelineId) }
          }

          if (current.length >= LIFELINES_PER_TEAM) {
            return state
          }

          return { [key]: [...current, lifelineId] }
        }),

      canStartGame: () => {
        const state = get()
        return (
          state.gameName.trim().length > 0 &&
          state.team1Name.trim().length > 0 &&
          state.team2Name.trim().length > 0 &&
          state.team1CategoryIds.length === CATEGORIES_PER_TEAM &&
          state.team2CategoryIds.length === CATEGORIES_PER_TEAM &&
          state.team1LifelineIds.length === LIFELINES_PER_TEAM &&
          state.team2LifelineIds.length === LIFELINES_PER_TEAM
        )
      },

      reset: () => set(initialState),

      resetCategories: () =>
        set({
          team1CategoryIds: [],
          team2CategoryIds: [],
          team1LifelineIds: [],
          team2LifelineIds: [],
          activeTeam: 1 as TeamId,
        }),
    }),
    {
      name: 'quizmaster-setup',
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<GameSetupState>
        return {
          ...currentState,
          ...persisted,
          team1CategoryIds: Array.isArray(persisted.team1CategoryIds) ? persisted.team1CategoryIds : currentState.team1CategoryIds,
          team2CategoryIds: Array.isArray(persisted.team2CategoryIds) ? persisted.team2CategoryIds : currentState.team2CategoryIds,
          team1LifelineIds: Array.isArray(persisted.team1LifelineIds) ? persisted.team1LifelineIds : currentState.team1LifelineIds,
          team2LifelineIds: Array.isArray(persisted.team2LifelineIds) ? persisted.team2LifelineIds : currentState.team2LifelineIds,
          team1Players: typeof persisted.team1Players === 'number' ? persisted.team1Players : currentState.team1Players,
          team2Players: typeof persisted.team2Players === 'number' ? persisted.team2Players : currentState.team2Players,
          activeTeam: persisted.activeTeam === 1 || persisted.activeTeam === 2 ? persisted.activeTeam : currentState.activeTeam,
        }
      },
    },
  ),
)
