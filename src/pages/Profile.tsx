import { useAuth } from '../auth/AuthProvider'
import { useAppStore } from '../store/appStore'

export function Profile() {
  const { user } = useAuth()
  const english = useAppStore((state) => state.language === 'en')

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'مستخدم'

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto max-w-4xl space-y-6">
      {/* ===== Account card ===== */}
      <section className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-white shadow-panel sm:p-8">
        <div className="pointer-events-none absolute -end-12 -top-14 h-40 w-40 rounded-full bg-gold/15 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-2xl font-black shadow-inner">
            {displayName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-white/70">{english ? 'Fahloy' : 'فهلوي'}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{english ? 'My account' : 'حسابي'}</h1>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/15 p-4">
            <p className="text-xs font-bold text-white/60">{english ? 'Username' : 'اسم المستخدم'}</p>
            <p className="mt-1 text-lg font-black">{displayName}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/15 p-4">
            <p className="text-xs font-bold text-white/60">{english ? 'Email' : 'البريد الإلكتروني'}</p>
            <p className="mt-1 truncate text-lg font-black" dir="ltr">{user?.email ?? '—'}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
