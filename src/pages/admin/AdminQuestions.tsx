import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ADMIN_POINTS, getAdminQuestions, type AdminQuestion } from '../../utils/adminData'
import { gameCategories } from '../../data/categories'
import { getQuestions } from '../../services/questionService'


export function AdminQuestions() {

  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useState('')
  const [questions, setQuestions] = useState<AdminQuestion[]>(() => getAdminQuestions())

  useEffect(() => {
    const message = sessionStorage.getItem('quizmaster-admin-question-success')
    if (message) {
      setNotice(message)
      sessionStorage.removeItem('quizmaster-admin-question-success')
    }
  }, [])
  useEffect(() => {
    getQuestions().then((remoteQuestions) => {
      const remote = remoteQuestions.map((item): AdminQuestion => ({
        id: item.id,
        categoryId: item.category_id,
        categoryTitle: gameCategories.find((category) => category.id === item.category_id)?.title ?? item.category_id,
        points: item.points,
        question: item.question,
        answer: item.answer,
        media: item.image_url ?? undefined,
        mediaType: item.image_url ? 'image' : undefined,
      }))
      const merged = new Map([...getAdminQuestions(), ...remote].map((item) => [item.id, item]))
      setQuestions([...merged.values()])
    }).catch(() => undefined)
  }, [])
  const search = params.get('search') ?? ''
  const category = params.get('category') ?? ''
  const points = params.get('points') ?? ''
  const filtered = useMemo(() => questions.filter((item) => {
    const needle = search.toLowerCase()
    return (!needle || item.question.toLowerCase().includes(needle) || item.answer.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle)) && (!category || item.categoryId === category) && (!points || String(item.points) === points)
  }), [questions, search, category, points])
  const categories = [...new Map(questions.map((item) => [item.categoryId, item.categoryTitle])).entries()]
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }


  return <div className="space-y-6">{notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">{notice}</div>}<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-sky-400">المحتوى</p><h2 className="mt-1 text-3xl font-black">إدارة الأسئلة</h2><p className="mt-2 text-slate-400">{filtered.length} من {questions.length} سؤال</p></div><div className="flex flex-wrap gap-2"><Link to="/admin/questions/add" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white hover:bg-sky-400">+ إضافة سؤال</Link></div></div><div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-[1fr_220px_160px]"><input value={search} onChange={(e) => update('search', e.target.value)} placeholder="ابحث في السؤال أو الإجابة أو ID" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-500" /><select value={category} onChange={(e) => update('category', e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"><option value="">كل الفئات</option>{categories.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select><select value={points} onChange={(e) => update('points', e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"><option value="">كل النقاط</option>{ADMIN_POINTS.map((value) => <option key={value} value={value}>{value} نقطة</option>)}</select></div><div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><div className="hidden grid-cols-[1fr_150px_90px_180px] gap-4 border-b border-slate-800 px-5 py-4 text-xs font-black text-slate-500 md:grid"><span>السؤال</span><span>الفئة</span><span>النقاط</span><span>ID</span></div>{filtered.length === 0 ? <div className="p-12 text-center text-slate-400">لا توجد نتائج مطابقة.</div> : filtered.map((item) => <div key={`${item.categoryId}-${item.id}`} className="grid gap-3 border-b border-slate-800 px-5 py-4 last:border-0 md:grid-cols-[1fr_150px_90px_180px] md:items-center md:gap-4"><div className="flex gap-3">{item.media && <img src={item.media} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}<div><p className="font-bold leading-relaxed text-slate-100">{item.question}</p><p className="mt-1 text-xs text-slate-500">الإجابة: {item.answer}</p></div></div><span className="text-sm text-slate-400">{item.categoryTitle}</span><span className="w-fit rounded-full bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-300">{item.points}</span><div className="flex items-center justify-between gap-2"><code className="truncate text-xs text-slate-500">{item.id}</code><Link to={`/admin/questions/${encodeURIComponent(item.id)}`} className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-black text-slate-200 hover:bg-slate-800">عرض</Link></div></div>)}</div></div>
}
