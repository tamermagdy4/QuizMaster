import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useAppStore } from '../../store/appStore'
import type { PackCustomQuiz, PackWithQuizzes } from '../../types/packs'
import { isCustomQuizId, packCategoryLabel, packDifficultyLabel } from '../../types/packs'
import {
  addPackFavorite,
  getMyPackRating,
  getPack,
  incrementPackPlays,
  isPackFavorite,
  ratePack,
  removePackFavorite,
} from '../../services/packService'
import { countQuestions, listCustomQuizzes } from '../../services/packQuizService'
import { createLiveRoom } from '../../services/livePackService'
import { getQuizMeta } from '../../utils/packQuizzes'
import { cn } from '../../utils/cn'

/** Display metadata for a quiz entry inside a Pack (existing or custom). */
type QuizEntryMeta = {
  quizId: string
  title: string
  titleEn: string
  icon: string
  gradient: string
  description: string
  questionCount: number
  isCustom: boolean
}

function StarRow({ value, onChange, readOnly }: { value: number; onChange?: (rating: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1" role={readOnly ? undefined : 'radiogroup'} aria-label="التقييم">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={cn('text-xl transition', onChange && !readOnly ? 'hover:scale-110' : '', star <= value ? 'text-gold' : 'text-navy/15')}
          aria-label={`${star} ${star === 1 ? 'نجمة' : 'نجوم'}`}
          role={onChange && !readOnly ? 'radio' : undefined}
          aria-checked={onChange && !readOnly ? star === value : undefined}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function PackDetails() {
  const { packId } = useParams<{ packId: string }>()
  const navigate = useNavigate()
  const english = useAppStore((state) => state.language === 'en')
  const { user } = useAuth()
  const [pack, setPack] = useState<PackWithQuizzes | null>(null)
  const [customQuizzes, setCustomQuizzes] = useState<PackCustomQuiz[]>([])
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [savingRating, setSavingRating] = useState(false)
  const [creatingLive, setCreatingLive] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!packId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getPack(packId)
      if (!data || (data.status !== 'published' && data.creator_id !== user?.id)) {
        setError(english ? 'This pack is not available.' : 'هذه الباقة غير متاحة.')
        setLoading(false)
        return
      }
      setPack(data)
      // Custom (creator-made) quizzes need their metadata from the DB.
      const custom = await listCustomQuizzes(data.id)
      setCustomQuizzes(custom)
      const counts: Record<string, number> = {}
      for (const quiz of custom) {
        counts[quiz.id] = await countQuestions(quiz.id)
      }
      setCustomCounts(counts)
      if (user) {
        setIsFavorite(await isPackFavorite(packId, user.id))
        setMyRating(await getMyPackRating(packId, user.id))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not load the pack.' : 'تعذر تحميل الباقة.'))
    } finally {
      setLoading(false)
    }
  }, [packId, user, english])

  useEffect(() => {
    void load()
  }, [load])

  const quizMetas = useMemo<QuizEntryMeta[]>(
    () =>
      (pack?.quizzes ?? [])
        .map((quiz) => {
          if (isCustomQuizId(quiz.quiz_id)) {
            const custom = customQuizzes.find((entry) => entry.id === quiz.quiz_id.slice('custom:'.length))
            if (!custom) return null
            return {
              quizId: quiz.quiz_id,
              title: custom.title,
              titleEn: custom.title,
              icon: '🧩',
              gradient: 'from-[#17324A] to-[#102433]',
              description: custom.description,
              questionCount: customCounts[custom.id] ?? 0,
              isCustom: true,
            } as QuizEntryMeta
          }
          const meta = getQuizMeta(quiz.quiz_id)
          if (!meta) return null
          return {
            quizId: quiz.quiz_id,
            title: meta.title,
            titleEn: meta.titleEn,
            icon: meta.icon,
            gradient: meta.gradient,
            description: meta.description,
            questionCount: meta.questionCount,
            isCustom: false,
          } as QuizEntryMeta
        })
        .filter((meta): meta is QuizEntryMeta => Boolean(meta)),
    [pack, customQuizzes, customCounts],
  )

  const handleToggleFavorite = async () => {
    if (!user || !pack) {
      navigate('/login', { state: { from: `/packs/${packId}` } })
      return
    }
    setSavingFavorite(true)
    try {
      if (isFavorite) {
        await removePackFavorite(pack.id, user.id)
        setIsFavorite(false)
      } else {
        await addPackFavorite(pack.id, user.id)
        setIsFavorite(true)
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Could not update favorites.' : 'تعذر تحديث المحفوظات.'))
    } finally {
      setSavingFavorite(false)
    }
  }

  const handleRate = async (rating: number) => {
    if (!user || !pack) {
      navigate('/login', { state: { from: `/packs/${packId}` } })
      return
    }
    setSavingRating(true)
    try {
      await ratePack(pack.id, rating)
      setMyRating(rating)
      setPack((current) =>
        current
          ? {
              ...current,
              ratings_count: current.ratings_count + (myRating ? 0 : 1),
              average_rating:
                current.ratings_count === 0
                  ? rating
                  : Number(((current.average_rating * (myRating ? current.ratings_count : current.ratings_count + 1) + (myRating ? rating - myRating : rating)) / (myRating ? current.ratings_count : current.ratings_count + 1)).toFixed(2)),
            }
          : current,
      )
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Could not rate the pack.' : 'تعذر تقييم الباقة.'))
    } finally {
      setSavingRating(false)
    }
  }

  const handlePlayPack = async () => {
    if (!pack) return
    void incrementPackPlays(pack.id)
    navigate(`/packs/${pack.id}/play`)
  }

  const handleCreateLive = async () => {
    if (!pack) return
    if (!user) {
      navigate('/login', { state: { from: `/packs/${pack.id}` } })
      return
    }
    setCreatingLive(true)
    try {
      const roomId = await createLiveRoom(pack.id)
      navigate(`/packs/live/${roomId}`)
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Could not create the live game.' : 'تعذر إنشاء اللعبة المباشرة.'))
      setCreatingLive(false)
    }
  }

  const handleShare = async () => {
    if (!pack) return
    const url = `${window.location.origin}/packs/${pack.id}`
    setSharing(true)
    try {
      await navigator.clipboard.writeText(url)
      setNotice(english ? 'Link copied ✓' : 'تم نسخ الرابط ✓')
    } catch {
      window.prompt(english ? 'Pack link' : 'رابط الباقة', url)
    } finally {
      setSharing(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="h-56 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
        <div className="h-40 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red/40 bg-red/10 px-6 py-10 text-center">
        <span className="text-4xl" aria-hidden>📭</span>
        <h1 className="mt-3 text-xl font-black text-red">{english ? 'Pack unavailable' : 'الباقة غير متاحة'}</h1>
        <p className="mt-2 text-sm text-muted">{error ?? (english ? 'This pack was not found.' : 'لم يتم العثور على هذه الباقة.')}</p>
        <Link to="/packs" className="btn btn-ghost mt-5 rounded-xl px-4 py-2 text-sm font-black">
          {english ? 'Back to Packs' : 'العودة إلى الباقات'}
        </Link>
      </div>
    )
  }

  const isOwner = user?.id === pack.creator_id
  const totalQuestions = quizMetas.reduce((sum, meta) => sum + (meta.questionCount ?? 0), 0)

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-5xl space-y-6">
      {/* ===== Cover hero ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
        className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 text-white shadow-panel"
      >
        {pack.cover_url ? (
          <img src={pack.cover_url} alt={pack.title} className="absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(47,125,126,0.25),transparent_70%),radial-gradient(40%_60%_at_90%_100%,rgba(201,162,39,0.12),transparent_70%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
        <div className="relative flex flex-col justify-end gap-4 p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
            <span className="rounded-full border border-white/30 bg-black/30 px-3 py-1 backdrop-blur-sm">{packCategoryLabel(pack.category, english)}</span>
            <span className="rounded-full border border-white/30 bg-black/30 px-3 py-1 backdrop-blur-sm">{packDifficultyLabel(pack.difficulty, english)}</span>
            {pack.featured && <span className="rounded-full border border-gold/60 bg-gold/20 px-3 py-1 text-gold-bright">★ {english ? 'Featured' : 'مميزة'}</span>}
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-5xl">{pack.title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">{pack.description || (english ? 'No description yet.' : 'لا يوجد وصف بعد.')}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-white/70">
            <span className="flex items-center gap-1.5">
              {pack.creator_avatar_url ? (
                <img src={pack.creator_avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">{pack.creator_name?.charAt(0) || '?'}</span>
              )}
              {english ? 'By' : 'بواسطة'} <strong className="text-white">{pack.creator_name || (english ? 'Unknown' : 'مستخدم')}</strong>
            </span>
            <span>💬 {totalQuestions} {english ? 'questions' : 'سؤال'}</span>
            <span>📚 {pack.quizzes.length} {english ? 'quizzes' : 'اختبارات'}</span>
            <span>▶ {pack.plays_count} {english ? 'plays' : 'لعب'}</span>
            <span className="flex items-center gap-1">
              <StarRow value={Math.round(Number(pack.average_rating))} readOnly />
              <span dir="ltr">{Number(pack.average_rating).toFixed(1)} ({pack.ratings_count})</span>
            </span>
            <span>📅 {new Date(pack.created_at).toLocaleDateString(english ? 'en-GB' : 'ar-EG')}</span>
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handlePlayPack()} className="btn btn-gold rounded-xl px-6 py-3 text-sm font-black shadow-[0_12px_28px_rgba(201,162,39,0.35)]">
              ▶ {english ? 'Play now' : 'العب الآن'}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateLive()}
              disabled={creatingLive}
              className="rounded-xl border border-teal/60 bg-teal/20 px-5 py-3 text-sm font-black text-teal-bright transition hover:bg-teal/30 active:translate-y-px disabled:opacity-60"
            >
              {creatingLive ? (english ? 'Creating…' : 'جارٍ الإنشاء…') : `⚡ ${english ? 'Create Live Game' : 'إنشاء لعبة مباشرة'}`}
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={sharing}
              className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {sharing ? '…' : `🔗 ${english ? 'Share' : 'مشاركة'}`}
            </button>
            <button
              type="button"
              onClick={() => void handleToggleFavorite()}
              disabled={savingFavorite}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-black transition',
                isFavorite
                  ? 'border-gold/70 bg-gold/20 text-gold-bright'
                  : 'border-white/25 bg-white/10 text-white hover:bg-white/20',
              )}
            >
              {isFavorite ? '★ ' : '☆ '}{english ? 'Saved' : 'حفظ'}
            </button>
            {isOwner && (
              <Link to={`/packs/${pack.id}/edit`} className="rounded-xl border border-teal/50 bg-teal/15 px-4 py-3 text-sm font-black text-teal-bright transition hover:bg-teal/25">
                ✎ {english ? 'Edit' : 'تعديل'}
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* ===== Rate card ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.05 }}
        className="flex flex-col gap-3 rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h3 className="font-black text-navy">{english ? 'Rate this pack' : 'قيّم هذه الباقة'}</h3>
          <p className="mt-1 text-sm text-muted">
            {myRating
              ? english ? `Your rating: ${myRating} / 5` : `تقييمك: ${myRating} / 5`
              : english ? 'Played it? Share your rating.' : 'لعبتها؟ شارك بتقييمك.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StarRow value={myRating ?? 0} onChange={savingRating ? undefined : (rating) => void handleRate(rating)} />
          {savingRating && <span className="text-sm text-muted">…</span>}
        </div>
      </motion.div>

      {/* ===== Quizzes list ===== */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-navy sm:text-2xl">
            {english ? 'Quizzes in this pack' : 'اختبارات الباقة'}
          </h2>
          <span className="rounded-full border border-border-strong bg-surface-raised px-3 py-1 text-xs font-black text-muted">
            {pack.quizzes.length} / {pack.quizzes.length}
          </span>
        </div>

        {quizMetas.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-strong bg-white/70 px-6 py-10 text-center">
            <span className="text-4xl" aria-hidden>🧩</span>
            <h3 className="mt-3 text-lg font-black text-navy">{english ? 'No quizzes yet' : 'لا توجد اختبارات بعد'}</h3>
            <p className="mt-1 text-sm text-muted">{english ? 'This pack has no quizzes yet.' : 'هذه الباقة لا تحتوي على اختبارات بعد.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizMetas.map((meta, index) => (
              <motion.div
                key={meta!.quizId}
                initial={{ opacity: 0, x: english ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.06, 0.4) }}
                className="group flex items-center gap-4 rounded-2xl border border-border-soft bg-white p-3 shadow-sm transition hover:border-gold/40 hover:shadow-panel sm:p-4"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${meta!.gradient} text-xl`}>
                  {meta!.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gold">{index + 1}</span>
                    <h3 className="truncate font-black text-navy">{english ? meta!.titleEn : meta!.title}</h3>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {meta!.description}
                    <span className="mx-1.5 text-navy/20">•</span>
                    {meta!.questionCount} {english ? 'questions' : 'سؤال'}
                    {meta!.isCustom && (
                      <span className="ms-1.5 rounded-full border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-black text-gold">
                        {english ? 'Custom' : 'مخصص'}
                      </span>
                    )}
                  </p>
                </div>
                <Link
                  to={`/packs/${pack.id}/play?quiz=${index}`}
                  className="shrink-0 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_18px_rgba(18,59,70,0.2)] transition hover:bg-navy-3"
                >
                  {english ? 'Start Quiz' : 'ابدأ الاختبار'}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-5 start-1/2 z-[80] -translate-x-1/2 rounded-2xl border border-red/40 bg-white px-5 py-3 text-sm font-bold text-red shadow-raised"
            dir={english ? 'ltr' : 'rtl'}
          >
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="ms-3 text-red/60 hover:text-red">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
