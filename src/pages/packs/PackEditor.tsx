import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useAppStore } from '../../store/appStore'
import type {
  PackCustomQuiz,
  PackDifficulty,
  PackRow,
} from '../../types/packs'
import { PACK_CATEGORIES, PACK_DIFFICULTIES, isCustomQuizId, customQuizUuid } from '../../types/packs'
import {
  createPack,
  getPack,
  setPackQuizzes,
  setPackStatus,
  updatePack,
  uploadPackCover,
} from '../../services/packService'
import {
  countQuestions,
  deleteCustomQuiz,
  listCustomQuizzes,
} from '../../services/packQuizService'
import { getQuizCatalog, getQuizMeta } from '../../utils/packQuizzes'
import { QuestionBuilder } from '../../components/packs/QuestionBuilder'
import { QuizCreateModal } from '../../components/packs/QuizCreateModal'
import { ImportModal } from '../../components/packs/ImportModal'
import { cn } from '../../utils/cn'

type EditorStep = 'info' | 'quizzes' | 'questions' | 'review'

const STEPS: { id: EditorStep; label: string; en: string }[] = [
  { id: 'info', label: 'معلومات الباقة', en: 'Pack info' },
  { id: 'quizzes', label: 'الاختبارات', en: 'Quizzes' },
  { id: 'questions', label: 'الأسئلة', en: 'Questions' },
  { id: 'review', label: 'المراجعة والنشر', en: 'Review & publish' },
]

type QuizSelection = { meta: { quizId: string; title: string; titleEn: string; icon: string; gradient: string; questionCount: number } | null; position: number }

function StepIndicator({ step, onStep, english }: { step: EditorStep; onStep: (step: EditorStep) => void; english: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((entry, index) => {
        const active = entry.id === step
        const done = STEPS.findIndex((s) => s.id === step) > index
        return (
          <div key={entry.id} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-6 bg-border-strong" aria-hidden />}
            <button
              type="button"
              onClick={() => onStep(entry.id)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition',
                active ? 'border-gold bg-gold/15 text-gold' : done ? 'border-green/50 bg-green/10 text-green' : 'border-border-soft bg-surface-raised text-muted hover:border-navy/40 hover:text-navy',
              )}
            >
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', active ? 'bg-gold text-white' : done ? 'bg-green text-white' : 'bg-border-strong/40 text-white/70')}>
                {done ? '✓' : index + 1}
              </span>
              {english ? entry.en : entry.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function QuizPicker({
  selectedIds,
  onAdd,
  english,
}: {
  selectedIds: string[]
  onAdd: (quizId: string) => void
  english: boolean
}) {
  const catalog = useMemo(() => getQuizCatalog(), [])
  const [search, setSearch] = useState('')
  const [section, setSection] = useState<string>('all')
  const sections = useMemo(() => {
    const seen = new Set<string>()
    for (const quiz of catalog) seen.add(quiz.sectionId)
    return [...seen]
  }, [catalog])

  const filtered = useMemo(
    () =>
      catalog.filter(
        (quiz) =>
          (section === 'all' || quiz.sectionId === section) &&
          (!search.trim() ||
            quiz.title.toLowerCase().includes(search.trim().toLowerCase()) ||
            quiz.titleEn.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [catalog, search, section],
  )

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-raised/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={english ? 'Search existing quizzes…' : 'ابحث عن اختبارات موجودة…'}
          className="flex-1 rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
        />
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSection('all')}
            className={cn('shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-black transition', section === 'all' ? 'border-navy bg-navy text-white' : 'border-border-soft bg-white text-muted')}
          >
            {english ? 'All' : 'الكل'}
          </button>
          {sections.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn('shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-black transition', section === id ? 'border-navy bg-navy text-white' : 'border-border-soft bg-white text-muted')}
            >
              {english ? id : id}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pe-1">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm font-bold text-muted">{english ? 'No matching quizzes.' : 'لا توجد اختبارات مطابقة.'}</p>
        )}
        {filtered.map((quiz) => {
          const selected = selectedIds.includes(quiz.quizId)
          return (
            <div
              key={quiz.quizId}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-2.5 transition',
                selected ? 'border-gold/50 bg-gold/10 opacity-70' : 'border-border-soft bg-white hover:border-navy/30',
              )}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${quiz.gradient} text-lg`}>
                {quiz.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-navy">{english ? quiz.titleEn : quiz.title}</p>
                <p className="truncate text-[11px] text-muted">
                  {quiz.questionCount} {english ? 'questions' : 'سؤال'} • {quiz.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAdd(quiz.quizId)}
                disabled={selected}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-black transition',
                  selected ? 'border border-border-soft bg-surface-raised text-muted' : 'bg-navy text-white hover:bg-navy-3',
                )}
              >
                {selected ? (english ? 'Added' : 'مضاف') : (english ? 'Add' : 'إضافة')}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PackEditor() {
  const { packId } = useParams<{ packId: string }>()
  const navigate = useNavigate()
  const english = useAppStore((state) => state.language === 'en')
  const { user } = useAuth()

  const [step, setStep] = useState<EditorStep>('info')
  const [savedPackId, setSavedPackId] = useState<string | null>(packId ?? null)

  // Pack info
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('general')
  const [difficulty, setDifficulty] = useState<PackDifficulty>('medium')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [tagsText, setTagsText] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  // Quizzes + custom content
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [customQuizzes, setCustomQuizzes] = useState<PackCustomQuiz[]>([])
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [activeQuizUuid, setActiveQuizUuid] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  /** 'create' = plain new quiz; 'import' = create a quiz then import into it. */
  const [createMode, setCreateMode] = useState<'create' | 'import'>('create')
  const [importTarget, setImportTarget] = useState<PackCustomQuiz | null>(null)

  const [loading, setLoading] = useState(Boolean(packId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const didInit = useRef(false)

  const activeQuiz = activeQuizUuid ? customQuizzes.find((quiz) => quiz.id === activeQuizUuid) ?? null : null

  // Load the pack for edit mode.
  useEffect(() => {
    if (!packId || didInit.current) return
    didInit.current = true
    void (async () => {
      try {
        const pack = await getPack(packId)
        if (!pack || pack.creator_id !== user?.id) {
          setError(english ? 'You can only edit your own packs.' : 'يمكنك تعديل باقاتك فقط.')
          setLoading(false)
          return
        }
        setIsOwner(true)
        setTitle(pack.title)
        setDescription(pack.description)
        setCategory(pack.category)
        setDifficulty(pack.difficulty)
        setVisibility(pack.visibility)
        setCoverUrl(pack.cover_url)
        setTagsText(pack.tags.join(', '))
        setSelectedIds(pack.quizzes.map((quiz) => quiz.quiz_id))
        const custom = await listCustomQuizzes(packId)
        setCustomQuizzes(custom)
        const counts: Record<string, number> = {}
        for (const quiz of custom) {
          counts[quiz.id] = await countQuestions(quiz.id)
        }
        setQuestionCounts(counts)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : (english ? 'Could not load the pack.' : 'تعذر تحميل الباقة.'))
      } finally {
        setLoading(false)
      }
    })()
  }, [packId, user, english])

  // Ordered display entries: custom quizzes + existing category quizzes.
  const selections: QuizSelection[] = useMemo(() => {
    const entries: QuizSelection[] = []
    for (let index = 0; index < selectedIds.length; index += 1) {
      const quizId = selectedIds[index]
      if (isCustomQuizId(quizId)) {
        const custom = customQuizzes.find((quiz) => quiz.id === customQuizUuid(quizId))
        if (!custom) continue
        entries.push({
          meta: {
            quizId,
            title: custom.title,
            titleEn: custom.title,
            icon: '🧩',
            gradient: 'from-[#17324A] to-[#102433]',
            questionCount: questionCounts[custom.id] ?? 0,
          },
          position: index,
        })
        continue
      }
      const meta = getQuizMeta(quizId)
      if (!meta) continue
      entries.push({
        meta: { quizId, title: meta.title, titleEn: meta.titleEn, icon: meta.icon, gradient: meta.gradient, questionCount: meta.questionCount },
        position: index,
      })
    }
    return entries
  }, [selectedIds, customQuizzes, questionCounts])

  const handleAddExisting = (quizId: string) => {
    if (selectedIds.includes(quizId)) return
    setSelectedIds((current) => [...current, quizId])
    setNotice(english ? 'Quiz added to the pack.' : 'تمت إضافة الاختبار إلى الباقة.')
    window.setTimeout(() => setNotice(null), 2200)
  }

  const handleReorder = (next: QuizSelection[]) => {
    setSelectedIds(next.map((entry) => entry.meta!.quizId))
  }

  const handleRemoveQuiz = async (quizId: string) => {
    const customUuid = isCustomQuizId(quizId) ? customQuizUuid(quizId) : null
    if (customUuid) {
      if (!window.confirm(english ? 'Delete this quiz and all its questions?' : 'حذف هذا الاختبار وجميع أسئلته؟')) return
      try {
        await deleteCustomQuiz(customUuid)
        setCustomQuizzes((current) => current.filter((quiz) => quiz.id !== customUuid))
        if (activeQuizUuid === customUuid) setActiveQuizUuid(null)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : (english ? 'Could not delete the quiz.' : 'تعذر حذف الاختبار.'))
        return
      }
    } else if (!window.confirm(english ? 'Remove this quiz from the pack?' : 'إزالة هذا الاختبار من الباقة؟')) {
      return
    }
    setSelectedIds((current) => current.filter((id) => id !== quizId))
  }

  const handleQuizCreated = (quiz: PackCustomQuiz) => {
    setCreateModalOpen(false)
    setCustomQuizzes((current) => [...current, quiz])
    setQuestionCounts((current) => ({ ...current, [quiz.id]: 0 }))
    setSelectedIds((current) => [...current, `custom:${quiz.id}`])
    setActiveQuizUuid(quiz.id)
    setStep('questions')
    setNotice(english ? 'Quiz created — add its questions now.' : 'تم إنشاء الاختبار — أضف أسئلته الآن.')
    window.setTimeout(() => setNotice(null), 2600)
  }

  const handleImportCreated = (quiz: PackCustomQuiz) => {
    setCreateModalOpen(false)
    setCustomQuizzes((current) => [...current, quiz])
    setQuestionCounts((current) => ({ ...current, [quiz.id]: 0 }))
    setSelectedIds((current) => [...current, `custom:${quiz.id}`])
    setImportTarget(quiz)
  }

  const handleCountChange = (quizUuid: string, count: number) => {
    setQuestionCounts((current) => (current[quizUuid] === count ? current : { ...current, [quizUuid]: count }))
  }

  const handleCoverPick = async (file: File | undefined) => {
    if (!file || !user) return
    try {
      setError(null)
      const uploaded = await uploadPackCover(file, user.id)
      setCoverUrl(uploaded.publicUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not upload the cover.' : 'تعذر رفع صورة الغلاف.'))
    }
  }

  /** Validation summary shown in the review step / before publishing. */
  const validation = useMemo(() => {
    const issues: string[] = []
    if (!title.trim()) issues.push(english ? 'Pack title is required.' : 'اسم الباقة مطلوب.')
    if (selectedIds.length === 0) issues.push(english ? 'Add at least one quiz.' : 'أضف اختبارًا واحدًا على الأقل.')
    for (const entry of selections) {
      if (!entry.meta) continue
      if (entry.meta.questionCount === 0) {
        issues.push(english ? `"${entry.meta.title}" has no questions yet.` : `"${entry.meta.title}" لا يحتوي على أسئلة بعد.`)
      }
    }
    return issues
  }, [title, selectedIds, selections, english])

  const ensurePackSaved = async (): Promise<string> => {
    if (savedPackId) return savedPackId
    const tags = tagsText.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8)
    const created = await createPack(
      {
        title: title.trim() || 'باقة جديدة',
        description,
        cover_url: coverUrl,
        category,
        difficulty,
        visibility,
        tags,
      },
      user,
    )
    setSavedPackId(created.id)
    return created.id
  }

  /** Opens the create-quiz modal, silently creating the pack first if needed. */
  const openCreateModal = async (mode: 'create' | 'import') => {
    setError(null)
    if (!user) {
      setError(english ? 'Sign in to create a quiz.' : 'سجّل الدخول لإنشاء اختبار.')
      return
    }
    try {
      if (!savedPackId) {
        await ensurePackSaved()
      }
      setCreateMode(mode)
      setCreateModalOpen(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not prepare the pack.' : 'تعذر تجهيز الباقة.'))
    }
  }

  const persist = async (status: PackRow['status']) => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const packIdToSave = await ensurePackSaved()
      const tags = tagsText.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8)
      const input = { title, description, category, difficulty, visibility, cover_url: coverUrl, tags }
      if (savedPackId && isOwner) {
        await updatePack(packIdToSave, input)
      } else {
        // Already created via ensurePackSaved; just refresh metadata.
        await updatePack(packIdToSave, input)
      }
      await setPackQuizzes(packIdToSave, selectedIds)
      if (status) await setPackStatus(packIdToSave, status)

      if (status === 'published') {
        navigate(`/packs/${packIdToSave}`, { replace: true })
      } else {
        setNotice(english ? 'Draft saved. You can continue later.' : 'تم حفظ المسودة. يمكنك المتابعة لاحقًا.')
        window.setTimeout(() => setNotice(null), 2600)
        navigate(`/packs/${packIdToSave}/edit`, { replace: true })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not save the pack.' : 'تعذر حفظ الباقة.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="h-44 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
        <div className="h-72 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
      </div>
    )
  }

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header + stepper */}
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{english ? 'Pack studio' : 'استوديو الباقات'}</p>
            <h1 className="mt-1 text-2xl font-black text-navy sm:text-3xl">
              {packId ? (english ? 'Edit Pack' : 'تعديل الباقة') : (english ? 'Create a Pack' : 'إنشاء باقة')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void persist('draft')} disabled={saving || !user} className="btn btn-ghost rounded-xl px-4 py-2.5 text-sm font-black">
              {saving ? '…' : (english ? 'Save draft' : 'حفظ كمسودة')}
            </button>
            <button
              type="button"
              onClick={() => void persist('published')}
              disabled={saving || !user || validation.length > 0}
              title={validation.length > 0 ? validation[0] : undefined}
              className="btn btn-gold rounded-xl px-5 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? '…' : (english ? 'Publish Pack' : 'نشر الباقة')}
            </button>
          </div>
        </div>
        <StepIndicator step={step} onStep={setStep} english={english} />
      </motion.header>

      {error && (
        <div className="rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">
          {error}
          <button type="button" onClick={() => setError(null)} className="ms-3 text-red/60">✕</button>
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-green/40 bg-green/10 px-4 py-3 text-sm font-bold text-green">✓ {notice}</div>
      )}

      {/* ================= STEP 1 — Pack info ================= */}
      {step === 'info' && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
          className="space-y-4 rounded-3xl border border-border-soft bg-white/85 p-5 shadow-panel sm:p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold text-navy">{english ? 'Pack information' : 'معلومات الباقة'}</h2>
            <button
              type="button"
              onClick={() => setStep('quizzes')}
              className="rounded-xl bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-3"
            >
              {english ? 'Next: quizzes' : 'التالي: الاختبارات'} ←
            </button>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Cover */}
            <div>
              <span className="mb-2 block text-sm font-bold text-ink-2">{english ? 'Cover image' : 'صورة الغلاف'}</span>
              <div className="space-y-2">
                <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-border-soft bg-surface-raised">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-navy/25">🖼️</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 rounded-xl border border-border-strong bg-surface-raised px-3 py-2 text-xs font-black text-navy transition hover:border-navy">
                    {english ? 'Upload' : 'رفع صورة'}
                  </button>
                  {coverUrl && (
                    <button type="button" onClick={() => setCoverUrl(null)} className="rounded-xl border border-red/30 px-3 py-2 text-xs font-black text-red transition hover:bg-red/10">
                      ✕
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void handleCoverPick(event.target.files?.[0])} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <span className="block text-sm font-bold text-ink-2">{english ? 'Pack name' : 'اسم الباقة'} *</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={english ? 'e.g. Football Legends' : 'مثال: أساطير كرة القدم'}
                  className="w-full rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-bold text-ink-2">{english ? 'Description' : 'الوصف'}</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder={english ? 'What is this pack about?' : 'ما موضوع هذه الباقة؟'}
                  className="w-full resize-none rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="block text-sm font-bold text-ink-2">{english ? 'Category' : 'الفئة'}</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full rounded-xl border border-border-strong bg-white px-3 py-2.5 text-sm font-black text-navy outline-none"
                  >
                    {PACK_CATEGORIES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.icon} {english ? item.en : item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-bold text-ink-2">{english ? 'Difficulty' : 'الصعوبة'}</span>
                  <div className="flex gap-2">
                    {PACK_DIFFICULTIES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDifficulty(item.id)}
                        className={cn('flex-1 rounded-xl border px-3 py-2.5 text-xs font-black transition', difficulty === item.id ? 'border-navy bg-navy text-white' : 'border-border-soft bg-surface-raised text-muted')}
                      >
                        {english ? item.en : item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="block text-sm font-bold text-ink-2">{english ? 'Visibility' : 'الظهور'}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibility('public')}
                      className={cn('flex-1 rounded-xl border px-3 py-2.5 text-xs font-black transition', visibility === 'public' ? 'border-green bg-green/15 text-green' : 'border-border-soft bg-surface-raised text-muted')}
                    >
                      🌍 {english ? 'Public' : 'عام'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('private')}
                      className={cn('flex-1 rounded-xl border px-3 py-2.5 text-xs font-black transition', visibility === 'private' ? 'border-navy bg-navy text-white' : 'border-border-soft bg-surface-raised text-muted')}
                    >
                      🔒 {english ? 'Private' : 'خاص'}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-bold text-ink-2">{english ? 'Tags' : 'الوسوم'}</span>
                  <input
                    value={tagsText}
                    onChange={(event) => setTagsText(event.target.value)}
                    placeholder={english ? 'football, legends, world-cup' : 'كرة قدم، أساطير، كأس العالم'}
                    className="w-full rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
                  />
                  <p className="text-[11px] text-muted">{english ? 'Comma separated, up to 8.' : 'مفصولة بفواصل، حتى 8 وسوم.'}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ================= STEP 2 — Quizzes ================= */}
      {step === 'quizzes' && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
          className="space-y-5 rounded-3xl border border-border-soft bg-white/85 p-5 shadow-panel sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold text-navy">{english ? 'Quizzes in this pack' : 'اختبارات الباقة'}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openCreateModal('create')}
                className="rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_18px_rgba(18,59,70,0.22)] transition hover:bg-navy-3"
              >
                ＋ {english ? 'Create new quiz' : 'إنشاء اختبار جديد'}
              </button>
              <button
                type="button"
                onClick={() => void openCreateModal('import')}
                className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-2.5 text-xs font-black text-gold transition hover:bg-gold/20"
                title={english ? 'Create a quiz and import its questions' : 'إنشاء اختبار واستيراد أسئلته'}
              >
                ⬆ {english ? 'Import questions' : 'استيراد أسئلة'}
              </button>
            </div>
          </div>

          {/* Ordered quiz list */}
          {selections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-raised/50 px-6 py-10 text-center">
              <span className="text-3xl" aria-hidden>🧩</span>
              <p className="mt-2 text-sm font-bold text-muted">
                {english ? 'No quizzes yet. Create one or add an existing quiz below.' : 'لا توجد اختبارات بعد. أنشئ واحدًا أو أضف اختبارًا موجودًا.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-black text-muted">{english ? 'Pack order — drag to reorder' : 'ترتيب الباقة — اسحب لإعادة الترتيب'}</p>
              <Reorder.Group axis="y" values={selections} onReorder={handleReorder} className="space-y-2">
                <AnimatePresence initial={false}>
                  {selections.map((entry, index) => (
                    <Reorder.Item
                      key={entry.meta!.quizId}
                      value={entry}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ duration: 0.2 }}
                      className="group flex cursor-grab items-center gap-3 rounded-2xl border border-border-soft bg-surface-raised p-3 active:cursor-grabbing"
                      whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px rgba(18,59,70,0.18)' }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy text-xs font-black text-white">☰</span>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${entry.meta!.gradient} text-lg`}>
                        {entry.meta!.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-navy">{english ? entry.meta!.titleEn : entry.meta!.title}</p>
                        <p className="text-[11px] text-muted">
                          {index + 1} • {entry.meta!.questionCount} {english ? 'questions' : 'سؤال'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isCustomQuizId(entry.meta!.quizId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveQuizUuid(customQuizUuid(entry.meta!.quizId))
                              setStep('questions')
                            }}
                            className="rounded-lg border border-navy/40 px-2.5 py-1.5 text-xs font-black text-navy transition hover:bg-navy/10"
                          >
                            {english ? 'Questions' : 'الأسئلة'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleRemoveQuiz(entry.meta!.quizId)}
                          className="rounded-lg border border-red/30 bg-red/5 px-2.5 py-1.5 text-xs font-black text-red transition hover:bg-red/15"
                          aria-label={english ? 'Remove quiz' : 'إزالة الاختبار'}
                        >
                          ✕
                        </button>
                      </div>
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            </div>
          )}

          <div className="space-y-2 border-t border-border-soft pt-4">
            <h3 className="text-sm font-black text-navy">{english ? 'Add an existing quiz' : 'إضافة اختبار موجود'}</h3>
            <QuizPicker selectedIds={selectedIds} onAdd={handleAddExisting} english={english} />
          </div>
        </motion.section>
      )}

      {/* ================= STEP 3 — Questions ================= */}
      {step === 'questions' && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
          className="space-y-4 rounded-3xl border border-border-soft bg-white/85 p-5 shadow-panel sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold text-navy">{english ? 'Question editor' : 'محرر الأسئلة'}</h2>
            <button type="button" onClick={() => setStep('quizzes')} className="rounded-xl border border-border-soft px-4 py-2 text-xs font-black text-muted transition hover:text-navy">
              ← {english ? 'Back to quizzes' : 'العودة إلى الاختبارات'}
            </button>
          </div>

          {customQuizzes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-raised/50 px-6 py-10 text-center">
              <span className="text-3xl" aria-hidden>🧩</span>
              <p className="mt-2 text-sm font-bold text-muted">
                {english ? 'Create a custom quiz first to edit its questions.' : 'أنشئ اختبارًا مخصصًا أولًا لتعديل أسئلته.'}
              </p>
              <button
                type="button"
                onClick={() => void openCreateModal('create')}
                className="btn btn-gold mt-4 rounded-xl px-5 py-2.5 text-sm font-black"
              >
                ＋ {english ? 'Create new quiz' : 'إنشاء اختبار جديد'}
              </button>
            </div>
          ) : (
            <>
              {/* Quiz selector */}
              <div className="flex flex-wrap gap-2">
                {customQuizzes.map((quiz) => (
                  <button
                    key={quiz.id}
                    type="button"
                    onClick={() => setActiveQuizUuid(quiz.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black transition',
                      activeQuizUuid === quiz.id ? 'border-gold bg-gold/15 text-gold' : 'border-border-soft bg-surface-raised text-muted hover:border-navy/40',
                    )}
                  >
                    🧩 {english ? quiz.title : quiz.title}
                    <span className="rounded-full bg-white px-1.5 text-[10px] text-navy">{questionCounts[quiz.id] ?? 0}</span>
                  </button>
                ))}
              </div>

              {activeQuiz ? (
                <QuestionBuilder key={activeQuiz.id} quiz={activeQuiz} user={user} onCountChange={handleCountChange} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border-strong bg-surface-raised/50 px-6 py-8 text-center text-sm font-bold text-muted">
                  {english ? 'Select a quiz above to edit its questions.' : 'اختر اختبارًا من الأعلى لتعديل أسئلته.'}
                </div>
              )}
            </>
          )}
        </motion.section>
      )}

      {/* ================= STEP 4 — Review & publish ================= */}
      {step === 'review' && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
          className="space-y-4 rounded-3xl border border-border-soft bg-white/85 p-5 shadow-panel sm:p-6"
        >
          <h2 className="font-display text-lg font-extrabold text-navy">{english ? 'Review before publishing' : 'مراجعة قبل النشر'}</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border-soft bg-surface-raised/60 p-4">
              <p className="text-xs font-black text-muted">{english ? 'Pack title' : 'اسم الباقة'}</p>
              <p className="mt-1 font-black text-navy">{title.trim() || (english ? '—' : '—')}</p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface-raised/60 p-4">
              <p className="text-xs font-black text-muted">{english ? 'Quizzes' : 'الاختبارات'}</p>
              <p className="mt-1 font-black text-navy">{selectedIds.length}</p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface-raised/60 p-4">
              <p className="text-xs font-black text-muted">{english ? 'Questions' : 'الأسئلة'}</p>
              <p className="mt-1 font-black text-navy">
                {selections.reduce((sum, entry) => sum + (entry.meta?.questionCount ?? 0), 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface-raised/60 p-4">
              <p className="text-xs font-black text-muted">{english ? 'Visibility' : 'الظهور'}</p>
              <p className="mt-1 font-black text-navy">
                {visibility === 'public' ? (english ? '🌍 Public' : '🌍 عام') : (english ? '🔒 Private' : '🔒 خاص')}
              </p>
            </div>
          </div>

          {validation.length > 0 ? (
            <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
              <p className="text-sm font-black text-gold">{english ? 'Before publishing, fix these:' : 'قبل النشر، أصلح التالي:'}</p>
              <ul className="mt-2 space-y-1.5">
                {validation.map((issue, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm font-bold text-ink-2">
                    <span className="text-gold">⚠</span> {issue}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-green/40 bg-green/10 p-4 text-sm font-black text-green">
              ✓ {english ? 'Everything looks ready to publish.' : 'كل شيء جاهز للنشر.'}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setStep('quizzes')} className="rounded-xl border border-border-soft px-4 py-2.5 text-sm font-black text-muted transition hover:text-navy">
              ← {english ? 'Back' : 'رجوع'}
            </button>
            <button
              type="button"
              onClick={() => void persist('published')}
              disabled={saving || !user || validation.length > 0}
              className="btn btn-gold rounded-xl px-6 py-2.5 text-sm font-black shadow-[0_12px_28px_rgba(201,162,39,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? '…' : `🚀 ${english ? 'Publish Pack' : 'نشر الباقة'}`}
            </button>
          </div>
        </motion.section>
      )}

      {/* Floating quick-nav */}
      {step !== 'review' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setStep('review')}
            className="rounded-xl border border-border-strong bg-white px-4 py-2 text-xs font-black text-navy transition hover:border-gold hover:text-gold"
          >
            {english ? 'Review & publish' : 'المراجعة والنشر'} ←
          </button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {createModalOpen && savedPackId && (
          <QuizCreateModal
            packId={savedPackId}
            user={user}
            onClose={() => setCreateModalOpen(false)}
            onCreated={createMode === 'import' ? handleImportCreated : handleQuizCreated}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {importTarget && (
          <ImportModal
            quizId={importTarget.id}
            user={user}
            onClose={() => setImportTarget(null)}
            onImported={(count) => {
              const target = importTarget
              setImportTarget(null)
              setQuestionCounts((current) => ({ ...current, [target.id]: count }))
              setActiveQuizUuid(target.id)
              setStep('questions')
              setNotice(english ? `${count} questions imported into "${target.title}".` : `تم استيراد ${count} سؤالًا إلى "${target.title}".`)
              window.setTimeout(() => setNotice(null), 2800)
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-5 start-1/2 z-[80] -translate-x-1/2 rounded-2xl border border-green/40 bg-white px-5 py-3 text-sm font-bold text-green shadow-raised"
            dir={english ? 'ltr' : 'rtl'}
          >
            ✓ {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
