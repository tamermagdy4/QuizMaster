import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ADMIN_POINTS } from '../../utils/adminData'
import { gameCategories } from '../../data/categories'
import { createQuestion, getQuestionById, updateQuestion, type SupabaseQuestion } from '../../services/questionService'
import { validateQuestionImage } from '../../services/questionImageService'
import type { PointValue } from '../../types/board'

function getQuestionId(id: string | undefined) {
  if (!id) return ''
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

export function AdminQuestionForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const questionId = getQuestionId(id)
  const isEditing = Boolean(questionId)
  const [existing, setExisting] = useState<SupabaseQuestion | null>(null)
  const [loading, setLoading] = useState(isEditing)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [points, setPoints] = useState<PointValue>(100)
  const [image, setImage] = useState<File | null>(null)
  const [answerImage, setAnswerImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [answerPreview, setAnswerPreview] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    let cancelled = false
    setLoading(true)
    getQuestionById(questionId)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setErrors(['السؤال غير موجود.'])
          return
        }
        setExisting(result)
        setQuestion(result.question)
        setAnswer(result.answer)
        setCategoryId(result.category_id)
        setPoints(result.points)
        setPreview(result.image_url ?? '')
        setAnswerPreview(result.answer_image_url ?? '')
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrors([error instanceof Error ? error.message : 'تعذر تحميل السؤال.'])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [isEditing, questionId])

  useEffect(() => {
    if (!image) return
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  useEffect(() => {
    if (!answerImage) return
    const url = URL.createObjectURL(answerImage)
    setAnswerPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [answerImage])

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    if (!selected) return
    try {
      validateQuestionImage(selected)
      setErrors([])
      setImage(selected)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'الصورة غير صالحة.'])
      event.target.value = ''
    }
  }

  const chooseAnswerImage = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    if (!selected) return
    try {
      validateQuestionImage(selected)
      setErrors([])
      setAnswerImage(selected)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'الصورة غير صالحة.'])
      event.target.value = ''
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: string[] = []
    const category = gameCategories.find((item) => item.id === categoryId)
    if (!question.trim()) nextErrors.push('السؤال مطلوب.')
    if (!answer.trim()) nextErrors.push('الإجابة الصحيحة مطلوبة.')
    if (!category) nextErrors.push('الفئة مطلوبة أو غير صالحة.')
    if (!ADMIN_POINTS.includes(points)) nextErrors.push('النقاط يجب أن تكون 100 أو 300 أو 500.')
    setErrors(nextErrors)
    if (nextErrors.length || !category) return

    setSaving(true)
    try {
      const input = {
        categoryId,
        question: question.trim(),
        answer: answer.trim(),
        points,
        image,
        answerImage,
      }
      if (isEditing && existing) {
        await updateQuestion(existing.id, input, existing.image_url, existing.answer_image_url)
        navigate(`/admin/questions/${encodeURIComponent(existing.id)}`)
        return
      }

      await createQuestion(input)
      sessionStorage.setItem('quizmaster-admin-question-success', 'تمت إضافة السؤال بنجاح.')
      window.location.assign('/admin/questions')
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'تعذر حفظ السؤال.'])
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-slate-400">جارٍ تحميل بيانات السؤال...</div>
  }

  if (isEditing && !existing) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
        <p className="text-slate-400">{errors[0] ?? 'السؤال غير موجود.'}</p>
        <Link to="/admin/questions" className="mt-4 inline-block text-sm font-bold text-sky-400">العودة للأسئلة</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to={isEditing && existing ? `/admin/questions/${encodeURIComponent(existing.id)}` : '/admin/questions'} className="text-sm font-bold text-sky-400">← العودة</Link>
      <div>
        <p className="text-sm font-bold text-sky-400">{isEditing ? 'إدارة Supabase' : 'إضافة سؤال'}</p>
        <h2 className="mt-1 text-3xl font-black">{isEditing ? 'تعديل السؤال' : 'إضافة سؤال جديد'}</h2>
        <p className="mt-2 text-sm text-slate-400">{isEditing ? 'يتم حفظ التعديلات والصورة مباشرة في Supabase.' : 'سيتم حفظ السؤال والصورة فعليًا في Supabase Database وStorage.'}</p>
      </div>
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">نص السؤال</span><textarea required value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-sky-500" /></label>
        <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">الإجابة الصحيحة</span><input required value={answer} onChange={(event) => setAnswer(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-sky-500" /></label>
        <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">صورة السؤال (اختيارية)</span><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={chooseImage} className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:font-bold file:text-white" />{preview && <img src={preview} alt="معاينة صورة السؤال" className="mt-4 max-h-56 w-full rounded-xl object-contain" />}</label>
        <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">صورة الإجابة (اختيارية)</span><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={chooseAnswerImage} className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:font-bold file:text-white" />{answerPreview && <img src={answerPreview} alt="معاينة صورة الإجابة" className="mt-4 max-h-56 w-full rounded-xl object-contain" />}</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">التصنيف</span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"><option value="">اختر التصنيف</option>{gameCategories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">النقاط</span><select value={points} onChange={(event) => setPoints(Number(event.target.value) as PointValue)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">{ADMIN_POINTS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        {errors.length > 0 && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><ul className="list-disc space-y-1 pr-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-white hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60">{saving ? 'جارٍ الحفظ...' : isEditing ? 'حفظ التعديل' : 'إضافة السؤال'}</button><button type="button" onClick={() => navigate('/admin/questions')} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-300 hover:bg-slate-800">إلغاء</button></div>
      </form>
    </div>
  )
}
