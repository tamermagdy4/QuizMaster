import { Link } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'

export function Home() {
  return (
    <div className="space-y-8">
      <GlassCard strong className="text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-gold-400">مرحباً بك</p>
        <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">ساحة الأسئلة</h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/75">
          منصة مسابقات معرفية عربية بتصميم زجاجي عصري. أنشئ لعبتك، ادعُ فريقك، وابدأ
          التحدي الآن.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/create"
            className="glass-button inline-flex rounded-xl px-6 py-3 font-semibold text-white"
          >
            ابدأ لعبة جديدة
          </Link>
          <Link
            to="/board"
            className="inline-flex rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white/90 transition hover:bg-white/10"
          >
            عرض لوحة اللعب
          </Link>
        </div>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'فئات متنوعة', desc: 'اختر مواضيع تناسب جمهورك' },
          { title: 'فرق تنافسية', desc: 'نظام نقاط حي ومباشر' },
          { title: 'تصميم عربي', desc: 'دعم كامل للاتجاه من اليمين لليسار' },
        ].map((feature) => (
          <GlassCard key={feature.title}>
            <h2 className="mb-2 text-lg font-semibold text-gold-400">{feature.title}</h2>
            <p className="text-sm text-white/70">{feature.desc}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
