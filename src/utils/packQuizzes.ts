import { gameCategories } from '../data/categories'
import { getQuestionEntries, getQuestionEntriesByPoints } from '../data/questionLoader'
import { presentCategory } from '../i18n/translations'
import type { PointValue } from '../types/board'
import type { GameCategory } from '../types/game'
import { getCategoryById } from './categories'

/**
 * A Pack quiz is an existing Fahloy category (the project's quiz identity).
 * This module maps category ids to the metadata + question content needed by
 * the Pack editor, detail page and play mode — always through the SAME
 * questionLoader the game board uses.
 */

export interface PackQuizMeta {
  quizId: string
  title: string
  titleEn: string
  icon: string
  gradient: string
  accent: string
  description: string
  categoryId: string
  difficulty: GameCategory['difficulty']
  questionCount: number
  sectionId: string
}

/** Catalog of every quiz (category) the Pack editor can offer. */
export function getQuizCatalog(): PackQuizMeta[] {
  return gameCategories.map((category) => ({
    quizId: category.id,
    title: category.title,
    titleEn: presentCategory(category.id, category.title, true),
    icon: category.icon,
    gradient: category.gradient,
    accent: category.accent,
    description: category.description,
    categoryId: category.sectionId,
    difficulty: category.difficulty,
    questionCount: category.questionCount,
    sectionId: category.sectionId,
  }))
}

export function getQuizMeta(quizId: string): PackQuizMeta | null {
  const category = getCategoryById(quizId)
  if (!category) return null
  return {
    quizId: category.id,
    title: category.title,
    titleEn: presentCategory(category.id, category.title, true),
    icon: category.icon,
    gradient: category.gradient,
    accent: category.accent,
    description: category.description,
    categoryId: category.sectionId,
    difficulty: category.difficulty,
    questionCount: category.questionCount,
    sectionId: category.sectionId,
  }
}

export interface PlayableQuestion {
  question: string
  answer: string
  hint?: string
  media?: string
  mediaType?: 'image' | 'video' | 'career'
  points: number
}

/**
 * Builds the ordered question list for a single Pack quiz.
 *
 * Mirrors the board: a balanced mix across the three point tiers
 * (100 = easy, 300 = medium, 500 = hard). The total is capped so a quiz
 * stays a snappy single-player experience.
 */
export function buildQuizQuestions(quizId: string, cap = 15): PlayableQuestion[] {
  const tiers: PointValue[] = [100, 300, 500]
  const questions: PlayableQuestion[] = []

  for (const points of tiers) {
    const pool = getQuestionEntriesByPoints(quizId, points)
    const take = Math.min(pool.length, Math.max(1, Math.round(cap / tiers.length)))
    const picked = shuffle(pool).slice(0, take)
    for (const item of picked) {
      questions.push({
        question: item.question,
        answer: item.answer,
        hint: item.hint,
        media: item.media,
        mediaType: item.mediaType,
        points: item.points ?? points,
      })
    }
  }

  // If a category only has questions outside the three tiers, fall back to
  // its full pool so a Pack quiz is never empty.
  if (questions.length === 0) {
    const pool = getQuestionEntries(quizId)
    for (const item of shuffle(pool).slice(0, cap)) {
      questions.push({
        question: item.question,
        answer: item.answer,
        hint: item.hint,
        media: item.media,
        mediaType: item.mediaType,
        points: item.points ?? 100,
      })
    }
  }

  return shuffle(questions)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

/** How many questions a quiz will actually serve (for display). */
export function getQuizQuestionCount(quizId: string): number {
  const tiers: PointValue[] = [100, 300, 500]
  let count = 0
  for (const points of tiers) {
    count += getQuestionEntriesByPoints(quizId, points).length
  }
  return Math.min(count, 15) || Math.min(getQuestionEntries(quizId).length, 15)
}
