import { useState } from 'react'
import { ADMIN_POINTS } from '../../utils/adminData'

function validateImport(value: unknown): string[] {
  const errors: string[] = []
  const collections = Array.isArray(value) ? value : [value]
  collections.forEach((collection, index) => {
    if (!collection || typeof collection !== 'object') { errors.push(`العنصر ${index + 1}: يجب أن يكون كائنًا.`); return }
    const item = collection as Record<string, unknown>
    if (typeof item.categoryId !== 'string' || !item.categoryId.trim()) errors.push(`العنصر ${index + 1}: categoryId مفقود.`)
    const questions = Array.isArray(item.questions) ? item.questions : Object.values((item.questionsByPoints as Record<string, unknown> | undefined) ?? {}).flatMap((list) => Array.isArray(list) ? list : [])
    if (questions.length === 0) errors.push(`العنصر ${index + 1}: questions مفقودة أو فارغة.`)
    questions.forEach((question, questionIndex) => {
      if (!question || typeof question !== 'object') { errors.push(`العنصر ${index + 1} السؤال ${questionIndex + 1}: غير صالح.`); return }
      const row = question as Record<string, unknown>
      if (typeof row.id !== 'string' || !row.id.trim()) errors.push(`العنصر ${index + 1} السؤال ${questionIndex + 1}: id مفقود.`)
      if (typeof row.question !== 'string' || !row.question.trim()) errors.push(`العنصر ${index + 1} السؤال ${questionIndex + 1}: question مفقود.`)
      if (typeof row.answer !== 'string' || !row.answer.trim()) errors.push(`العنصر ${index + 1} السؤال ${questionIndex + 1}: answer مفقود.`)
      if (row.points !== undefined && !ADMIN_POINTS.includes(row.points as typeof ADMIN_POINTS[number])) errors.push(`العنصر ${index + 1} السؤال ${questionIndex + 1}: points يجب أن تكون 100 أو 300 أو 500.`)
    })
  })
  return errors
}

export function AdminImport() {
  const [status, setStatus] = useState<{ name: string; errors: string[] } | null>(null)
  const handleFile = async (file?: File) => {
    if (!file) return
    try { const value = JSON.parse(await file.text()); setStatus({ name: file.name, errors: validateImport(value) }) } catch { setStatus({ name: file.name, errors: ['الملف ليس JSON صالحًا.'] }) }
  }
  return <div className="mx-auto max-w-3xl space-y-6"><div><p className="text-sm font-bold text-sky-400">البيانات</p><h2 className="mt-1 text-3xl font-black">استيراد JSON</h2><p className="mt-2 text-slate-400">افحص بنية ملف مطابق للمخطط الحالي قبل أي إدخال.</p></div><label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 p-12 text-center transition hover:border-sky-500"><span className="text-4xl">↑</span><span className="mt-3 font-black">اختر ملف JSON</span><span className="mt-1 text-sm text-slate-500">لن يتم تعديل بيانات اللعبة من هذه الصفحة.</span><input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} /></label>{status && <div className={`rounded-2xl border p-5 ${status.errors.length ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}><h3 className="font-black">{status.name}</h3>{status.errors.length ? <ul className="mt-4 list-disc space-y-2 pr-5 text-sm text-rose-200">{status.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="mt-3 text-sm text-emerald-200">البنية صحيحة. الحفظ الفعلي يحتاج Backend أو قاعدة بيانات.</p>}</div>}</div>
}
