import { useAuth } from '../auth/AuthProvider'

export function Profile() {
  const { user } = useAuth()

  const displayName =
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'مستخدم'

  return (
    <main className="mx-auto max-w-2xl px-4 py-8" dir="rtl">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-black text-sky-600">فهلوي</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            حسابي
          </h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">اسم المستخدم</p>
            <p className="mt-1 text-lg font-black text-slate-900">
              {displayName}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">
              البريد الإلكتروني
            </p>
            <p
              className="mt-1 text-lg font-black text-slate-900"
              dir="ltr"
            >
              {user?.email ?? '—'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}