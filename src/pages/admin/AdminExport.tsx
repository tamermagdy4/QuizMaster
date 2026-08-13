import { getAdminQuestions, exportQuestions } from '../../utils/adminData'

export function AdminExport() {
  const questions = getAdminQuestions()
  const download = () => {
    const blob = new Blob([JSON.stringify(exportQuestions(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'quizmaster-questions-export.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="text-sm font-bold text-sky-400">البيانات</p><h2 className="mt-1 text-3xl font-black">تصدير JSON</h2><p className="mt-2 text-slate-400">تنزيل نسخة من الأسئلة المحملة حاليًا دون تغيير المصدر.</p></div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><div className="flex items-center justify-between rounded-xl bg-slate-800 p-4"><span className="font-bold">الأسئلة الجاهزة للتصدير</span><strong className="text-2xl font-black text-sky-300">{questions.length}</strong></div><button type="button" onClick={download} disabled={!questions.length} className="mt-5 w-full rounded-xl bg-sky-500 px-4 py-3 font-black text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40">تنزيل ملف JSON</button><p className="mt-4 text-xs leading-relaxed text-slate-500">التصدير قراءة فقط ويحافظ على حقول السؤال الأساسية. لا توجد قاعدة بيانات لحفظ تعديلات Admin.</p></div></div>
}
