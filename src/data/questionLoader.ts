import type { PointValue } from '../types/board'

type QuestionItem = {
  id?: string
  question: string
  answer: string
}

type QuestionCollection = {
  categoryId: string
  questions?: QuestionItem[]
  questionsByPoints?: Partial<Record<PointValue, QuestionItem[]>>
  metadata: {
    sectionId: string
    updatedAt: string
    status: string
  }
}

const questionModules = import.meta.glob('./questions/**/*.json', {
  eager: true,
}) as Record<string, { default?: QuestionCollection }>

const questionCollections = Object.values(questionModules).flatMap((module) => {
  const collection = module.default
  if (!collection || !collection.categoryId) {
    return []
  }

  return [collection]
})

const questionLibrary = Object.fromEntries(
  questionCollections.map((collection) => [collection.categoryId, collection]),
) as Record<string, QuestionCollection>

function normalizeQuestionEntry(categoryId: string, points: PointValue, item: QuestionItem, index: number): QuestionItem {
  const stableId = item.id ?? `${categoryId}-${points}-${index}-${item.question.trim()}-${item.answer.trim()}`
  return {
    ...item,
    id: stableId,
  }
}

export function getQuestionEntries(categoryId: string): QuestionItem[] {
  return questionLibrary[categoryId]?.questions ?? []
}

export function getQuestionEntriesByPoints(categoryId: string, points: PointValue): QuestionItem[] {
  const collection = questionLibrary[categoryId]
  if (!collection) {
    return []
  }

  const pool = collection.questionsByPoints?.[points] ?? collection.questions ?? []
  return pool.map((item, index) => normalizeQuestionEntry(categoryId, points, item, index))
}

export function hasQuestionEntries(categoryId: string): boolean {
  return getQuestionEntries(categoryId).length > 0
}
