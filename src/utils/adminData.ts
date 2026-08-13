import { gameCategories } from '../data/categories'
import { getQuestionEntriesByPoints } from '../data/questionLoader'
import type { PointValue } from '../types/board'
import { getAdminQuestionOverrides } from './adminQuestionStore'

export type AdminQuestion = {
  id: string
  categoryId: string
  categoryTitle: string
  points: PointValue
  question: string
  answer: string
  media?: string
  mediaType?: string
  hint?: string
}

export const ADMIN_POINTS: PointValue[] = [100, 300, 500]

export function getAdminQuestions(): AdminQuestion[] {
  const questions: AdminQuestion[] = []
  const seen = new Set<string>()

  for (const category of gameCategories) {
    for (const points of ADMIN_POINTS) {
      for (const item of getQuestionEntriesByPoints(category.id, points)) {
        const id = item.id ?? `${category.id}-${points}-${questions.length}`
        const key = `${category.id}:${id}`
        if (seen.has(key)) continue
        seen.add(key)
        questions.push({
          id,
          categoryId: category.id,
          categoryTitle: category.title,
          points: item.points ?? points,
          question: item.question,
          answer: item.answer,
          media: item.media,
          mediaType: item.mediaType,
          hint: item.hint,
        })
      }
    }
  }

  const { upserts, deletedIds } = getAdminQuestionOverrides()
  const deleted = new Set(deletedIds)
  const merged = questions.filter((question) => !deleted.has(question.id))
  const byId = new Map(merged.map((question) => [question.id, question]))
  for (const question of upserts) {
    if (!deleted.has(question.id)) byId.set(question.id, question)
  }

  return [...byId.values()]
}

export function getAdminQuestion(id: string): AdminQuestion | undefined {
  return getAdminQuestions().find((question) => question.id === id)
}

export function getCategoryStats() {
  const questions = getAdminQuestions()
  return gameCategories.map((category) => {
    const categoryQuestions = questions.filter((question) => question.categoryId === category.id)
    return {
      category,
      total: categoryQuestions.length,
      byPoints: Object.fromEntries(ADMIN_POINTS.map((points) => [points, categoryQuestions.filter((question) => question.points === points).length])) as Record<PointValue, number>,
    }
  })
}

export function exportQuestions() {
  const questions = getAdminQuestions()

  return gameCategories
    .map((category) => {
      const categoryQuestions = questions
        .filter((question) => question.categoryId === category.id)
        .map(({ categoryTitle: _categoryTitle, ...question }) => question)

      return {
        categoryId: category.id,
        questions: categoryQuestions,
        metadata: {
          sectionId: category.sectionId,
          updatedAt: new Date().toISOString(),
          status: 'exported',
        },
      }
    })
    .filter((collection) => collection.questions.length > 0)
}
