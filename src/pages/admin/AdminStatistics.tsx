import { ADMIN_POINTS, getCategoryStats, getAdminQuestions } from '../../utils/adminData'

function StatCard({ label, value, suffix, accent }: { label: string; value: string | number; suffix?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-black ${accent ?? ''}`}>
        {value}
        {suffix ? <span className="ms-1 text-lg font-bold text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  )
}

export function AdminStatistics() {
  const questions = getAdminQuestions()
  const categories = getCategoryStats()
  const max = Math.max(...categories.map((item) => item.total), 1)
  const no500 = categories.filter((item) => item.byPoints[500] === 0)
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-bold text-sky-400">التحليل</p>
        <h2 className="mt-1 text-3xl font-black">الإحصائيات</h2>
        <p className="mt-2 text-slate-400">حسابات مباشرة من الأسئلة الحالية.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_POINTS.map((points) => (
          <div key={points} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm font-bold text-slate-400">أسئلة {points}</p>
            <p className="mt-3 text-3xl font-black">{questions.filter((item) => item.points === points).length}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-black">الأسئلة حسب الفئة</h3>
        <div className="mt-6 space-y-4">
          {categories.map((item) => (
            <div key={item.category.id}>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-bold">
                  {item.category.icon} {item.category.title}
                </span>
                <span className="text-slate-400">{item.total}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-sky-400 to-teal-400"
                  style={{ width: `${(item.total / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-black">فئات بلا أسئلة 500 نقطة</h3>
          {no500.length === 0 ? (
            <p className="mt-4 text-sm text-emerald-300">كل الفئات تحتوي على أسئلة 500 نقطة.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {no500.map((item) => (
                <li key={item.category.id} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">
                  {item.category.title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-black">فئات قليلة الأسئلة</h3>
          <ul className="mt-4 space-y-2">
            {[...categories]
              .sort((a, b) => a.total - b.total)
              .slice(0, 5)
              .map((item) => (
                <li key={item.category.id} className="flex justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">
                  <span>{item.category.title}</span>
                  <span>{item.total}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
