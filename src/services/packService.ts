import { getSupabaseClient } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import { getQuizMeta } from '../utils/packQuizzes'
import { isCustomQuizId } from '../types/packs'
import type {
  PackInput,
  PackListQuery,
  PackQuizRow,
  PackRow,
  PackWithQuizzes,
} from '../types/packs'

/**
 * Supabase data layer for Quiz Packs.
 *
 * Reads respect RLS: public published Packs are visible to everyone, owners
 * see their own (draft / private / hidden), admins see everything. Writes go
 * through the RLS policies and the security-definer RPCs defined in
 * supabase/migrations/004_packs.sql.
 */

export const PACK_COVER_BUCKET = 'pack-covers'
const MAX_COVER_SIZE = 5 * 1024 * 1024
const ALLOWED_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  return fallback
}

/**
 * postgrest-js returns embedded relations under the exact alias used in
 * `.select()` — snake_case `pack_quizzes` (it performs no key transformation).
 * Normalize to the `quizzes` field the rest of the app reads, sorted by
 * position. Handles both snake_case and camelCase defensively.
 */
function withQuizzes(pack: PackWithQuizzes): PackWithQuizzes {
  const raw = pack as PackWithQuizzes & {
    pack_quizzes?: PackQuizRow[]
    packQuizzes?: PackQuizRow[]
  }
  const quizzes = raw.pack_quizzes ?? raw.packQuizzes ?? []
  return {
    ...raw,
    quizzes: [...quizzes].sort((a, b) => a.position - b.position),
  }
}

function creatorInfo(user: User | null | undefined): { name: string; avatar: string | null } {
  const metadata = user?.user_metadata ?? {}
  const name =
    (typeof metadata.display_name === 'string' && metadata.display_name.trim()
      ? metadata.display_name.trim()
      : '') ||
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : '') ||
    user?.email?.split('@')[0] ||
    'مستخدم'
  const avatar =
    typeof metadata.avatar_url === 'string' && metadata.avatar_url
      ? metadata.avatar_url
      : typeof metadata.picture === 'string' && metadata.picture
        ? metadata.picture
        : null
  return { name, avatar }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Browse surface: published + public Packs, with search / category / sort.
 * Uses a single normalized query that filters safely for unauthenticated
 * users too (the anonymous client simply has no auth.uid()).
 */
export async function listPacks(query: PackListQuery = {}): Promise<PackWithQuizzes[]> {
  const supabase = getSupabaseClient()
  const {
    search,
    category,
    sort = 'featured',
    creatorId,
    limit = 40,
  } = query

  let request = supabase
    .from('packs')
    .select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (creatorId) request = request.eq('creator_id', creatorId)
  if (category && category !== 'all') request = request.eq('category', category)

  if (search && search.trim()) {
    const term = `%${search.trim().replace(/%/g, '')}%`
    request = request.or(`title.ilike.${term},description.ilike.${term},creator_name.ilike.${term}`)
  }

  switch (sort) {
    case 'popular':
      request = request.order('plays_count', { ascending: false })
      break
    case 'rated':
      request = request.order('average_rating', { ascending: false })
      break
    case 'newest':
      request = request.order('created_at', { ascending: false })
      break
    case 'featured':
      request = request.order('featured', { ascending: false }).order('plays_count', { ascending: false })
      break
  }

  const { data, error } = await request
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الباقات.'))
  return ((data ?? []) as unknown as PackWithQuizzes[]).map(withQuizzes)
}

/**
 * Featured Packs for the hero rail (published + public + featured).
 */
export async function listFeaturedPacks(limit = 6): Promise<PackWithQuizzes[]> {
  return listPacks({ sort: 'featured', limit })
}

/**
 * Fetches a single Pack by id with its ordered quizzes (RLS-scoped).
 *
 * NOTE: uses `.limit(1)` + `data[0]` instead of `.maybeSingle()` — postgrest-js
 * (supabase-js 2.x) drops embedded collections when the single-object Accept
 * header path is used, so maybeSingle() would silently return packs with
 * `quizzes: []` even though the server sends them.
 */
export async function getPack(packId: string): Promise<PackWithQuizzes | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('packs')
    .select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)')
    .eq('id', packId)
    .limit(1)
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الباقة.'))
  if (!data || data.length === 0) return null
  return withQuizzes(data[0] as unknown as PackWithQuizzes)
}

/** All Packs created by the current user (any status / visibility). */
export async function listMyPacks(userId: string): Promise<PackWithQuizzes[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('packs')
    .select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)')
    .eq('creator_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل باقاتك.'))
  return ((data ?? []) as unknown as PackWithQuizzes[]).map(withQuizzes)
}

/** Quiz ids of a Pack, in order (works for any RLS-readable Pack). */
export async function getPackQuizIds(packId: string): Promise<string[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_quizzes')
    .select('quiz_id, position')
    .eq('pack_id', packId)
    .order('position', { ascending: true })
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل اختبارات الباقة.'))
  return ((data ?? []) as { quiz_id: string }[]).map((entry) => entry.quiz_id)
}

// ---------------------------------------------------------------------------
// Writes (owner-only via RLS + RPCs)
// ---------------------------------------------------------------------------

export async function createPack(input: PackInput, user: User | null): Promise<PackRow> {
  const supabase = getSupabaseClient()
  if (!user) throw new Error('يجب تسجيل الدخول لإنشاء باقة.')
  const { name, avatar } = creatorInfo(user)
  const { data, error } = await supabase
    .from('packs')
    .insert({
      creator_id: user.id,
      creator_name: name,
      creator_avatar_url: avatar,
      title: input.title.trim(),
      description: input.description.trim(),
      cover_url: input.cover_url ?? null,
      category: input.category,
      difficulty: input.difficulty,
      visibility: input.visibility,
      status: 'draft',
      tags: input.tags,
    })
    .select()
    .single()
  if (error) throw new Error(errorMessage(error, 'تعذر إنشاء الباقة.'))
  return data as PackRow
}

export async function updatePack(packId: string, input: PackInput): Promise<PackRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('packs')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      cover_url: input.cover_url ?? null,
      category: input.category,
      difficulty: input.difficulty,
      visibility: input.visibility,
      tags: input.tags,
    })
    .eq('id', packId)
    .select()
    .single()
  if (error) throw new Error(errorMessage(error, 'تعذر حفظ الباقة.'))
  return data as PackRow
}

/** Publish or unpublish (owner-only; admins may also hide content). */
export async function setPackStatus(packId: string, status: PackRow['status']): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('packs').update({ status }).eq('id', packId)
  if (error) throw new Error(errorMessage(error, 'تعذر تحديث حالة الباقة.'))
}

export async function deletePack(packId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('packs').delete().eq('id', packId)
  if (error) throw new Error(errorMessage(error, 'تعذر حذف الباقة.'))
}

/** Replaces a Pack's ordered quiz list atomically (RPC, owner-guarded). */
export async function setPackQuizzes(packId: string, quizIds: string[]): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('set_pack_quizzes', {
    pack_id: packId,
    quiz_ids: quizIds,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر حفظ ترتيب الاختبارات.'))
}

/** Creates a copy of the current user's Pack, including its quiz list. */
export async function duplicatePack(packId: string, user: User | null): Promise<PackRow> {
  const source = await getPack(packId)
  if (!source) throw new Error('الباقة غير موجودة.')
  if (!user) throw new Error('يجب تسجيل الدخول لنسخ باقة.')

  const copy = await createPack(
    {
      title: `${source.title} (نسخة)`,
      description: source.description,
      cover_url: source.cover_url,
      category: source.category,
      difficulty: source.difficulty,
      visibility: source.visibility,
      tags: source.tags,
    },
    user,
  )
  if (source.quizzes.length > 0) {
    await setPackQuizzes(copy.id, source.quizzes.map((quiz) => quiz.quiz_id))
  }
  return copy
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function isPackFavorite(packId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_favorites')
    .select('pack_id')
    .eq('user_id', userId)
    .eq('pack_id', packId)
    .maybeSingle()
  if (error) return false
  return Boolean(data)
}

export async function addPackFavorite(packId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('pack_favorites').insert({ user_id: userId, pack_id: packId })
  if (error) throw new Error(errorMessage(error, 'تعذر حفظ الباقة.'))
}

export async function removePackFavorite(packId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('pack_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('pack_id', packId)
  if (error) throw new Error(errorMessage(error, 'تعذر إزالة الباقة من المحفوظات.'))
}

/** Packs saved by the user (published ones resolve to full Pack rows). */
export async function listFavoritePacks(userId: string): Promise<PackWithQuizzes[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_favorites')
    .select('pack_id, packs(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الباقات المحفوظة.'))
  const rows = (data ?? []) as unknown as { packs?: PackWithQuizzes | null }[]
  return rows
    .map((entry) => entry.packs)
    .filter((pack): pack is PackWithQuizzes => Boolean(pack && pack.status === 'published' && pack.visibility === 'public'))
}

// ---------------------------------------------------------------------------
// Ratings + plays (RPCs — users can never write the aggregates directly)
// ---------------------------------------------------------------------------

export async function ratePack(packId: string, rating: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('rate_pack', { pack_id: packId, rating })
  if (error) throw new Error(errorMessage(error, 'تعذر تقييم الباقة.'))
}

export async function getMyPackRating(packId: string, userId: string): Promise<number | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pack_ratings')
    .select('rating')
    .eq('user_id', userId)
    .eq('pack_id', packId)
    .maybeSingle()
  if (error) return null
  return data ? Number(data.rating) : null
}

export async function incrementPackPlays(packId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('increment_pack_plays', { pack_id: packId })
  if (error) {
    // A failed play-counter must never block starting the game.
    console.warn('[packs] failed to increment plays', error)
  }
}

// ---------------------------------------------------------------------------
// Cover images
// ---------------------------------------------------------------------------

export function validateCoverImage(file: File): void {
  if (!ALLOWED_COVER_TYPES.has(file.type)) {
    throw new Error('صورة الغلاف يجب أن تكون JPG أو PNG أو WEBP.')
  }
  if (file.size === 0 || file.size > MAX_COVER_SIZE) {
    throw new Error('حجم صورة الغلاف يجب ألا يتجاوز 5MB.')
  }
}

function safeCoverFileName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const base = name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'pack-cover'
  return `${base}-${crypto.randomUUID()}.${extension}`
}

export async function uploadPackCover(file: File, userId: string): Promise<{ storagePath: string; publicUrl: string }> {
  validateCoverImage(file)
  const supabase = getSupabaseClient()
  // Folder = user id so users can only ever delete their own uploads.
  const storagePath = `${userId}/${safeCoverFileName(file.name)}`
  const { error } = await supabase.storage.from(PACK_COVER_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(errorMessage(error, 'تعذر رفع صورة الغلاف.'))
  const { data } = supabase.storage.from(PACK_COVER_BUCKET).getPublicUrl(storagePath)
  return { storagePath, publicUrl: data.publicUrl }
}

export function getCoverStoragePath(coverUrl: string | null | undefined): string | null {
  if (!coverUrl) return null
  const marker = `/storage/v1/object/public/${PACK_COVER_BUCKET}/`
  const markerIndex = coverUrl.indexOf(marker)
  if (markerIndex === -1) return null
  return coverUrl
    .slice(markerIndex + marker.length)
    .split('?')[0]
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')
}

// ---------------------------------------------------------------------------
// Admin (all rows, plus hide/feature/delete — admin RLS allows full access)
// ---------------------------------------------------------------------------

export async function listAllPacksForAdmin(query: { search?: string; limit?: number } = {}): Promise<PackWithQuizzes[]> {
  const supabase = getSupabaseClient()
  let request = supabase
    .from('packs')
    .select('*, pack_quizzes(id, pack_id, quiz_id, position, created_at)')
    .order('created_at', { ascending: false })
    .limit(query.limit ?? 200)
  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`
    request = request.or(`title.ilike.${term},creator_name.ilike.${term}`)
  }
  const { data, error } = await request
  if (error) throw new Error(errorMessage(error, 'تعذر تحميل الباقات.'))
  return ((data ?? []) as unknown as PackWithQuizzes[]).map(withQuizzes)
}

export async function adminHidePack(packId: string, hidden: boolean): Promise<void> {
  await setPackStatus(packId, hidden ? 'hidden' : 'published')
}

export async function adminFeaturePack(packId: string, featured: boolean): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('packs').update({ featured }).eq('id', packId)
  if (error) throw new Error(errorMessage(error, 'تعذر تحديث الباقة.'))
}

// ---------------------------------------------------------------------------
// Browse enrichment (real counts, no fake numbers)
// ---------------------------------------------------------------------------

/**
 * Attaches the real total question count to every Pack, in one pass:
 * custom quizzes are counted from pack_questions (single grouped query), and
 * existing category quizzes use the category's real question pool size from
 * the questionLoader metadata. Best-effort: on failure counts stay undefined.
 */
export async function attachPackQuestionCounts(packs: PackWithQuizzes[]): Promise<PackWithQuizzes[]> {
  if (packs.length === 0) return packs
  const customIds = new Set<string>()
  for (const pack of packs) {
    for (const quiz of pack.quizzes) {
      if (isCustomQuizId(quiz.quiz_id)) customIds.add(quiz.quiz_id.slice('custom:'.length))
    }
  }

  const customTally: Record<string, number> = {}
  if (customIds.size > 0) {
    try {
      // Head-count per quiz: exact regardless of PostgREST row limits
      // (a plain .in() SELECT would cap at 1000 rows and truncate tallies).
      const supabase = getSupabaseClient()
      const counts = await Promise.all(
        [...customIds].map(async (quizId) => {
          const { count, error } = await supabase
            .from('pack_questions')
            .select('id', { count: 'exact', head: true })
            .eq('quiz_id', quizId)
          return { quizId, count: error ? 0 : (count ?? 0) }
        }),
      )
      for (const row of counts) customTally[row.quizId] = row.count
    } catch {
      // keep counts undefined
    }
  }

  for (const pack of packs) {
    let total = 0
    for (const quiz of pack.quizzes) {
      if (isCustomQuizId(quiz.quiz_id)) {
        total += customTally[quiz.quiz_id.slice('custom:'.length)] ?? 0
      } else {
        total += getQuizMeta(quiz.quiz_id)?.questionCount ?? 0
      }
    }
    pack.question_count_total = total
  }
  return packs
}

/** Real public published Pack counts per category (from the 016 view). */
export async function getPackCategoryStats(): Promise<Record<string, number>> {
  const supabase = getSupabaseClient()
  try {
    const { data, error } = await supabase.from('pack_category_stats').select('category, pack_count')
    if (error || !data) return {}
    const stats: Record<string, number> = {}
    for (const row of data as { category: string; pack_count: number }[]) {
      stats[row.category] = Number(row.pack_count ?? 0)
    }
    return stats
  } catch {
    return {}
  }
}

/** Convenience re-export so callers don't import the row type directly. */
export type { PackQuizRow }
