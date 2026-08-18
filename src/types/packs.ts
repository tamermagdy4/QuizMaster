/**
 * Quiz Packs — a curated, ordered collection of existing quizzes.
 *
 * In Fahloy a "quiz" IS a category: each category owns a question pool
 * (100 / 300 / 500 points). `pack_quizzes.quiz_id` stores a category id, so
 * playing a Pack quiz reuses the exact same question system as the board.
 */

export type PackVisibility = 'public' | 'private'
export type PackStatus = 'draft' | 'published' | 'hidden'
export type PackDifficulty = 'easy' | 'medium' | 'hard'

export interface PackRow {
  id: string
  creator_id: string
  title: string
  description: string
  cover_url: string | null
  category: string
  difficulty: PackDifficulty
  visibility: PackVisibility
  status: PackStatus
  featured: boolean
  plays_count: number
  average_rating: number
  ratings_count: number
  tags: string[]
  created_at: string
  updated_at: string
}

export interface PackQuizRow {
  id: string
  pack_id: string
  /** Category id — the existing quiz identity in Fahloy. */
  quiz_id: string
  position: number
  created_at: string
}

/** A Pack enriched with its ordered quizzes + creator display info. */
export interface PackWithQuizzes extends PackRow {
  quizzes: PackQuizRow[]
  creator_name?: string
  creator_avatar_url?: string | null
  /** Real total question count across all quizzes (set by the service). */
  question_count_total?: number
}

export interface PackInput {
  title: string
  description: string
  cover_url?: string | null
  category: string
  difficulty: PackDifficulty
  visibility: PackVisibility
  tags: string[]
}

/** Input for replacing a Pack's quiz list (delete + insert, ordered). */
export interface PackQuizzesInput {
  packId: string
  quizIds: string[]
}

export type PackSort = 'popular' | 'rated' | 'newest' | 'featured'

export interface PackListQuery {
  search?: string
  category?: string
  sort?: PackSort
  visibility?: PackVisibility
  creatorId?: string
  /** Only published public Packs (the public browse surface). */
  publicOnly?: boolean
  limit?: number
}

/** The fixed category menu shown on the Packs browse / editor. */
export const PACK_CATEGORIES: { id: string; label: string; en: string; icon: string }[] = [
  { id: 'sports', label: 'رياضة', en: 'Sports', icon: '⚽' },
  { id: 'football', label: 'كرة القدم', en: 'Football', icon: '🏆' },
  { id: 'movies', label: 'أفلام', en: 'Movies', icon: '🎬' },
  { id: 'series', label: 'مسلسلات', en: 'Series', icon: '📺' },
  { id: 'geography', label: 'جغرافيا', en: 'Geography', icon: '🌍' },
  { id: 'history', label: 'تاريخ', en: 'History', icon: '🏛️' },
  { id: 'science', label: 'علوم', en: 'Science', icon: '🔬' },
  { id: 'general', label: 'معلومات عامة', en: 'General', icon: '✨' },
  { id: 'games', label: 'ألعاب', en: 'Games', icon: '🎮' },
  { id: 'celebrities', label: 'مشاهير', en: 'Celebrities', icon: '⭐' },
]

export function packCategoryLabel(id: string, english: boolean): string {
  const found = PACK_CATEGORIES.find((category) => category.id === id)
  if (found) return english ? found.en : found.label
  return id
}

export const PACK_DIFFICULTIES: { id: PackDifficulty; label: string; en: string }[] = [
  { id: 'easy', label: 'سهل', en: 'Easy' },
  { id: 'medium', label: 'متوسط', en: 'Medium' },
  { id: 'hard', label: 'صعب', en: 'Hard' },
]

export function packDifficultyLabel(id: PackDifficulty, english: boolean): string {
  const found = PACK_DIFFICULTIES.find((entry) => entry.id === id)
  return found ? (english ? found.en : found.label) : id
}

// ---------------------------------------------------------------------------
// Creator-made quizzes + questions (custom quiz content inside a Pack)
// ---------------------------------------------------------------------------

/**
 * A quiz authored by the Pack creator (Sporcle-style authoring).
 * Referenced from pack_quizzes.quiz_id as `custom:<id>`.
 */
export interface PackCustomQuiz {
  id: string
  pack_id: string
  creator_id: string
  title: string
  description: string
  category: string
  difficulty: PackDifficulty
  cover_url: string | null
  created_at: string
  updated_at: string
}

/** A single question inside a creator-made quiz. */
export interface PackQuestion {
  id: string
  quiz_id: string
  creator_id: string
  question: string
  answer: string
  points: number
  difficulty: PackDifficulty
  hint: string | null
  image_url: string | null
  answer_image_url: string | null
  position: number
  created_at: string
  updated_at: string
}

/** Input used to create/update a custom quiz. */
export interface PackCustomQuizInput {
  title: string
  description: string
  category: string
  difficulty: PackDifficulty
  cover_url?: string | null
}

/** Input used to create/update a question row. */
export interface PackQuestionInput {
  question: string
  answer: string
  points: number
  difficulty: PackDifficulty
  hint?: string | null
  image_url?: string | null
  answer_image_url?: string | null
}

/** quiz_id convention for creator-made quizzes inside pack_quizzes. */
export const CUSTOM_QUIZ_PREFIX = 'custom:'

export function isCustomQuizId(quizId: string): boolean {
  return quizId.startsWith(CUSTOM_QUIZ_PREFIX)
}

export function makeCustomQuizId(customQuizId: string): string {
  return `${CUSTOM_QUIZ_PREFIX}${customQuizId}`
}

export function customQuizUuid(quizId: string): string {
  return quizId.slice(CUSTOM_QUIZ_PREFIX.length)
}

// ---------------------------------------------------------------------------
// Question import / export
// ---------------------------------------------------------------------------

/** A parsed, validated row ready to become a PackQuestion. */
export interface ImportedQuestion {
  question: string
  answer: string
  points: number
  difficulty: PackDifficulty
  hint: string
  imageUrl: string
  answerImageUrl: string
  /** null when the row is valid; otherwise a localized problem description. */
  error?: string
}

/** Result of parsing an import source (paste text or uploaded file). */
export interface ImportParseResult {
  /** Format detected, e.g. 'txt', 'csv', 'json', 'xlsx', 'paste'. */
  format: string
  rows: ImportedQuestion[]
  validCount: number
  invalidCount: number
  /** Human-readable notes (e.g. skipped empty rows). */
  notes: string[]
}

export type QuestionExportFormat = 'json' | 'csv' | 'txt'
