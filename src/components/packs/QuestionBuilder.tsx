import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import { useAppStore } from '../../store/appStore'
import type { PackCustomQuiz, PackDifficulty, PackQuestion, QuestionExportFormat } from '../../types/packs'
import { PACK_DIFFICULTIES } from '../../types/packs'
import {
  createQuestion,
  deleteQuestion,
  downloadExport,
  exportQuestions,
  listQuestions,
  reorderQuestions,
  updateQuestion,
} from '../../services/packQuizService'
import { ImportModal } from './ImportModal'

const POINT_OPTIONS = [100, 200, 300, 500, 1000]

type Draft = {
  question: string
  answer: string
  points: number
  difficulty: PackDifficulty
  hint: string
  imageUrl: string
  answerImageUrl: string
}

function emptyDraft(): Draft {
  return { question: '', answer: '', points: 100, difficulty: 'medium', hint: '', imageUrl: '', answerImageUrl: '' }
}

function QuestionForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  english,
}: {
  draft: Draft
  onChange: (draft: Draft) => void
  onSave: () => void
  onCancel?: () => void
  saving: boolean
  english: boolean
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-gold/40 bg-gold/5 p-4">
      <div>
        <label className="mb-1 block text-xs font-black text-muted">{english ? 'Question' : 'السؤال'} *</label>
        <textarea
          value={draft.question}
          onChange={(event) => onChange({ ...draft, question: event.target.value })}
          rows={2}
          className="w-full resize-none rounded-xl border border-border-strong bg-white px-3.5 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-black text-muted">{english ? 'Answer' : 'الإجابة'} *</label>
        <input
          value={draft.answer}
          onChange={(event) => onChange({ ...draft, answer: event.target.value })}
          className="w-full rounded-xl border border-border-strong bg-white px-3.5 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-black text-muted">{english ? 'Points' : 'النقاط'}</label>
          <select
            value={draft.points}
            onChange={(event) => onChange({ ...draft, points: Number(event.target.value) })}
            className="w-full rounded-xl border border-border-strong bg-white px-3 py-2.5 text-sm font-black text-navy outline-none"
          >
            {POINT_OPTIONS.map((points) => (
              <option key={points} value={points}>
                {points}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-black text-muted">{english ? 'Difficulty' : 'الصعوبة'}</label>
          <select
            value={draft.difficulty}
            onChange={(event) => onChange({ ...draft, difficulty: event.target.value as PackDifficulty })}
            className="w-full rounded-xl border border-border-strong bg-white px-3 py-2.5 text-sm font-black text-navy outline-none"
          >
            {PACK_DIFFICULTIES.map((item) => (
              <option key={item.id} value={item.id}>
                {english ? item.en : item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-black text-muted">{english ? 'Hint (optional)' : 'تلميح (اختياري)'}</label>
        <input
          value={draft.hint}
          onChange={(event) => onChange({ ...draft, hint: event.target.value })}
          className="w-full rounded-xl border border-border-strong bg-white px-3.5 py-2.5 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-black text-muted">{english ? 'Question image URL' : 'رابط صورة السؤال'}</label>
          <input
            value={draft.imageUrl}
            onChange={(event) => onChange({ ...draft, imageUrl: event.target.value })}
            dir="ltr"
            className="w-full rounded-xl border border-border-strong bg-white px-3.5 py-2.5 text-xs font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-black text-muted">{english ? 'Answer image URL' : 'رابط صورة الإجابة'}</label>
          <input
            value={draft.answerImageUrl}
            onChange={(event) => onChange({ ...draft, answerImageUrl: event.target.value })}
            dir="ltr"
            className="w-full rounded-xl border border-border-strong bg-white px-3.5 py-2.5 text-xs font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !draft.question.trim() || !draft.answer.trim()}
          className="rounded-xl bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? '…' : (english ? 'Save question' : 'حفظ السؤال')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl border border-border-strong px-4 py-2 text-xs font-black text-muted transition hover:text-navy">
            {english ? 'Cancel' : 'إلغاء'}
          </button>
        )}
      </div>
    </div>
  )
}

export function QuestionBuilder({
  quiz,
  user,
  onCountChange,
}: {
  quiz: PackCustomQuiz
  user: User | null
  onCountChange?: (quizId: string, count: number) => void
}) {
  const english = useAppStore((state) => state.language === 'en')
  const [questions, setQuestions] = useState<PackQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | 'new'; draft: Draft } | null>(null)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const reload = async () => {
    try {
      const rows = await listQuestions(quiz.id)
      setQuestions(rows)
      onCountChange?.(quiz.id, rows.length)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not load questions.' : 'تعذر تحميل الأسئلة.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.id])

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      const input = {
        question: editing.draft.question,
        answer: editing.draft.answer,
        points: editing.draft.points,
        difficulty: editing.draft.difficulty,
        hint: editing.draft.hint,
        image_url: editing.draft.imageUrl,
        answer_image_url: editing.draft.answerImageUrl,
      }
      if (editing.id === 'new') {
        await createQuestion(quiz.id, input, user)
      } else {
        await updateQuestion(editing.id, input)
      }
      setEditing(null)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not save the question.' : 'تعذر حفظ السؤال.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (question: PackQuestion) => {
    if (!window.confirm(english ? 'Delete this question?' : 'حذف هذا السؤال؟')) return
    setError(null)
    try {
      await deleteQuestion(question.id)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not delete the question.' : 'تعذر حذف السؤال.'))
    }
  }

  const handleDuplicate = async (question: PackQuestion) => {
    setError(null)
    try {
      await createQuestion(quiz.id, {
        question: question.question,
        answer: question.answer,
        points: question.points,
        difficulty: question.difficulty,
        hint: question.hint ?? undefined,
        image_url: question.image_url ?? undefined,
        answer_image_url: question.answer_image_url ?? undefined,
      }, user)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not duplicate the question.' : 'تعذر تكرار السؤال.'))
    }
  }

  const handleReorder = async (next: PackQuestion[]) => {
    setQuestions(next)
    setError(null)
    try {
      await reorderQuestions(quiz.id, next.map((question) => question.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not save the order.' : 'تعذر حفظ الترتيب.'))
      void reload()
    }
  }

  const handleImportDone = async (count: number) => {
    setImportOpen(false)
    setNotice(english ? `${count} questions imported.` : `تم استيراد ${count} سؤالًا.`)
    window.setTimeout(() => setNotice(null), 2600)
    await reload()
  }

  const handleExport = async (format: QuestionExportFormat) => {
    setError(null)
    try {
      const file = await exportQuestions(quiz.id, format)
      downloadExport(file)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not export questions.' : 'تعذر تصدير الأسئلة.'))
    }
  }

  const sorted = useMemo(() => [...questions].sort((a, b) => a.position - b.position), [questions])

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-surface-raised" />
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing({ id: 'new', draft: emptyDraft() })}
            className="rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_18px_rgba(18,59,70,0.22)] transition hover:bg-navy-3"
          >
            ＋ {english ? 'Add question' : 'إضافة سؤال'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-xl border border-navy/40 bg-navy/5 px-4 py-2.5 text-xs font-black text-navy transition hover:bg-navy/10"
          >
            ⬆ {english ? 'Import questions' : 'استيراد أسئلة'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border-strong bg-surface-raised px-3 py-1 text-xs font-black text-muted">
            {questions.length} {english ? 'questions' : 'سؤال'}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void handleExport('json')} title="JSON" className="rounded-lg border border-border-soft px-2.5 py-1.5 text-[11px] font-black text-muted transition hover:border-navy hover:text-navy">
              JSON
            </button>
            <button type="button" onClick={() => void handleExport('csv')} title="CSV" className="rounded-lg border border-border-soft px-2.5 py-1.5 text-[11px] font-black text-muted transition hover:border-navy hover:text-navy">
              CSV
            </button>
            <button type="button" onClick={() => void handleExport('txt')} title="TXT" className="rounded-lg border border-border-soft px-2.5 py-1.5 text-[11px] font-black text-muted transition hover:border-navy hover:text-navy">
              TXT
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">
          {error}
          <button type="button" onClick={() => setError(null)} className="ms-3 text-red/60">✕</button>
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-green/40 bg-green/10 px-4 py-3 text-sm font-bold text-green">✓ {notice}</div>
      )}

      {editing && (
        <QuestionForm
          draft={editing.draft}
          onChange={(draft) => setEditing((current) => (current ? { ...current, draft } : current))}
          onSave={() => void handleSave()}
          onCancel={() => setEditing(null)}
          saving={saving}
          english={english}
        />
      )}

      {/* Question list */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface-raised/50 px-6 py-10 text-center">
          <span className="text-3xl" aria-hidden>📝</span>
          <p className="mt-2 text-sm font-bold text-muted">
            {english ? 'No questions yet. Add one manually or import a file.' : 'لا توجد أسئلة بعد. أضف سؤالًا يدويًا أو استورد ملفًا.'}
          </p>
        </div>
      ) : (
        <Reorder.Group axis="y" values={sorted} onReorder={handleReorder} className="space-y-2">
          <AnimatePresence initial={false}>
            {sorted.map((question, index) => (
              <Reorder.Item
                key={question.id}
                value={question}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.18 }}
                className="group flex cursor-grab items-center gap-3 rounded-2xl border border-border-soft bg-white p-3 active:cursor-grabbing"
                whileDrag={{ scale: 1.01, boxShadow: '0 12px 32px rgba(18,59,70,0.16)' }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-[11px] font-black text-white" aria-hidden>
                  ☰
                </span>
                <span className="w-8 shrink-0 text-center font-display text-sm font-black text-gold" dir="ltr">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-navy">{question.question}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    <span className="text-green">{question.answer}</span>
                    <span className="mx-1.5 text-navy/20">•</span>
                    {question.points} {english ? 'pts' : 'نقطة'}
                    <span className="mx-1.5 text-navy/20">•</span>
                    {PACK_DIFFICULTIES.find((item) => item.id === question.difficulty) ? (english
                      ? PACK_DIFFICULTIES.find((item) => item.id === question.difficulty)!.en
                      : PACK_DIFFICULTIES.find((item) => item.id === question.difficulty)!.label)
                      : question.difficulty}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: question.id,
                        draft: {
                          question: question.question,
                          answer: question.answer,
                          points: question.points,
                          difficulty: question.difficulty,
                          hint: question.hint ?? '',
                          imageUrl: question.image_url ?? '',
                          answerImageUrl: question.answer_image_url ?? '',
                        },
                      })
                    }
                    className="rounded-lg px-2.5 py-1.5 text-xs font-black text-navy transition hover:bg-surface-raised"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDuplicate(question)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-black text-muted transition hover:bg-surface-raised hover:text-navy"
                    title={english ? 'Duplicate' : 'تكرار'}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(question)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-black text-red transition hover:bg-red/10"
                  >
                    ✕
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {importOpen && (
        <ImportModal
          quizId={quiz.id}
          user={user}
          onClose={() => setImportOpen(false)}
          onImported={handleImportDone}
        />
      )}
    </div>
  )
}
