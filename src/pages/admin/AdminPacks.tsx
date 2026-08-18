import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import type { PackWithQuizzes } from '../../types/packs'
import { packCategoryLabel, packDifficultyLabel } from '../../types/packs'
import {
  adminFeaturePack,
  adminHidePack,
  deletePack,
  listAllPacksForAdmin,
} from '../../services/packService'
import {
  deleteCustomQuiz,
  deleteQuestion,
  listAllCustomQuizzesForAdmin,
  listAllPackQuestionsForAdmin,
  type AdminCustomQuizRow,
  type AdminPackQuestionRow,
} from '../../services/packQuizService'
import { getQuizMeta } from '../../utils/packQuizzes'
import { cn } from '../../utils/cn'

type Tab = 'packs' | 'quizzes' | 'questions'

const TABS: { id: Tab; label: string; en: string }[] = [
  { id: 'packs', label: 'الباقات', en: 'Packs' },
  { id: 'quizzes', label: 'الاختبارات المخصصة', en: 'Custom quizzes' },
  { id: 'questions', label: 'أسئلة الباقات', en: 'Pack questions' },
]

export function AdminPacks() {
  const english = useAppStore((state) => state.language === 'en')
  const [tab, setTab] = useState<Tab>('packs')
  const [packs, setPacks] = useState<PackWithQuizzes[]>([])
  const [quizzes, setQuizzes] = useState<AdminCustomQuizRow[]>([])
  const [questions, setQuestions] = useState<AdminPackQuestionRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'pack' | 'quiz' | 'question'; id: string; label: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [packRows, quizRows, questionRows] = await Promise.all([
        listAllPacksForAdmin({ search }),
        listAllCustomQuizzesForAdmin({ search }),
        listAllPackQuestionsForAdmin({ search }),
      ])
      setPacks(packRows)
      setQuizzes(quizRows)
      setQuestions(questionRows)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Failed to load packs content.' : 'تعذر تحميل محتوى الباقات.'))
    } finally {
      setLoading(false)
    }
  }, [search, english])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, search])

  const handleHidePack = async (packId: string, hidden: boolean) => {
    try {
      await adminHidePack(packId, hidden)
      setNotice(hidden ? (english ? 'Pack hidden.' : 'تم إخفاء الباقة.') : (english ? 'Pack unhidden.' : 'تم إظهار الباقة.'))
      setPacks((current) => current.map((item) => (item.id === packId ? { ...item, status: hidden ? 'hidden' : 'published' } : item)))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Failed to update pack.' : 'تعذر تحديث الباقة.'))
    }
  }

  const handleFeaturePack = async (pack: PackWithQuizzes, featured: boolean) => {
    try {
      await adminFeaturePack(pack.id, featured)
      setNotice(featured ? (english ? 'Pack featured.' : 'تم تمييز الباقة.') : (english ? 'Feature removed.' : 'تمت إزالة التميز.'))
      setPacks((current) => current.map((item) => (item.id === pack.id ? { ...item, featured } : item)))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Failed to update pack.' : 'تعذر تحديث الباقة.'))
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      if (confirmDelete.kind === 'pack') {
        await deletePack(confirmDelete.id)
        setPacks((current) => current.filter((item) => item.id !== confirmDelete.id))
      } else if (confirmDelete.kind === 'quiz') {
        await deleteCustomQuiz(confirmDelete.id)
        setQuizzes((current) => current.filter((item) => item.id !== confirmDelete.id))
      } else {
        await deleteQuestion(confirmDelete.id)
        setQuestions((current) => current.filter((item) => item.id !== confirmDelete.id))
      }
      setNotice(english ? 'Deleted.' : 'تم الحذف.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Failed to delete.' : 'تعذر الحذف.'))
    } finally {
      setConfirmDelete(null)
    }
  }

  const countFor = (kind: Tab) => (kind === 'packs' ? packs.length : kind === 'quizzes' ? quizzes.length : questions.length)

  return (
    <div className="space-y-5" dir={english ? 'ltr' : 'rtl'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Quiz Packs</p>
          <h1 className="text-xl font-black">{english ? 'Packs content' : 'محتوى الباقات'}</h1>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={english ? 'Search packs, quizzes, creators…' : 'ابحث عن باقات أو اختبارات أو منشئين…'}
          className="w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-300/40"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={cn(
              'rounded-xl border px-4 py-2 text-sm font-black transition',
              tab === entry.id ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
            )}
          >
            {english ? entry.en : entry.label}
            <span className={cn('ms-2 rounded-full px-2 py-0.5 text-[10px]', tab === entry.id ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/10 text-slate-400')}>
              {countFor(entry.id)}
            </span>
          </button>
        ))}
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-bold text-green-300">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="text-green-300/60">✕</button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-300">
          {error}
          <button type="button" onClick={() => setError(null)} className="text-rose-300/60">✕</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : tab === 'packs' ? (
        packs.length === 0 ? (
          <EmptyState icon="📚" title={english ? 'No packs yet' : 'لا توجد باقات بعد'} text={english ? 'Packs created by users will appear here.' : 'الباقات التي ينشئها المستخدمون ستظهر هنا.'} />
        ) : (
          <div className="space-y-3">
            {packs.map((pack) => {
              const meta = pack.quizzes?.[0] ? getQuizMeta(pack.quizzes[0].quiz_id) : null
              return (
                <div key={pack.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {pack.cover_url ? (
                      <img src={pack.cover_url} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className={`flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta?.gradient ?? 'from-slate-700 to-slate-900'} text-2xl`}>
                        {meta?.icon ?? '📚'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/packs/${pack.id}`} className="truncate font-black text-slate-100 hover:text-cyan-200">
                          {pack.title}
                        </Link>
                        {pack.status === 'hidden' && <Badge tone="rose">{english ? 'HIDDEN' : 'مخفي'}</Badge>}
                        {pack.status === 'draft' && <Badge tone="amber">{english ? 'DRAFT' : 'مسودة'}</Badge>}
                        {pack.featured && <Badge tone="gold">★ {english ? 'FEATURED' : 'مميزة'}</Badge>}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {english ? 'by' : 'بواسطة'} <strong className="text-slate-300">{pack.creator_name || (english ? 'Unknown' : 'مجهول')}</strong> • {packCategoryLabel(pack.category, english)} • 📚 {pack.quizzes?.length ?? 0} • ▶ {pack.plays_count} • ★ {Number(pack.average_rating).toFixed(1)} ({pack.ratings_count})
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link to={`/packs/${pack.id}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">
                      {english ? 'View' : 'عرض'}
                    </Link>
                    <button type="button" onClick={() => void handleFeaturePack(pack, !pack.featured)} className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/10">
                      {pack.featured ? (english ? 'Unfeature' : 'إزالة التميز') : (english ? 'Feature' : 'تمييز')}
                    </button>
                    <button type="button" onClick={() => void handleHidePack(pack.id, pack.status !== 'hidden')} className="rounded-lg border border-orange-400/30 px-3 py-1.5 text-xs font-bold text-orange-300 hover:bg-orange-400/10">
                      {pack.status === 'hidden' ? (english ? 'Unhide' : 'إظهار') : (english ? 'Hide' : 'إخفاء')}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete({ kind: 'pack', id: pack.id, label: pack.title })} className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-400/10">
                      {english ? 'Delete' : 'حذف'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : tab === 'quizzes' ? (
        quizzes.length === 0 ? (
          <EmptyState icon="🧩" title={english ? 'No custom quizzes' : 'لا توجد اختبارات مخصصة'} text={english ? 'Creator-made quizzes inside packs will appear here.' : 'الاختبارات التي ينشئها المستخدمون داخل الباقات ستظهر هنا.'} />
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {quiz.cover_url ? (
                    <img src={quiz.cover_url} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#17324A] to-[#102433] text-2xl">🧩</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-black text-slate-100">{quiz.title}</span>
                      <Badge tone="teal">{english ? 'CUSTOM' : 'مخصص'}</Badge>
                      {quiz.packs?.status === 'hidden' && <Badge tone="rose">{english ? 'PACK HIDDEN' : 'الباقة مخفية'}</Badge>}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {english ? 'in pack' : 'في باقة'}{' '}
                      {quiz.packs?.title ? <Link to={`/packs/${quiz.pack_id}`} className="text-cyan-200 hover:underline">{quiz.packs.title}</Link> : (english ? '—' : '—')}
                      {' '}• {english ? 'by' : 'بواسطة'} <strong className="text-slate-300">{quiz.packs?.creator_name || (english ? 'Unknown' : 'مجهول')}</strong>
                      {' '}• {packCategoryLabel(quiz.category, english)} • {packDifficultyLabel(quiz.difficulty, english)} • {quiz.question_count ?? 0} {english ? 'questions' : 'سؤال'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {quiz.packs && (
                    <Link to={`/packs/${quiz.pack_id}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">
                      {english ? 'View pack' : 'عرض الباقة'}
                    </Link>
                  )}
                  {quiz.packs && (
                    <button
                      type="button"
                      onClick={() => void handleHidePack(quiz.pack_id, (quiz.packs?.status ?? 'published') !== 'hidden')}
                      className="rounded-lg border border-orange-400/30 px-3 py-1.5 text-xs font-bold text-orange-300 hover:bg-orange-400/10"
                    >
                      {quiz.packs?.status === 'hidden' ? (english ? 'Unhide pack' : 'إظهار الباقة') : (english ? 'Hide pack' : 'إخفاء الباقة')}
                    </button>
                  )}
                  <button type="button" onClick={() => setConfirmDelete({ kind: 'quiz', id: quiz.id, label: quiz.title })} className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-400/10">
                    {english ? 'Delete' : 'حذف'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : questions.length === 0 ? (
        <EmptyState icon="❓" title={english ? 'No pack questions' : 'لا توجد أسئلة باقات'} text={english ? 'Questions inside creator-made quizzes will appear here.' : 'الأسئلة داخل الاختبارات المخصصة ستظهر هنا.'} />
      ) : (
        <div className="space-y-3">
          {questions.map((question) => (
            <div key={question.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#17324A] to-[#102433] text-lg">❓</div>
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-100">{question.question}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    <span className="text-green-300">{question.answer}</span>
                    <span className="mx-1.5 text-slate-600">•</span>
                    {question.points} {english ? 'pts' : 'نقطة'}
                    <span className="mx-1.5 text-slate-600">•</span>
                    {packDifficultyLabel(question.difficulty, english)}
                    <span className="mx-1.5 text-slate-600">•</span>
                    {english ? 'quiz' : 'اختبار'}{' '}
                    {question.pack_custom_quizzes?.title ? <Link to={`/packs/${question.pack_custom_quizzes.pack_id}`} className="text-cyan-200 hover:underline">{question.pack_custom_quizzes.title}</Link> : (english ? '—' : '—')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {question.pack_custom_quizzes && (
                  <Link to={`/packs/${question.pack_custom_quizzes.pack_id}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">
                    {english ? 'View pack' : 'عرض الباقة'}
                  </Link>
                )}
                <button type="button" onClick={() => setConfirmDelete({ kind: 'question', id: question.id, label: question.question })} className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-400/10">
                  {english ? 'Delete' : 'حذف'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1526] p-6 text-center">
            <p className="text-4xl">🗑️</p>
            <h2 className="mt-3 text-lg font-black text-slate-100">
              {confirmDelete.kind === 'pack'
                ? (english ? 'Delete this pack?' : 'حذف هذه الباقة؟')
                : confirmDelete.kind === 'quiz'
                  ? (english ? 'Delete this quiz?' : 'حذف هذا الاختبار؟')
                  : (english ? 'Delete this question?' : 'حذف هذا السؤال؟')}
            </h2>
            <p className="mt-2 break-words text-sm text-slate-400">
              <strong className="text-slate-200">{confirmDelete.label}</strong> {english ? 'will be permanently removed.' : 'سيُحذف نهائيًا.'}
            </p>
            {confirmDelete.kind === 'quiz' && (
              <p className="mt-2 text-xs text-rose-300/80">{english ? 'All questions inside this quiz will be deleted too.' : 'ستُحذف جميع الأسئلة داخل هذا الاختبار أيضًا.'}</p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/5">
                {english ? 'Cancel' : 'إلغاء'}
              </button>
              <button type="button" onClick={() => void handleDelete()} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-black text-white hover:bg-rose-600">
                {english ? 'Delete' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Badge({ tone, children }: { tone: 'rose' | 'amber' | 'gold' | 'teal'; children: ReactNode }) {
  const classes = {
    rose: 'bg-rose-500/20 text-rose-300',
    amber: 'bg-amber-500/20 text-amber-300',
    gold: 'bg-gold/20 text-gold-bright',
    teal: 'bg-cyan-400/15 text-cyan-200',
  }
  return <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', classes[tone])}>{children}</span>
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-14 text-center">
      <p className="text-4xl">{icon}</p>
      <h2 className="mt-3 text-lg font-black">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </div>
  )
}
