export type PointValue = 100 | 300 | 500

export type GameMode = 'local' | 'online'

export type LifelineId = 'double' | 'two-answers' | 'block' | 'call' | 'wheel'

export interface BoardCell {
  categoryId: string
  slotIndex: number
  points: PointValue
  team1Played: boolean
  team2Played: boolean
}

export interface Lifeline {
  id: LifelineId
  label: string
  description: string
  icon: string
  used: boolean
}

export interface ActiveQuestion {
  categoryId: string
  slotIndex: number
  points: PointValue
  team: import('./game').TeamId
  /** Free-for-all (3+ players online): the player who picked this question. */
  playerId?: string
  questionText: string
  answerText: string
  media: string
  mediaType: 'image' | 'video' | 'career'
  careerImage: string
  answerMedia: string
  hint?: string
  answerOptions: string[]
  twoAnswersUsed: boolean
  answered: boolean
  lifelineUsed: LifelineId | null
  doubleApplied: boolean
}

/**
 * Per-player state used ONLY in free-for-all online games (3+ players).
 * Each player keeps their own score, used cells and lifelines — picking a
 * cell marks it used for that player alone, so other players can still pick
 * the same cell.
 */
export interface FfaPlayerState {
  playerId: string
  name: string
  score: number
  /** Cell keys: `${categoryId}-${slotIndex}` already used by THIS player. */
  usedCells: string[]
  lifelines: Lifeline[]
}

export function cellKey(categoryId: string, slotIndex: number): string {
  return `${categoryId}-${slotIndex}`
}

export const POINT_SLOTS: PointValue[] = [500, 300, 100, 100, 300, 500]

export const TOTAL_CATEGORIES = 6
