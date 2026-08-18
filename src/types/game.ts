export type TeamId = 1 | 2

export interface GameCategory {
  id: string
  title: string
  description: string
  gradient: string
  accent: string
  icon: string
  image?: string
  questionCount: number
  difficulty: 'easy' | 'medium' | 'hard'
  sectionId: string
}

export interface GameSetup {
  gameName: string
  team1Name: string
  team2Name: string
  team1Players: number
  team2Players: number
  team1CategoryIds: string[]
  team2CategoryIds: string[]
  /** Lifelines are a closed set — only `LifelineId` values are legal. */
  team1LifelineIds: import('./board').LifelineId[]
  team2LifelineIds: import('./board').LifelineId[]
}

export type CategoryOwner = TeamId | null

export const CATEGORIES_PER_TEAM = 3
export const LIFELINES_PER_TEAM = 3
export const MIN_PLAYERS = 1
export const MAX_PLAYERS = 12
