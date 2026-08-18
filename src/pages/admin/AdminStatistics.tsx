import { useEffect, useState } from 'react'
import { ADMIN_POINTS, getCategoryStats, getAdminQuestions } from '../../utils/adminData'
import {
  getPackStatisticsForAdmin,
  type PackCreatorStat,
  type PackStatistics,
} from '../../services/packQuizService'

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

function PackStatsSection() {
  const [stats, setStats] = useState<PackStatistics | null>(null)

  useEffect(() => {
    let active = true
    void getPackStatisticsForAdmin().then((result) => {
      if (active) setStats(result)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-sky-400">اختبارات وأسئلة الباقات</p>
        <h3 className="mt-1 text-2xl font-black">إحصائيات المحتوى المخصص</h3>
        <p className="mt-1 text-sm text-slate-400">حسابات مجمّعة من اختبارات وأسئلة الباقات التي أنشأها المستخدمون.</p>
      </div>

      {stats === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="اختبارات مخصصة" value={stats.totalCustomQuizzes} accent="text-sky-300" />
            <StatCard label="أسئلة الباقات" value={stats.totalPackQuestions} accent="text-teal-300" />
            <StatCard label="متوسط النقاط" value={stats.avgPoints} accent="text-amber-300" />
            <StatCard label="أسئلة بصور" value={stats.questionsWithImages} accent="text-emerald-300" />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="font-black">أكثر المنشئين نشاطًا</h3>
            {stats.topCreators.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                لا يوجد محتوى مخصص بعد — أنشئ أول باقة أو اختبار مخصص لرؤية الإحصائيات هنا.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {stats.topCreators.map((creator: PackCreatorStat, index) => (
                  <li key={creator.creatorId} className="flex items-center justify-between gap-4 rounded-lg bg-slate-800 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/30 to-teal-500/30 text-sm font-black text-sky-300">
                        {index + 1}
                      </span>
                      <span className="truncate font-bold text-slate-100">{creator.creatorName || 'مستخدم'}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-sm text-slate-400">
                      <span>{creator.quizCount} اختبار</span>
                      <span>{creator.questionCount} سؤال</span>
                      <span className="text-amber-300">{creator.avgPoints} نقطة</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {stats.totalCreators > stats.topCreators.length ? (
              <p className="mt-3 text-xs text-slate-500">+{stats.totalCreators - stats.topCreators.length} منشئ آخر</p>
            ) : null}
          </div>
        </>
      )}
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

      <PackStatsSection />
    </div>
  )
}
