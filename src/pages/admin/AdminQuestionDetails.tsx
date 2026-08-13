import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { gameCategories } from '../../data/categories'
import { deleteQuestion, getQuestionById, type SupabaseQuestion } from '../../services/questionService'

const displayedFields = new Set(['id', 'category_id', 'question', 'answer', 'points', 'image_url', 'answer_image_url'])

function getQuestionId(id: string | undefined) {
  if (!id) return ''
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

function formatFieldValue(value: unknown) {
  if (typeof value === 'string') return value
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ar-EG')
}

export function AdminQuestionDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const questionId = getQuestionId(id)
  const [question, setQuestion] = useState<SupabaseQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deleteRequested, setDeleteRequested] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let cancelled = false
    setQuestion(null)
    setLoadError('')
    setLoading(true)

    if (!questionId) {
      setLoading(false)
      return () => { cancelled = true }
    }

    getQuestionById(questionId)
      .then((result) => {
        if (!cancelled) setQuestion(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'تعذر قراءة السؤال.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [questionId])

  if (loading) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-slate-400">جارٍ تحميل السؤال...</div>
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
        <p className="text-slate-400">تعذر تحميل السؤال.</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
        <Link to="/admin/questions" className="mt-4 inline-block text-sm font-bold text-sky-400">العودة للأسئلة</Link>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
        <p className="text-slate-400">السؤال غير موجود.</p>
        <Link to="/admin/questions" className="mt-4 inline-block text-sm font-bold text-sky-400">العودة للأسئلة</Link>
      </div>
    )
  }

  const categoryTitle = gameCategories.find((category) => category.id === question.category_id)?.title ?? question.category_id
  const additionalFields = Object.entries(question).filter(([key, value]) => !displayedFields.has(key) && value !== undefined)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/admin/questions" className="text-sm font-bold text-sky-400">← العودة للأسئلة</Link>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-sky-500/15 px-3 py-1 text-sm font-black text-sky-300">{question.points} نقطة</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-300">{categoryTitle}</span>
          </div>
          <div className="flex gap-2">
            <Link to={`/admin/questions/${encodeURIComponent(question.id)}/edit`} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-800">تعديل</Link>
            <button type="button" onClick={() => setDeleteRequested(true)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-black text-rose-300 hover:bg-rose-500/10">حذف</button>
          </div>
        </div>
        {question.image_url && <img src={question.image_url} alt="صورة السؤال" className="mt-6 max-h-72 w-full rounded-xl object-contain" />}
        {question.answer_image_url && <img src={question.answer_image_url} alt="صورة الإجابة" className="mt-6 max-h-72 w-full rounded-xl object-contain" />}
        <h2 className="mt-6 text-2xl font-black leading-relaxed">{question.question}</h2>
        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-xs font-bold text-emerald-300">الإجابة الصحيحة</p>
          <p className="mt-2 text-lg font-black text-emerald-100">{question.answer}</p>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs font-bold text-slate-500">ID</dt><dd className="mt-1 break-all font-mono text-sm text-slate-300">{question.id}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">Category ID</dt><dd className="mt-1 break-all font-mono text-sm text-slate-300">{question.category_id}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">تاريخ الإنشاء</dt><dd className="mt-1 text-sm text-slate-300">{formatDate(question.created_at)}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">تاريخ التعديل</dt><dd className="mt-1 text-sm text-slate-300">{formatDate(question.updated_at)}</dd></div>
        </dl>
        {additionalFields.length > 0 && (
          <dl className="mt-6 grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2">
            {additionalFields.map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="text-xs font-bold text-slate-500">{key}</dt>
                <dd className="mt-1 break-all text-sm text-slate-300">{formatFieldValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {deleteError && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">{deleteError}</div>}
      {deleteRequested && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-xl font-black">حذف السؤال؟</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">هل أنت متأكد من حذف هذا السؤال؟ سيتم حذف السؤال من Supabase والصورة المرتبطة به إن أمكن.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={deleting} onClick={() => setDeleteRequested(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 disabled:opacity-50">إلغاء</button>
              <button type="button" disabled={deleting} onClick={() => {
                setDeleting(true)
                setDeleteError('')
                deleteQuestion(question.id, question.image_url, question.answer_image_url)
                  .then(() => navigate('/admin/questions'))
                  .catch((error: unknown) => {
                    setDeleteError(error instanceof Error ? error.message : 'تعذر حذف السؤال.')
                    setDeleting(false)
                  })
              }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-50">{deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
