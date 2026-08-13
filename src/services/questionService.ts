import { getSupabaseClient } from '../lib/supabaseClient'
import { deleteQuestionImage, getQuestionImageStoragePath, uploadQuestionImage } from './questionImageService'
import type { PointValue } from '../types/board'

export type SupabaseQuestion = {
  id: string
  category_id: string
  question: string
  answer: string
  points: PointValue
  image_url: string | null
  answer_image_url: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export type QuestionInput = {
  categoryId: string
  question: string
  answer: string
  points: PointValue
  image?: File | null
  answerImage?: File | null
}

export async function createQuestion(input: QuestionInput) {
  const supabase = getSupabaseClient()
  let uploaded: { storagePath: string; publicUrl: string } | undefined
  let uploadedAnswer: { storagePath: string; publicUrl: string } | undefined
  try {
    if (input.image) uploaded = await uploadQuestionImage(input.image, input.categoryId)
    if (input.answerImage) uploadedAnswer = await uploadQuestionImage(input.answerImage, input.categoryId)
    const { data, error } = await supabase
      .from('questions')
      .insert({
        category_id: input.categoryId,
        question: input.question.trim(),
        answer: input.answer.trim(),
        points: input.points,
        image_url: uploaded?.publicUrl ?? null,
        answer_image_url: uploadedAnswer?.publicUrl ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(`تعذر إنشاء السؤال: ${error.message}`)
    return data as SupabaseQuestion
  } catch (error) {
    if (uploaded) await deleteQuestionImage(uploaded.storagePath).catch(() => undefined)
    if (uploadedAnswer) await deleteQuestionImage(uploadedAnswer.storagePath).catch(() => undefined)
    throw error
  }
}

export async function getQuestions() {
  const { data, error } = await getSupabaseClient().from('questions').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(`تعذر قراءة الأسئلة: ${error.message}`)
  return (data ?? []) as SupabaseQuestion[]
}

const PUBLIC_QUESTIONS_CACHE_TTL = 60_000
let publicQuestionsCache: { expiresAt: number; questions: SupabaseQuestion[] } | null = null
let publicQuestionsRequest: Promise<SupabaseQuestion[]> | null = null

export async function getPublicQuestions() {
  if (publicQuestionsCache && publicQuestionsCache.expiresAt > Date.now()) return publicQuestionsCache.questions
  if (publicQuestionsRequest) return publicQuestionsRequest

  publicQuestionsRequest = getQuestions()
    .then((questions) => {
      publicQuestionsCache = { questions, expiresAt: Date.now() + PUBLIC_QUESTIONS_CACHE_TTL }
      return questions
    })
    .finally(() => {
      publicQuestionsRequest = null
    })

  return publicQuestionsRequest
}

export async function getQuestionById(id: string): Promise<SupabaseQuestion | null> {
  const { data, error } = await getSupabaseClient().from('questions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`تعذر قراءة السؤال: ${error.message}`)
  return data as SupabaseQuestion | null
}

export async function updateQuestion(
  id: string,
  input: QuestionInput,
  previousImageUrl?: string | null,
  previousAnswerImageUrl?: string | null,
) {
  let uploaded: { storagePath: string; publicUrl: string } | undefined
  let uploadedAnswer: { storagePath: string; publicUrl: string } | undefined
  try {
    if (input.image) uploaded = await uploadQuestionImage(input.image, input.categoryId)
    if (input.answerImage) uploadedAnswer = await uploadQuestionImage(input.answerImage, input.categoryId)
    const { data, error } = await getSupabaseClient()
      .from('questions')
      .update({
        category_id: input.categoryId,
        question: input.question.trim(),
        answer: input.answer.trim(),
        points: input.points,
        ...(uploaded ? { image_url: uploaded.publicUrl } : {}),
        ...(uploadedAnswer ? { answer_image_url: uploadedAnswer.publicUrl } : {}),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`تعذر تعديل السؤال: ${error.message}`)

    if (uploaded) {
      const previousStoragePath = getQuestionImageStoragePath(previousImageUrl)
      if (previousStoragePath) await deleteQuestionImage(previousStoragePath).catch(() => undefined)
    }
    if (uploadedAnswer) {
      const previousStoragePath = getQuestionImageStoragePath(previousAnswerImageUrl)
      if (previousStoragePath) await deleteQuestionImage(previousStoragePath).catch(() => undefined)
    }
    return data as SupabaseQuestion
  } catch (error) {
    if (uploaded) await deleteQuestionImage(uploaded.storagePath).catch(() => undefined)
    if (uploadedAnswer) await deleteQuestionImage(uploadedAnswer.storagePath).catch(() => undefined)
    throw error
  }
}

export async function deleteQuestion(
  id: string,
  imageUrl?: string | null,
  answerImageUrl?: string | null,
) {
  const { error } = await getSupabaseClient().from('questions').delete().eq('id', id)
  if (error) throw new Error(`تعذر حذف السؤال: ${error.message}`)

  const storagePath = getQuestionImageStoragePath(imageUrl)
  if (storagePath) await deleteQuestionImage(storagePath).catch(() => undefined)
  const answerStoragePath = getQuestionImageStoragePath(answerImageUrl)
  if (answerStoragePath) await deleteQuestionImage(answerStoragePath).catch(() => undefined)
}
