export type PointValue = 100 | 300 | 500

export type LifelineId = 'double' | 'block' | 'call' | 'wheel'

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
  questionText: string
  answerText: string
}

export const POINT_SLOTS: PointValue[] = [100, 100, 300, 300, 500, 500]

export const TOTAL_CATEGORIES = 6
