import type { User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import type {
  ImportedQuestion,
  PackCustomQuiz,
  PackCustomQuizInput,
  PackQuestion,
  PackQuestionInput,
  QuestionExportFormat,
} from '../types/packs'
import { makeCustomQuizId } from '../types/packs'

/**
 * Data layer for creator-made quizzes + questions inside Packs.
 *
 * RLS (migration 005) enforces ownership: only the Pack owner (or an admin)
 * can write; anyone can read public published content. All writes go through
 * the normal PostgREST API — the policies guard every row.
 */

export const QUIZ_COVER_BUCKET = 'quiz-covers'
const MAX_COVER_SIZE = 5 * 1024 * 1024
const ALLOWED_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  return fallback
}

// ---------------------------------------------------------------------------
// Custom quizzes
// ---------------------------------------------------------------------------

export async function createCustomQuiz(
  packId: string,
  input: PackCustomQuizInput,
  user: User | null,
): Promise<PackCustomQuiz> {
  const supabase = getSupabaseClient()
  if (!user) throw new Error('يجب تسجيل الدخول لإنشاء اختبار.')
  const { data, error } = await supabase
    .from('pack_custom_quizzes')
    .insert({
      pack_id: packId,
      creator_id: user.id,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      difficulty: input.difficulty,
      cover_url: input.cover_url ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(errorMessage(error, 'تعذر إنشاء الاختبار.'))
  return data as PackCustomQuiz
}

export async function updateCustomQuiz(
  quizId: string,
  input: PackCustomQuizInput,
): Promise<PackCustomQuiz> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_custom_quizzes')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      difficulty: input.difficulty,
      cover_url: input.cover_url ?? null,
    })
    .eq('id', quizId)
    .select()
    .single()
  if (error) throw new Error(errorMessage(error, 'تعذر حفظ الاختبار.'))
  return data as PackCustomQuiz
}

export async function deleteCustomQuiz(quizId: string): Promise<void> {
  const supabase = getSupabaseClient()
  // Questions cascade via the FK. pack_quizzes rows are removed by the caller
  // through setPackQuizzes (they hold "custom:<uuid>" references).
  const { error } = await supabase.from('pack_custom_quizzes').delete().eq('id', quizId)
  if (error) throw new Error(errorMessage(error, 'تعذر حذف الاختبار.'))
}

export async function getCustomQuiz(quizId: string): Promise<PackCustomQuiz | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_custom_quizzes')
    .select('*')
    .eq('id', quizId)
    .maybeSingle()
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الاختبار.'))
  return (data as PackCustomQuiz | null) ?? null
}

/** All custom quizzes that belong to a Pack (owner/reader scoped by RLS). */
export async function listCustomQuizzes(packId: string): Promise<PackCustomQuiz[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_custom_quizzes')
    .select('*')
    .eq('pack_id', packId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الاختبارات.'))
  return (data ?? []) as PackCustomQuiz[]
}

/** Resolves a quiz_id ("custom:<uuid>" or a category id) to its display title. */
export async function resolveQuizTitle(
  quizId: string,
): Promise<{ title: string; isCustom: boolean } | null> {
  if (quizId.startsWith('custom:')) {
    const custom = await getCustomQuiz(quizId.slice('custom:'.length))
    if (!custom) return null
    return { title: custom.title, isCustom: true }
  }
  return { title: quizId, isCustom: false }
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function listQuestions(quizId: string): Promise<PackQuestion[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('position', { ascending: true })
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الأسئلة.'))
  return (data ?? []) as PackQuestion[]
}

export async function countQuestions(quizId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const { count, error } = await supabase
    .from('pack_questions')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
  if (error) return 0
  return count ?? 0
}

export async function createQuestion(
  quizId: string,
  input: PackQuestionInput,
  user: User | null,
): Promise<PackQuestion> {
  const supabase = getSupabaseClient()
  if (!user) throw new Error('يجب تسجيل الدخول لإضافة سؤال.')
  const { count } = await supabase
    .from('pack_questions')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
  const { data, error } = await supabase
    .from('pack_questions')
    .insert({
      quiz_id: quizId,
      creator_id: user.id,
      question: input.question.trim(),
      answer: input.answer.trim(),
      points: input.points,
      difficulty: input.difficulty,
      hint: input.hint?.trim() ? input.hint.trim() : null,
      image_url: input.image_url?.trim() ? input.image_url.trim() : null,
      answer_image_url: input.answer_image_url?.trim() ? input.answer_image_url.trim() : null,
      position: count ?? 0,
    })
    .select()
    .single()
  if (error) throw new Error(errorMessage(error, 'تعذر إضافة السؤال.'))
  return data as PackQuestion
}

export async function updateQuestion(questionId: string, input: PackQuestionInput): Promise<PackQuestion> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_questions')
    .update({
      question: input.question.trim(),
      answer: input.answer.trim(),
      points: input.points,
      difficulty: input.difficulty,
      hint: input.hint?.trim() ? input.hint.trim() : null,
      image_url: input.image_url?.trim() ? input.image_url.trim() : null,
      answer_image_url: input.answer_image_url?.trim() ? input.answer_image_url.trim() : null,
    })
    .eq('id', questionId)
    .select()
    .single()
  if (error) throw new Error(errorMessage(error, 'تعذر حفظ السؤال.'))
  return data as PackQuestion
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('pack_questions').delete().eq('id', questionId)
  if (error) throw new Error(errorMessage(error, 'تعذر حذف السؤال.'))
}

/**
 * Batch-inserts many questions into one quiz in a single request, with a
 * running position. Used by the import flow (hundreds/thousands of rows).
 */
export async function insertQuestionsBatch(
  quizId: string,
  inputs: PackQuestionInput[],
  user: User | null,
): Promise<number> {
  if (inputs.length === 0) return 0
  const supabase = getSupabaseClient()
  if (!user) throw new Error('يجب تسجيل الدخول لاستيراد الأسئلة.')

  const { count } = await supabase
    .from('pack_questions')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
  const startPosition = count ?? 0

  const rows = inputs.map((input, index) => ({
    quiz_id: quizId,
    creator_id: user.id,
    question: input.question.trim(),
    answer: input.answer.trim(),
    points: input.points,
    difficulty: input.difficulty,
    hint: input.hint?.trim() ? input.hint.trim() : null,
    image_url: input.image_url?.trim() ? input.image_url.trim() : null,
    answer_image_url: input.answer_image_url?.trim() ? input.answer_image_url.trim() : null,
    position: startPosition + index,
  }))

  // Chunk large imports so a single request stays reasonable.
  const CHUNK = 500
  for (let index = 0; index < rows.length; index += CHUNK) {
    const { error } = await supabase.from('pack_questions').insert(rows.slice(index, index + CHUNK))
    if (error) throw new Error(errorMessage(error, 'تعذر استيراد الأسئلة.'))
  }
  return rows.length
}

/** Reorders a quiz's questions by rewriting positions (one request). */
export async function reorderQuestions(_quizId: string, orderedIds: string[]): Promise<void> {
  const supabase = getSupabaseClient()
  const rows = orderedIds.map((id, index) => ({ id, position: index }))
  if (rows.length === 0) return
  const { error } = await supabase.from('pack_questions').upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(errorMessage(error, 'تعذر حفظ ترتيب الأسئلة.'))
}

/** Imports validated rows into a quiz (used after the preview is confirmed). */
export async function importQuestions(
  quizId: string,
  rows: ImportedQuestion[],
  user: User | null,
): Promise<number> {
  const valid = rows.filter((row) => !row.error && row.question && row.answer)
  return insertQuestionsBatch(
    quizId,
    valid.map((row) => ({
      question: row.question,
      answer: row.answer,
      points: row.points,
      difficulty: row.difficulty,
      hint: row.hint || null,
      image_url: row.imageUrl || null,
      answer_image_url: row.answerImageUrl || null,
    })),
    user,
  )
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Serializes a quiz's questions into the requested export format. */
export async function exportQuestions(
  quizId: string,
  format: QuestionExportFormat,
): Promise<{ filename: string; content: string; mime: string }> {
  const questions = await listQuestions(quizId)
  const quiz = await getCustomQuiz(quizId)
  const base = (quiz?.title ?? 'quiz').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60)

  if (format === 'json') {
    return {
      filename: `${base}.json`,
      content: JSON.stringify(
        {
          categoryId: quiz?.category ?? 'general',
          questions: questions.map((question) => ({
            question: question.question,
            answer: question.answer,
            points: question.points,
            difficulty: question.difficulty,
            hint: question.hint,
            image: question.image_url,
            answer_image: question.answer_image_url,
          })),
        },
        null,
        2,
      ),
      mime: 'application/json',
    }
  }

  if (format === 'csv') {
    const header = 'question,answer,points,difficulty,hint,image,answer_image'
    const escape = (value: string | null | undefined) => {
      const text = value ?? ''
      return `"${text.replace(/"/g, '""')}"`
    }
    const lines = questions.map((question) =>
      [
        escape(question.question),
        escape(question.answer),
        question.points,
        question.difficulty,
        escape(question.hint),
        escape(question.image_url),
        escape(question.answer_image_url),
      ].join(','),
    )
    return { filename: `${base}.csv`, content: [header, ...lines].join('\n'), mime: 'text/csv' }
  }

  const lines = questions.map(
    (question) => `Question: ${question.question}\nAnswer: ${question.answer}\n`,
  )
  return { filename: `${base}.txt`, content: lines.join('\n'), mime: 'text/plain' }
}

/** Downloads an exported file using the browser's Blob API. */
export function downloadExport(file: { filename: string; content: string; mime: string }): void {
  const blob = new Blob([file.content], { type: file.mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------------------
// Cover images (custom quiz covers — same pattern as Pack covers)
// ---------------------------------------------------------------------------

export function validateQuizCover(file: File): void {
  if (!ALLOWED_COVER_TYPES.has(file.type)) {
    throw new Error('صورة الغلاف يجب أن تكون JPG أو PNG أو WEBP.')
  }
  if (file.size === 0 || file.size > MAX_COVER_SIZE) {
    throw new Error('حجم صورة الغلاف يجب ألا يتجاوز 5MB.')
  }
}

export async function uploadQuizCover(
  file: File,
  userId: string,
): Promise<{ storagePath: string; publicUrl: string }> {
  validateQuizCover(file)
  const supabase = getSupabaseClient()
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const base = file.name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'quiz-cover'
  const storagePath = `${userId}/${base}-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(QUIZ_COVER_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر رفع صورة الغلاف.'))
  const { data } = supabase.storage.from(QUIZ_COVER_BUCKET).getPublicUrl(storagePath)
  return { storagePath, publicUrl: data.publicUrl }
}

/** The pack_quizzes key for a custom quiz (used when building the list). */
export function customQuizKey(customQuizId: string): string {
  return makeCustomQuizId(customQuizId)
}

// ---------------------------------------------------------------------------
// Admin (all rows, plus hide/delete — admin RLS allows full access)
// ---------------------------------------------------------------------------

/** A custom quiz enriched with its parent pack + creator display info. */
export interface AdminCustomQuizRow extends PackCustomQuiz {
  packs?: { title: string; creator_name?: string; status?: string } | null
  question_count?: number
}

/** A pack question enriched with its quiz + pack display info. */
export interface AdminPackQuestionRow extends PackQuestion {
  pack_custom_quizzes?: { title: string; pack_id: string } | null
}

/**
 * Lists every creator-made quiz for the admin workspace. The pack title and
 * creator name come from the parent packs table; question counts are
 * aggregated in a second query and merged by quiz id.
 */
export async function listAllCustomQuizzesForAdmin(query: {
  search?: string
  limit?: number
} = {}): Promise<AdminCustomQuizRow[]> {
  const supabase = getSupabaseClient()
  let request = supabase
    .from('pack_custom_quizzes')
    .select('*, packs(title, creator_name, status)')
    .order('created_at', { ascending: false })
    .limit(query.limit ?? 200)
  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`
    request = request.or(`title.ilike.${term},packs.title.ilike.${term},packs.creator_name.ilike.${term}`)
  }
  const { data, error } = await request
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الاختبارات المخصصة.'))
  const rows = (data ?? []) as AdminCustomQuizRow[]

  // Aggregate question counts for the visible quizzes in one query.
  const ids = rows.map((quiz) => quiz.id)
  if (ids.length > 0) {
    const { data: counts, error: countError } = await supabase
      .from('pack_questions')
      .select('quiz_id')
      .in('quiz_id', ids)
    if (!countError && counts) {
      const tally: Record<string, number> = {}
      for (const row of counts as { quiz_id: string }[]) {
        tally[row.quiz_id] = (tally[row.quiz_id] ?? 0) + 1
      }
      for (const row of rows) row.question_count = tally[row.id] ?? 0
    }
  }
  return rows
}

/**
 * Lists every creator-made question for the admin workspace, with its quiz
 * title and parent pack id for navigation.
 */
/** Statistics row from the pack_stats view (migration 011). */
export interface PackStatistics {
  totalCustomQuizzes: number
  totalPackQuestions: number
  avgPoints: number
  questionsWithImages: number
  totalCreators: number
  topCreators: PackCreatorStat[]
}

/** One creator's activity row from the pack_creator_stats view. */
export interface PackCreatorStat {
  creatorId: string
  creatorName: string
  quizCount: number
  questionCount: number
  avgPoints: number
}

const EMPTY_STATISTICS: PackStatistics = {
  totalCustomQuizzes: 0,
  totalPackQuestions: 0,
  avgPoints: 0,
  questionsWithImages: 0,
  totalCreators: 0,
  topCreators: [],
}

/**
 * Loads the admin statistics for creator-made quizzes/questions from the
 * pack_stats / pack_creator_stats views. RLS scopes the rows to what the
 * current user may read (admins see everything). Returns empty defaults on
 * any failure so the stats page degrades gracefully.
 */
export async function getPackStatisticsForAdmin(): Promise<PackStatistics> {
  const supabase = getSupabaseClient()
  try {
    const { data: stats, error: statsError } = await supabase
      .from('pack_stats')
      .select('*')
      .maybeSingle()
    if (statsError || !stats) return EMPTY_STATISTICS

    const { data: creators, error: creatorsError } = await supabase
      .from('pack_creator_stats')
      .select('*')
      .order('custom_quiz_count', { ascending: false })
      .limit(5)
    if (creatorsError || !creators) return EMPTY_STATISTICS

    return {
      totalCustomQuizzes: Number(stats.total_custom_quizzes ?? 0),
      totalPackQuestions: Number(stats.total_pack_questions ?? 0),
      avgPoints: Number(stats.avg_points ?? 0),
      questionsWithImages: Number(stats.questions_with_images ?? 0),
      totalCreators: Number(stats.total_creators ?? 0),
      topCreators: (creators as Record<string, unknown>[]).map((creator) => ({
        creatorId: String(creator.creator_id ?? ''),
        creatorName: String(creator.creator_name ?? 'مستخدم'),
        quizCount: Number(creator.custom_quiz_count ?? 0),
        questionCount: Number(creator.pack_question_count ?? 0),
        avgPoints: Number(creator.avg_points ?? 0),
      })),
    }
  } catch {
    return EMPTY_STATISTICS
  }
}

export async function listAllPackQuestionsForAdmin(query: {
  search?: string
  quizId?: string
  limit?: number
} = {}): Promise<AdminPackQuestionRow[]> {
  const supabase = getSupabaseClient()
  let request = supabase
    .from('pack_questions')
    .select('*, pack_custom_quizzes(title, pack_id)')
    .order('created_at', { ascending: false })
    .limit(query.limit ?? 200)
  if (query.quizId) request = request.eq('quiz_id', query.quizId)
  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`
    request = request.or(`question.ilike.${term},answer.ilike.${term}`)
  }
  const { data, error } = await request
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل أسئلة الباقات.'))
  return (data ?? []) as AdminPackQuestionRow[]
}
