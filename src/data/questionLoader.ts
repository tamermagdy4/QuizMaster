import { getPublicQuestions, type SupabaseQuestion } from '../services/questionService'
import type { PointValue } from '../types/board'

export type QuestionItem = {
  id?: string
  question: string
  answer: string

  media?: string
  image?: string
  mediaType?: 'image' | 'video' | 'career'
  hint?: string
  points?: PointValue
  careerImage?: string
  answerMedia?: string
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

type QuestionModule = {
  default?: Partial<QuestionCollection>
} & Partial<QuestionCollection>

function normalizeCategoryId(value: string): string {
  return value.trim().replace(/\.json$/i, '').split('/').pop() ?? value.trim()
}

const questionModules = import.meta.glob('./questions/**/*.json', {
  eager: true,
}) as Record<string, QuestionModule>

const questionLibrary = new Map<string, QuestionCollection>()

for (const [filePath, module] of Object.entries(questionModules)) {
  const collection = (module?.default ?? module) as Partial<QuestionCollection> | undefined

  if (!collection || typeof collection !== 'object') {
    continue
  }

  const sourceCategoryId = typeof collection.categoryId === 'string' ? collection.categoryId.trim() : ''
  const categoryId = sourceCategoryId || normalizeCategoryId(filePath)

  if (!categoryId) {
    continue
  }

  const nextCollection: QuestionCollection = {
    categoryId,
    questions: Array.isArray(collection.questions) ? collection.questions : [],
    questionsByPoints: collection.questionsByPoints,
    metadata: {
      sectionId: collection.metadata?.sectionId ?? '',
      updatedAt: collection.metadata?.updatedAt ?? '',
      status: collection.metadata?.status ?? 'loaded',
    },
  }

  // Always use the categoryId from the JSON file if present
  questionLibrary.set(categoryId, nextCollection)
}


const remoteQuestionLibrary = new Map<string, QuestionItem[]>()
let remoteQuestionsLoaded = false
let remoteQuestionsRequest: Promise<void> | null = null

function normalizeQuestionEntry(categoryId: string, points: PointValue, item: QuestionItem, index: number): QuestionItem {
  const stableId = item.id ?? `${categoryId}-${points}-${index}-${item.question.trim()}-${item.answer.trim()}`
  return {
    ...item,
    id: stableId,
    media: item.media || item.image || '',
    mediaType: item.mediaType || (item.image ? 'image' : undefined),
  }
}

function toQuestionItem(question: SupabaseQuestion): QuestionItem {
  return {
    id: question.id,
    question: question.question,
    answer: question.answer,
    points: question.points,
    media: question.image_url ?? undefined,
    answerMedia: question.answer_image_url ?? undefined,
    mediaType: question.image_url ? 'image' : undefined,
  }
}

function questionFingerprint(item: QuestionItem) {
  return `${item.question.trim().toLocaleLowerCase()}|${item.answer.trim().toLocaleLowerCase()}`
}

function mergeQuestionEntries(categoryId: string, entries: QuestionItem[], points?: PointValue) {
  const result: QuestionItem[] = []
  const ids = new Set<string>()
  const fingerprints = new Set<string>()

  entries.forEach((item, index) => {
    if (points !== undefined && item.points !== undefined && item.points !== points) return
    const normalized = normalizeQuestionEntry(categoryId, points ?? item.points ?? 100, item, index)
    const fingerprint = questionFingerprint(normalized)
    if (ids.has(normalized.id ?? '') || fingerprints.has(fingerprint)) return
    ids.add(normalized.id ?? '')
    fingerprints.add(fingerprint)
    result.push(normalized)
  })

  return result
}


export async function loadRemoteQuestions() {
  if (remoteQuestionsLoaded) return
  if (remoteQuestionsRequest) return remoteQuestionsRequest

  remoteQuestionsRequest = (async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Supabase questions request timed out.')), 4000)
      })
      const questions = await Promise.race([getPublicQuestions(), timeout])
      remoteQuestionLibrary.clear()
      for (const question of questions) {
        const categoryId = question.category_id.trim()
        if (!categoryId) continue
        const categoryQuestions = remoteQuestionLibrary.get(categoryId) ?? []
        categoryQuestions.push(toQuestionItem(question))
        remoteQuestionLibrary.set(categoryId, categoryQuestions)
      }
    } catch {
      // JSON remains the source of truth when Supabase is unavailable.
      remoteQuestionLibrary.clear()
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      remoteQuestionsLoaded = true
      remoteQuestionsRequest = null
    }
  })()

  return remoteQuestionsRequest
}


export function getQuestionEntries(categoryId: string): QuestionItem[] {
  const collectionItems = questionLibrary.get(categoryId)?.questions ?? []
  const remoteItems = remoteQuestionLibrary.get(categoryId) ?? []
  return mergeQuestionEntries(categoryId, [...collectionItems, ...remoteItems])
}

export function getQuestionEntriesByPoints(categoryId: string, points: PointValue): QuestionItem[] {
  const collection = questionLibrary.get(categoryId)
  const pool = collection?.questionsByPoints?.[points] ?? collection?.questions ?? []
  const filteredPool = pool.filter((item) => !item.points || item.points === points)
  const remotePool = (remoteQuestionLibrary.get(categoryId) ?? []).filter((item) => item.points === points)
  return mergeQuestionEntries(categoryId, [...filteredPool, ...remotePool], points)
}

export function hasQuestionEntries(categoryId: string): boolean {
  return getQuestionEntries(categoryId).length > 0
}
