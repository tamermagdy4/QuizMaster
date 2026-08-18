import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

type FooterColumn = {
  title: string
  titleAr: string
  links: { label: string; href: string }[]
}

const columns: FooterColumn[] = [
  {
    title: 'Support',
    titleAr: 'الدعم',
    links: [
      { label: 'FAQs', href: '/about' },
      { label: 'Log In', href: '/login' },
    ],
  },
  {
    title: 'About',
    titleAr: 'عن فهلوي',
    links: [
      { label: 'The Developer', href: '/about' },
      { label: 'Contact Us', href: '/about' },
    ],
  },
  {
    title: 'Sections',
    titleAr: 'الأقسام',
    links: [
      { label: 'New Games', href: '/create' },
      { label: 'Play Online', href: '/online' },
      { label: 'Game Board', href: '/board' },
    ],
  },
  {
    title: 'Discover',
    titleAr: 'اكتشف',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Settings', href: '/settings' },
      { label: 'Results', href: '/results' },
      { label: 'Profile', href: '/profile' },
    ],
  },
]

const arLinks: Record<string, string> = {
  FAQs: 'الأسئلة الشائعة',
  'Log In': 'تسجيل الدخول',
  'The Developer': 'عن المطور',
  'Contact Us': 'تواصل معنا',
  'New Games': 'ألعاب جديدة',
  'Play Online': 'العب أونلاين',
  'Game Board': 'لوحة اللعب',
  Home: 'الرئيسية',
  Settings: 'الإعدادات',
  Results: 'النتائج',
  Profile: 'الملف الشخصي',
}

export function SiteFooter() {
  const { direction, language } = useAppStore()
  const english = language === 'en'
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  return (
    <footer dir={direction} className="relative mt-14 sm:mt-20">
      {/* gold hairline — the premium finish line */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#0a1823_0%,#060f17_100%)]">
        {/* subtle atmospheric light — restrained, brand-only */}
        <div aria-hidden className="pointer-events-none absolute -top-24 start-1/4 h-48 w-96 rounded-full bg-teal/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 end-0 h-48 w-80 rounded-full bg-gold/[0.06] blur-3xl" />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.45fr)] lg:gap-x-8">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.24em] text-gold-bright">
                  <span aria-hidden className="h-px w-6 bg-gold/60" />
                  {column.title}
                </h3>
                <p className="mt-1.5 ps-8 text-[11px] font-bold text-cream/40">{column.titleAr}</p>
                <ul className="mt-4 space-y-2.5 ps-8">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.href}
                        className="group inline-flex items-center gap-1.5 text-sm text-cream/70 transition-colors duration-150 hover:text-gold-bright"
                      >
                        <span aria-hidden className="text-[10px] text-gold/0 transition-all duration-150 group-hover:text-gold/80">
                          {direction === 'rtl' ? '‹' : '›'}
                        </span>
                        <span className="underline-offset-4 transition-[text-decoration-color] duration-150 group-hover:underline group-hover:decoration-gold/60">
                          {english ? link.label : arLinks[link.label] ?? link.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            {/* Newsletter */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
                <h3 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.24em] text-gold-bright">
                  <span aria-hidden>✉</span>
                  Newsletter
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cream/70">
                  {english
                    ? 'Subscribe for updates, new products, offers, and news.'
                    : 'اشترك ليصلك كل جديد: تحديثات ومنتجات وعروض وأخبار.'}
                </p>

                {subscribed ? (
                  <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-green/40 bg-green/10 px-3 py-3 text-sm font-bold text-green-bright">
                    <span aria-hidden>✓</span>
                    {english ? 'Thanks for subscribing!' : 'تم الاشتراك بنجاح!'}
                  </p>
                ) : (
                  <form
                    className="mt-4 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (email.trim()) setSubscribed(true)
                    }}
                  >
                    <label htmlFor="footer-newsletter" className="sr-only">
                      {english ? 'Email address' : 'البريد الإلكتروني'}
                    </label>
                    <input
                      id="footer-newsletter"
                      type="email"
                      required
                      dir={direction}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={english ? 'Your email' : 'بريدك الإلكتروني'}
                      className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-cream outline-none transition placeholder:text-cream/40 focus:border-teal/70 focus:ring-2 focus:ring-teal/20"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg bg-gradient-to-b from-gold to-[#a8861f] px-5 py-2.5 text-sm font-black text-[#12232b] shadow-[0_10px_22px_rgba(201,162,39,0.25)] transition hover:brightness-110 active:scale-[0.98]"
                    >
                      {english ? 'Subscribe' : 'اشترك'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* bottom bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:pt-7">
            <div className="flex items-center gap-3">
              <img
                src="/photos/لوجو.jpeg"
                alt="فهلوي"
                className="h-9 w-9 rounded-lg object-cover shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
              />
              <div className="leading-none">
                <span className="block font-display text-base font-extrabold tracking-tight text-cream">
                  {english ? 'Fahloy' : 'فهلوي'}
                </span>
                <span className="mt-1 block text-[10px] font-bold text-cream/45">
                  {english ? 'Arabic Quiz Game' : 'مسابقة معرفية عربية'}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-3 text-xs font-bold">
                <Link to="/privacy" className="text-cream/55 transition-colors duration-150 hover:text-gold-bright">
                  {english ? 'Privacy Policy' : 'سياسة الخصوصية'}
                </Link>
                <span aria-hidden className="text-cream/25">•</span>
                <Link to="/terms" className="text-cream/55 transition-colors duration-150 hover:text-gold-bright">
                  {english ? 'Terms of Service' : 'شروط الاستخدام'}
                </Link>
              </div>
              <p className="text-center text-xs text-cream/45">
                © {new Date().getFullYear()} {english ? 'Fahloy' : 'فهلوي'} — {english ? 'An original experience' : 'تجربة أصلية بالكامل'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
