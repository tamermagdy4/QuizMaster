export type PointValue = 100 | 300 | 500

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

export const POINT_SLOTS: PointValue[] = [500, 300, 100, 100, 300, 500]

export const TOTAL_CATEGORIES = 6
