import { getSupabaseClient } from '../lib/supabaseClient'

export const QUESTION_IMAGE_BUCKET = 'question-images'
export const MAX_QUESTION_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function safeFileName(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  const base = name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'question-image'
  return `${base}-${crypto.randomUUID()}.${extension}`
}

export function validateQuestionImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('الصورة يجب أن تكون JPG أو PNG أو WEBP.')
  if (file.size === 0 || file.size > MAX_QUESTION_IMAGE_SIZE) throw new Error('حجم الصورة يجب ألا يتجاوز 5MB.')
}

export async function uploadQuestionImage(file: File, categoryId: string) {
  validateQuestionImage(file)
  const supabase = getSupabaseClient()
  const storagePath = `${categoryId}/${safeFileName(file.name)}`
  const { error } = await supabase.storage.from(QUESTION_IMAGE_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`تعذر رفع الصورة: ${error.message}`)
  const { data } = supabase.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(storagePath)
  return { storagePath, publicUrl: data.publicUrl }
}

export async function deleteQuestionImage(storagePath: string) {
  const { error } = await getSupabaseClient().storage.from(QUESTION_IMAGE_BUCKET).remove([storagePath])
  if (error) throw new Error(`تعذر حذف الصورة: ${error.message}`)
}

export function getQuestionImageStoragePath(imageUrl: string | null | undefined) {
  if (!imageUrl) return null
  const marker = `/storage/v1/object/public/${QUESTION_IMAGE_BUCKET}/`
  const markerIndex = imageUrl.indexOf(marker)
  if (markerIndex === -1) return null
  return imageUrl.slice(markerIndex + marker.length).split('?')[0].split('/').map((segment) => decodeURIComponent(segment)).join('/')
}
