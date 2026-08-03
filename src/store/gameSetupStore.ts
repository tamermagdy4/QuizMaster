import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CATEGORIES_PER_TEAM,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type CategoryOwner,
  type TeamId,
} from '../types/game'

interface GameSetupState {
  gameName: string
  team1Name: string
  team2Name: string
  team1Players: number
  team2Players: number
  team1CategoryIds: string[]
  team2CategoryIds: string[]
  activeTeam: TeamId

  setGameName: (name: string) => void
  setTeam1Name: (name: string) => void
  setTeam2Name: (name: string) => void
  adjustTeam1Players: (delta: number) => void
  adjustTeam2Players: (delta: number) => void
  toggleCategory: (categoryId: string) => void
  getCategoryOwner: (categoryId: string) => CategoryOwner
  canStartGame: () => boolean
  reset: () => void
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
  activeTeam: 1 as TeamId,
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
          const inTeam1 = state.team1CategoryIds.includes(categoryId)
          const inTeam2 = state.team2CategoryIds.includes(categoryId)

          if (inTeam1) {
            const team1CategoryIds = state.team1CategoryIds.filter((id) => id !== categoryId)
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
            const team2CategoryIds = state.team2CategoryIds.filter((id) => id !== categoryId)
            return {
              team2CategoryIds,
              activeTeam: resolveActiveTeam(
                state.team1CategoryIds.length,
                team2CategoryIds.length,
                state.activeTeam,
              ),
            }
          }

          if (state.activeTeam === 1 && state.team1CategoryIds.length < CATEGORIES_PER_TEAM) {
            const team1CategoryIds = [...state.team1CategoryIds, categoryId]
            return {
              team1CategoryIds,
              activeTeam: resolveActiveTeam(
                team1CategoryIds.length,
                state.team2CategoryIds.length,
                state.activeTeam,
              ),
            }
          }

          if (state.activeTeam === 2 && state.team2CategoryIds.length < CATEGORIES_PER_TEAM) {
            const team2CategoryIds = [...state.team2CategoryIds, categoryId]
            return {
              team2CategoryIds,
              activeTeam: resolveActiveTeam(
                state.team1CategoryIds.length,
                team2CategoryIds.length,
                state.activeTeam,
              ),
            }
          }

          return state
        }),

      canStartGame: () => {
        const state = get()
        return (
          state.gameName.trim().length > 0 &&
          state.team1Name.trim().length > 0 &&
          state.team2Name.trim().length > 0 &&
          state.team1CategoryIds.length === CATEGORIES_PER_TEAM &&
          state.team2CategoryIds.length === CATEGORIES_PER_TEAM
        )
      },

      reset: () => set(initialState),
    }),
    {
      name: 'quizmaster-setup',
    },
  ),
)

