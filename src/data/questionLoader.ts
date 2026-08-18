import { isPointValue } from '../domain/contracts'
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

/**
 * Lazy glob: every question JSON becomes its OWN async chunk, loaded only when
 * `ensureLocalQuestionsLoaded()` runs (board initialization / admin pages).
 * The main bundle and pages that never touch questions (Home, Online lobby)
 * never download the ~1.8MB of question data.
 *
 * IMPORTANT — the module KEYS are available synchronously even with a lazy
 * glob, so we can still know which categories HAVE a question file at import
 * time without loading any content (used by `hasQuestionEntries`).
 */
const questionModules = import.meta.glob('./questions/**/*.json') as Record<
  string,
  () => Promise<QuestionModule>
>

/**
 * Synchronous "does this category have a local question file" set, derived
 * from the glob keys (no content is loaded). One known divergence: the file
 * `geography/Landmarks of countries.json` declares `categoryId: city-country`
 * internally, which only becomes known after loading — keep the alias so the
 * category survives the import-time filter exactly like the eager loader did.
 */
const QUESTION_FILE_ALIASES: Record<string, string> = {
  'Landmarks of countries': 'city-country',
}

const questionFileIds = new Set<string>()
for (const filePath of Object.keys(questionModules)) {
  const id = normalizeCategoryId(filePath)
  questionFileIds.add(QUESTION_FILE_ALIASES[id] ?? id)
}

const questionLibrary = new Map<string, QuestionCollection>()

let localQuestionsLoaded = false
let localQuestionsRequest: Promise<void> | null = null

/** Loads every local question JSON exactly once (idempotent, cached promise). */
export function ensureLocalQuestionsLoaded(): Promise<void> {
  if (localQuestionsLoaded) return Promise.resolve()
  if (localQuestionsRequest) return localQuestionsRequest

  localQuestionsRequest = (async () => {
    // Load all question files in parallel (they are separate small chunks).
    const loaded = await Promise.all(
      Object.values(questionModules).map((loader) => loader()),
    )
    const filePaths = Object.keys(questionModules)

    for (let index = 0; index < filePaths.length; index += 1) {
      const module = loaded[index] as QuestionModule | undefined
      const filePath = filePaths[index]
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
      // Correct the sync set for files whose internal id differs from the filename.
      questionFileIds.add(categoryId)
    }

    localQuestionsLoaded = true
  })()

  return localQuestionsRequest
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
    // Domain contract: `points` may only be one of 100 | 300 | 500. An item
    // that declares an invalid value (e.g. 250, 0, or a string) is malformed
    // and must never become a board candidate — drop it instead of silently
    // defaulting it into a valid bucket.
    if (item.points !== undefined && !isPointValue(item.points)) return
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

/**
 * True when the category has question data: a local question file, or remote
 * questions already fetched from Supabase. Synchronous and cheap — it never
 * triggers a question-file load by itself (categories.ts calls it at import).
 */
export function hasQuestionEntries(categoryId: string): boolean {
  return questionFileIds.has(categoryId) || remoteQuestionLibrary.has(categoryId)
}

/**
 * Local question entries. NOTE: this reads from the in-memory library — call
 * `ensureLocalQuestionsLoaded()` first (the board does it during
 * `initializeBoard`, admin pages gate on it). Returns [] before the load.
 */
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
