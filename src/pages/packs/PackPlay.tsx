import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ensureLocalQuestionsLoaded } from '../../data/questionLoader'
import { useAppStore } from '../../store/appStore'
import { getPack, incrementPackPlays } from '../../services/packService'
import { listCustomQuizzes, listQuestions } from '../../services/packQuizService'
import type { PackCustomQuiz, PackWithQuizzes } from '../../types/packs'
import { isCustomQuizId } from '../../types/packs'
import { buildQuizQuestions, getQuizMeta, type PlayableQuestion } from '../../utils/packQuizzes'
import { cn } from '../../utils/cn'

/** Per-pack progress, persisted locally so a refresh keeps your place. */
type PackProgress = {
  completed: Record<number, { score: number; correct: number; total: number }>
  currentQuiz?: number
}

const STORAGE_KEY = (packId: string, userId: string) => `fahloy-pack-progress-${packId}-${userId}`

function readProgress(packId: string, userId: string): PackProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(packId, userId))
    const parsed = raw ? (JSON.parse(raw) as PackProgress) : null
    if (!parsed || typeof parsed.completed !== 'object') return { completed: {} }
    return parsed
  } catch {
    return { completed: {} }
  }
}

function writeProgress(packId: string, userId: string, progress: PackProgress) {
  try {
    window.localStorage.setItem(STORAGE_KEY(packId, userId), JSON.stringify(progress))
  } catch {
    // Storage may be unavailable (private mode) — progress just won't persist.
  }
}

function QuestionCard({
  question,
  index,
  total,
  onResult,
  english,
}: {
  question: PlayableQuestion
  index: number
  total: number
  onResult: (correct: boolean) => void
  english: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const isImage = question.mediaType === 'image' && question.media
  const isVideo = question.mediaType === 'video' && question.media

  const grade = (correct: boolean) => {
    if (revealed) return
    setRevealed(true)
    window.setTimeout(() => onResult(correct), 650)
  }

  return (
    <motion.div
      key={`q-${index}-${revealed}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
      className="overflow-hidden rounded-3xl border border-border-soft bg-white shadow-panel"
    >
      <div className="flex items-center justify-between border-b border-border-soft bg-surface-raised/60 px-5 py-3">
        <span className="text-xs font-black text-muted">
          {english ? `Question ${index + 1} / ${total}` : `السؤال ${index + 1} / ${total}`}
        </span>
        <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-black text-gold">
          {question.points} {english ? 'pts' : 'نقطة'}
        </span>
      </div>

      <div className="space-y-4 p-5 sm:p-7">
        {isVideo && (
          <video src={question.media} controls className="mx-auto max-h-64 w-full rounded-xl border border-border-soft bg-surface-raised object-contain" />
        )}
        {isImage && !revealed && (
          <img src={question.media} alt="" className="mx-auto max-h-64 rounded-xl border border-border-soft bg-surface-raised object-contain" />
        )}
        <p className="text-center text-lg font-black leading-[1.7] text-navy sm:text-2xl">{question.question}</p>

        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
              {question.hint && (
                <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-bold text-gold">
                  💡 {question.hint}
                </p>
              )}
              <button
                type="button"
                onClick={() => grade(false)}
                className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#20616C] to-[#123B46] px-6 py-4 text-base font-black text-white shadow-[0_14px_30px_rgba(18,59,70,0.35)] transition hover:brightness-110"
              >
                {english ? 'Reveal answer' : 'كشف الإجابة'}
              </button>
            </motion.div>
          ) : (
            <motion.div key="answer" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-green/40 bg-green/10 p-4 text-center">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-green">{english ? 'Correct answer' : 'الإجابة الصحيحة'}</p>
                <p className="mt-2 text-lg font-black leading-relaxed text-ink">{question.answer}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => grade(true)}
                  className="rounded-2xl border border-green/50 bg-green/15 px-4 py-3 text-sm font-black text-green transition hover:bg-green/25"
                >
                  ✓ {english ? 'Correct' : 'إجابة صحيحة'}
                </button>
                <button
                  type="button"
                  onClick={() => grade(false)}
                  className="rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-black text-red transition hover:bg-red/20"
                >
                  ✕ {english ? 'Wrong' : 'إجابة خاطئة'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function PackPlay() {
  const { packId } = useParams<{ packId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const english = useAppStore((state) => state.language === 'en')
  const { user } = useAuth()

  const [pack, setPack] = useState<PackWithQuizzes | null>(null)
  const [customQuizzes, setCustomQuizzes] = useState<PackCustomQuiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questionsByQuiz, setQuestionsByQuiz] = useState<PlayableQuestion[][]>([])
  const [ready, setReady] = useState(false)

  // currentQuiz: -1 = intro screen; N = quiz index in progress; done = finished
  const [currentQuiz, setCurrentQuiz] = useState<number>(-1)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [progress, setProgress] = useState<PackProgress>({ completed: {} })
  const [quizScore, setQuizScore] = useState(0)
  const [quizCorrect, setQuizCorrect] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)

  const userId = user?.id ?? 'guest'

  // Load pack + question content (through the SAME loader the board uses).
  useEffect(() => {
    if (!packId) return
    let mounted = true
    void (async () => {
      try {
        const [data] = await Promise.all([getPack(packId), ensureLocalQuestionsLoaded()])
        if (!mounted) return
        if (!data || (data.status !== 'published' && data.creator_id !== user?.id)) {
          setError(english ? 'This pack is not available.' : 'هذه الباقة غير متاحة.')
          setLoading(false)
          return
        }
        setPack(data)
        // Custom quizzes (creator-made) load their questions from Supabase;
        // existing category quizzes go through the same loader the board uses.
        const custom = await listCustomQuizzes(data.id)
        setCustomQuizzes(custom)
        const built = await Promise.all(
          data.quizzes.map(async (quiz) => {
            if (isCustomQuizId(quiz.quiz_id)) {
              const uuid = quiz.quiz_id.slice('custom:'.length)
              const rows = await listQuestions(uuid)
              return rows.map<PlayableQuestion>((question) => ({
                question: question.question,
                answer: question.answer,
                hint: question.hint ?? undefined,
                media: question.image_url ?? undefined,
                mediaType: question.image_url ? 'image' : undefined,
                points: question.points,
              }))
            }
            return buildQuizQuestions(quiz.quiz_id)
          }),
        )
        setQuestionsByQuiz(built)
        setProgress(readProgress(packId, userId))

        // Respect ?quiz=N deep link; otherwise resume last quiz or start intro.
        const deepQuiz = Number(searchParams.get('quiz'))
        if (Number.isInteger(deepQuiz) && deepQuiz >= 0 && deepQuiz < built.length) {
          setCurrentQuiz(deepQuiz)
        } else {
          const last = readProgress(packId, userId).currentQuiz
          setCurrentQuiz(last !== undefined && last >= 0 && last < built.length ? last : -1)
        }
        setReady(true)
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : (english ? 'Could not load the pack.' : 'تعذر تحميل الباقة.'))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, user?.id, english])

  useEffect(() => {
    if (packId && ready) {
      // Only count a play the first time a quiz session starts (intro → quiz).
      if (currentQuiz >= 0 && !readProgress(packId, userId).currentQuiz) {
        void incrementPackPlays(packId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuiz, ready, packId, userId])

  const questions = currentQuiz >= 0 ? questionsByQuiz[currentQuiz] ?? [] : []
  const quizMeta = (() => {
    if (currentQuiz < 0 || !pack) return null
    const quizId = pack.quizzes[currentQuiz]?.quiz_id ?? ''
    if (isCustomQuizId(quizId)) {
      const custom = customQuizzes.find((quiz) => quiz.id === quizId.slice('custom:'.length))
      if (!custom) return null
      return { title: custom.title, titleEn: custom.title }
    }
    const meta = getQuizMeta(quizId)
    if (!meta) return null
    return { title: meta.title, titleEn: meta.titleEn }
  })()

  const completedCount = Object.keys(progress.completed).length
  const totalScore = useMemo(
    () => Object.values(progress.completed).reduce((sum, entry) => sum + entry.score, 0),
    [progress.completed],
  )
  const percent = pack ? Math.round((completedCount / Math.max(pack.quizzes.length, 1)) * 100) : 0

  const startQuiz = (index: number) => {
    setCurrentQuiz(index)
    setQuestionIndex(0)
    setQuizScore(0)
    setQuizCorrect(0)
    setQuizFinished(false)
    setProgress((current) => ({ ...current, currentQuiz: index }))
    if (packId) writeProgress(packId, userId, { ...readProgress(packId, userId), currentQuiz: index })
    setSearchParams({ quiz: String(index) }, { replace: true })
  }

  const handleResult = (correct: boolean) => {
    const question = questions[questionIndex]
    const gained = correct ? question?.points ?? 0 : 0
    setQuizScore((score) => score + gained)
    if (correct) setQuizCorrect((count) => count + 1)
    if (questionIndex + 1 >= questions.length) {
      // Quiz finished → record completion.
      window.setTimeout(() => {
        const finalScore = quizScore + gained
        const finalCorrect = quizCorrect + (correct ? 1 : 0)
        setQuizFinished(true)
        setProgress((current) => {
          const next: PackProgress = {
            ...current,
            completed: { ...current.completed, [currentQuiz]: { score: finalScore, correct: finalCorrect, total: questions.length } },
            currentQuiz,
          }
          if (packId) writeProgress(packId, userId, next)
          return next
        })
      }, 700)
    } else {
      window.setTimeout(() => setQuestionIndex((index) => index + 1), 700)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-10 animate-pulse rounded-2xl bg-surface-raised" />
        <div className="h-72 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red/40 bg-red/10 px-6 py-10 text-center">
        <span className="text-4xl" aria-hidden>📭</span>
        <h1 className="mt-3 text-xl font-black text-red">{english ? 'Pack unavailable' : 'الباقة غير متاحة'}</h1>
        <p className="mt-2 text-sm text-muted">{error ?? ''}</p>
        <Link to="/packs" className="btn btn-ghost mt-5 rounded-xl px-4 py-2 text-sm font-black">
          {english ? 'Back to Packs' : 'العودة إلى الباقات'}
        </Link>
      </div>
    )
  }

  const allDone = pack.quizzes.length > 0 && completedCount >= pack.quizzes.length

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-3xl space-y-5">
      {/* ===== Progress header ===== */}
      <div className="rounded-3xl border border-border-soft bg-white/85 p-4 shadow-panel sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">{english ? 'Pack progress' : 'تقدم الباقة'}</p>
            <h1 className="mt-0.5 truncate font-display text-lg font-extrabold text-navy">{pack.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-black text-muted">
            <span>
              {completedCount} / {pack.quizzes.length} {english ? 'completed' : 'مكتملة'}
            </span>
            <span className="text-gold">★ {totalScore}</span>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-raised">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-navy via-navy-2 to-gold"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/packs/${pack.id}`} className="rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-black text-muted transition hover:border-navy hover:text-navy">
            ← {english ? 'Return to pack' : 'العودة إلى الباقة'}
          </Link>
          {pack.quizzes.map((quiz, index) => (
            <button
              key={quiz.id}
              type="button"
              onClick={() => startQuiz(index)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-black transition',
                index === currentQuiz && !quizFinished
                  ? 'border-gold bg-gold/15 text-gold'
                  : progress.completed[index]
                    ? 'border-green/50 bg-green/10 text-green'
                    : 'border-border-soft bg-surface-raised text-muted hover:border-navy/40',
              )}
            >
              {progress.completed[index] ? '✓' : index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Intro screen ===== */}
      {currentQuiz === -1 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border-soft bg-white p-8 text-center shadow-panel">
          <span className="text-5xl" aria-hidden>🎬</span>
          <h2 className="mt-4 font-display text-2xl font-extrabold text-navy">{english ? 'Ready to play?' : 'جاهز للعب؟'}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            {english
              ? `This pack contains ${pack.quizzes.length} quizzes in sequence. Answer each question, grade yourself, and complete them all.`
              : `تحتوي هذه الباقة على ${pack.quizzes.length} اختبارات بالتسلسل. أجب عن كل سؤال، قيّم نفسك، وأكملها جميعًا.`}
          </p>
          {allDone && (
            <p className="mx-auto mt-4 max-w-md rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-black text-gold">
              🎉 {english ? 'You completed this pack!' : 'أكملت هذه الباقة!'} — {english ? `Total score: ${totalScore}` : `إجمالي النقاط: ${totalScore}`}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!allDone && (
              <button
                type="button"
                onClick={() => {
                  const next = Object.keys(progress.completed).length
                  startQuiz(next < pack.quizzes.length ? next : 0)
                }}
                className="btn btn-gold rounded-xl px-6 py-3 text-sm font-black shadow-[0_12px_28px_rgba(201,162,39,0.35)]"
              >
                ▶ {english ? 'Start the pack' : 'ابدأ الباقة'}
              </button>
            )}
            <Link to={`/packs/${pack.id}`} className="btn btn-ghost rounded-xl px-5 py-3 text-sm font-black">
              {english ? 'Back to pack' : 'العودة إلى الباقة'}
            </Link>
          </div>
        </motion.div>
      )}

      {/* ===== Quiz finished summary ===== */}
      {currentQuiz >= 0 && quizFinished && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border-soft bg-white p-8 text-center shadow-panel">
          <span className="text-5xl" aria-hidden>🏁</span>
          <p className="eyebrow mt-3">{english ? 'Quiz complete' : 'اكتمل الاختبار'}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-navy">{quizMeta ? (english ? quizMeta.titleEn : quizMeta.title) : ''}</h2>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-3">
            <div className="rounded-2xl bg-surface-raised p-4">
              <span className="block text-2xl font-black text-gold">{quizScore}</span>
              <span className="mt-1 block text-[11px] font-bold text-muted">{english ? 'Score' : 'النقاط'}</span>
            </div>
            <div className="rounded-2xl bg-surface-raised p-4">
              <span className="block text-2xl font-black text-green">{quizCorrect}</span>
              <span className="mt-1 block text-[11px] font-bold text-muted">{english ? 'Correct' : 'صحيحة'}</span>
            </div>
            <div className="rounded-2xl bg-surface-raised p-4">
              <span className="block text-2xl font-black text-navy">{questions.length - quizCorrect}</span>
              <span className="mt-1 block text-[11px] font-bold text-muted">{english ? 'Wrong' : 'خاطئة'}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {currentQuiz > 0 && (
              <button type="button" onClick={() => startQuiz(currentQuiz - 1)} className="btn btn-ghost rounded-xl px-4 py-2.5 text-sm font-black">
                ← {english ? 'Previous' : 'السابق'}
              </button>
            )}
            {currentQuiz + 1 < pack.quizzes.length ? (
              <button type="button" onClick={() => startQuiz(currentQuiz + 1)} className="btn btn-gold rounded-xl px-6 py-2.5 text-sm font-black shadow-[0_12px_28px_rgba(201,162,39,0.35)]">
                {english ? 'Next quiz' : 'الاختبار التالي'} →
              </button>
            ) : (
              <Link to="/packs" className="btn btn-gold rounded-xl px-6 py-2.5 text-sm font-black shadow-[0_12px_28px_rgba(201,162,39,0.35)]">
                🎉 {english ? 'All done — back to Packs' : 'انتهيت — العودة للباقات'}
              </Link>
            )}
            <Link to={`/packs/${pack.id}`} className="btn btn-ghost rounded-xl px-4 py-2.5 text-sm font-black">
              {english ? 'Return to pack' : 'العودة إلى الباقة'}
            </Link>
          </div>
        </motion.div>
      )}

      {/* ===== Active quiz ===== */}
      {currentQuiz >= 0 && !quizFinished && (
        <AnimatePresence mode="wait">
          <QuestionCard
            key={`${currentQuiz}-${questionIndex}`}
            question={questions[questionIndex]}
            index={questionIndex}
            total={questions.length}
            onResult={handleResult}
            english={english}
          />
        </AnimatePresence>
      )}
    </div>
  )
}
