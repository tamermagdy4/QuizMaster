import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe, User, LogOut } from 'lucide-react'
import { useDirectionSync } from '../hooks/useDirectionSync'
import { useAppStore } from '../store/appStore'
import type { NavItem } from '../types'
import { SiteFooter } from '../components/layout/SiteFooter'
import { cn } from '../utils/cn'

const navItems: NavItem[] = [
  { path: '/', label: 'الرئيسية' },
  { path: '/create', label: 'إنشاء لعبة' },
  { path: '/board', label: 'لوحة اللعب' },
  { path: '/question', label: 'السؤال' },
  { path: '/online', label: 'الأونلاين' },
  { path: '/results', label: 'النتائج' },
  { path: '/settings', label: 'الإعدادات' },
  { path: '/about', label: 'عن المطور' },
]

export function MainLayout() {
  useDirectionSync()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, signOut } = useAuth()
  const isAdmin = user?.app_metadata?.role === 'admin'
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // On the homepage the header floats transparently over the cinematic hero
  // and solidifies into the normal navigation once the user scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Admins keep the public nav but swap the "Create Game" entry for the
  // Admin workspace (same behavior as before the Packs addition).
  const visibleNavItems: NavItem[] = isAdmin
    ? [...navItems.filter((item) => item.path !== '/create'), { path: '/admin', label: 'الإدارة' }]
    : navItems
  const { direction, setDirection, theme, animationsEnabled } = useAppStore()
  const language = direction === 'rtl' ? 'ar' : 'en'
  const navLabels = language === 'ar'
    ? { '/': 'الرئيسية', '/create': 'إنشاء لعبة', '/online': 'الأونلاين', '/question': 'السؤال', '/about': 'عن المطور', '/board': 'لوحة اللعب', '/results': 'النتائج', '/settings': 'الإعدادات', '/admin': 'الإدارة' }
    : { '/': 'Home', '/create': 'Create Game', '/online': 'Online', '/question': 'Question', '/about': 'About', '/board': 'Game Board', '/results': 'Results', '/settings': 'Settings', '/admin': 'Admin' }

  // Close the mobile drawer on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Every navigation lands at the TOP of the next page — never carries the
  // previous page's scroll position (especially the 800vh home journey),
  // so a route is always fully visible without scrolling.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Homepage is a full-bleed cinematic journey — no max-width container,
  // no page padding, no card look. Every other page keeps the standard layout.
  const isHome = location.pathname === '/'
  const homeTop = isHome && !scrolled

  // The game routes (create / board / question / online / results) live on the
  // dark navy game-show stage — so the whole page + header go dark there too,
  // exactly like the home hero opening. Utility pages stay light.
  // The persisted theme (Settings → Appearance) overrides this: choosing Light
  // turns the game routes + header light; the homepage hero keeps its own
  // transparent dark chrome because it floats over the cinematic video scenes.
  const isGameRoute =
    location.pathname === '/create' ||
    location.pathname === '/board' ||
    location.pathname === '/question' ||
    location.pathname === '/results' ||
    location.pathname === '/online' ||
    location.pathname.startsWith('/online/') ||
    location.pathname === '/live' ||
    location.pathname.startsWith('/live/')
  const darkChrome = homeTop || isGameRoute

  return (
    <div className={cn('app-shell relative min-h-dvh overflow-x-clip transition-colors duration-300', theme === 'light' ? 'theme-light' : 'theme-premium', darkChrome ? 'bg-[#0b1017] text-cream' : 'bg-cream text-ink', animationsEnabled ? 'motion-enabled' : 'motion-reduced')}>
      {/* soft ambient wash — hidden on home and the dark game routes where the stage owns the bg */}
      {!isHome && !isGameRoute && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_82%_0%,rgba(61,112,128,0.08),transparent_70%),radial-gradient(50%_90%_at_8%_0%,rgba(70,138,94,0.07),transparent_70%)]" />
      )}

      {/* ===== Header ===== */}
      <header className={cn('sticky top-0 z-50 border-b transition-colors duration-300', darkChrome ? 'border-white/10 bg-[#0b1017]/95 backdrop-blur-md' : 'border-border-soft/70 bg-white/95')}>
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <Link to="/" className="group flex items-center gap-3">
            <img
              src="/photos/لوجو.jpeg"
              alt="فهلوي"
              className="h-10 w-10 rounded-xl object-cover shadow-[0_6px_16px_rgba(0,0,0,0.25)] transition-transform duration-200 group-hover:-rotate-3"
            />
            <span className="leading-none">
              <span className={cn('block font-display text-xl font-extrabold tracking-tight', darkChrome ? 'text-cream' : 'text-navy')}>
                {language === 'ar' ? 'فهلوي' : 'Fahloy'}
              </span>
              <span className={cn('mt-0.5 block text-[10px] font-bold', darkChrome ? 'text-cream/50' : 'text-muted')}>
                {language === 'ar' ? 'مسابقة معرفية عربية' : 'Arabic Quiz Game'}
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label={language === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-[13px] font-bold transition-colors duration-150',
                    isActive
                      ? darkChrome
                        ? 'text-cream shadow-[inset_0_-2px_0_rgba(198,156,70,0.9)]'
                        : 'text-navy shadow-[inset_0_-2px_0_rgba(198,156,70,0.9)]'
                      : darkChrome
                        ? 'text-cream/65 hover:text-cream'
                        : 'text-ink-2 hover:text-navy',
                  )
                }
              >
                {navLabels[item.path as keyof typeof navLabels]}
              </NavLink>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Language toggle — realistic tactile glass button */}
            <button
              type="button"
              onClick={() => setDirection(language === 'ar' ? 'ltr' : 'rtl')}
              aria-label={language === 'ar' ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
              className="group relative hidden h-9 items-center gap-1.5 overflow-hidden rounded-xl border border-[#2a3a52] bg-gradient-to-b from-[#182333] to-[#0f1724] px-3 text-xs font-extrabold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-[#c69c46]/60 hover:bg-[#1f2d42] hover:text-white hover:shadow-[0_0_14px_rgba(198,156,70,0.2)] active:scale-[0.96] sm:inline-flex"
            >
              <Globe className="h-3.5 w-3.5 text-[#8eaecf] transition-transform duration-200 group-hover:rotate-12" />
              <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {isAuthenticated ? (
              <>
                {/* Account — realistic tactile glass button with User icon */}
                <Link
                  to="/profile"
                  className="group relative hidden h-9 items-center gap-1.5 overflow-hidden rounded-xl border border-[#2a3a52] bg-gradient-to-b from-[#182333] to-[#0f1724] px-3 text-xs font-extrabold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-[#c69c46]/60 hover:bg-[#1f2d42] hover:text-white hover:shadow-[0_0_14px_rgba(198,156,70,0.2)] active:scale-[0.96] sm:inline-flex"
                >
                  <User className="h-3.5 w-3.5 text-[#e4c478] transition-transform duration-200 group-hover:scale-110" />
                  <span>{language === 'ar' ? 'حسابي' : 'Profile'}</span>
                </Link>

                {/* Logout — realistic dark ruby tactile glass button with LogOut icon */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signOut()
                      navigate('/')
                    } catch {
                      // Keep the current page if logout fails.
                    }
                  }}
                  className="group relative hidden h-9 items-center gap-1.5 overflow-hidden rounded-xl border border-rose-500/30 bg-gradient-to-b from-[#1e141a] to-[#120c12] px-3 text-xs font-extrabold text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-rose-400/60 hover:bg-rose-950/40 hover:text-white hover:shadow-[0_0_14px_rgba(244,63,94,0.2)] active:scale-[0.96] sm:inline-flex"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-400 transition-transform duration-200 group-hover:-translate-x-0.5" />
                  <span>{language === 'ar' ? 'خروج' : 'Sign out'}</span>
                </button>
              </>
            ) : (
              <>
                {/* تسجيل الدخول — realistic gold button */}
                <Link
                  to="/login"
                  className="hidden h-9 items-center rounded-xl border border-[#c69c46]/60 bg-gradient-to-b from-[#e4c478] to-[#c69c46] px-3.5 text-xs font-black text-[#0b1017] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_rgba(198,156,70,0.25)] transition hover:brightness-105 active:scale-[0.96] sm:inline-flex"
                >
                  {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                </Link>
                {/* إنشاء حساب — realistic dark button */}
                <Link
                  to="/signup"
                  className="hidden h-9 items-center rounded-xl border border-[#2a3a52] bg-gradient-to-b from-[#182333] to-[#0f1724] px-3.5 text-xs font-extrabold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.35)] transition hover:border-[#c69c46]/60 hover:text-white active:scale-[0.96] sm:inline-flex"
                >
                  {language === 'ar' ? 'إنشاء حساب' : 'Create account'}
                </Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              aria-label={language === 'ar' ? 'فتح القائمة' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={cn('flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition lg:hidden', darkChrome ? 'border-white/18 bg-white/8 text-cream hover:bg-white/15' : 'border-border-soft bg-white text-navy hover:bg-surface-raised')}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={cn('overflow-hidden border-t lg:hidden', darkChrome ? 'border-white/10 bg-[#0B1526]' : 'border-border-soft bg-white')}
              aria-label={language === 'ar' ? 'قائمة الجوال' : 'Mobile menu'}
            >
              <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-1 px-4 py-3 sm:px-6">
                {visibleNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'rounded-lg px-3 py-2.5 text-sm font-bold transition-colors',
                        isActive
                          ? darkChrome
                            ? 'bg-white/10 text-cream'
                            : 'bg-navy/8 text-navy'
                          : darkChrome
                            ? 'text-cream/70 hover:bg-white/10 hover:text-cream'
                            : 'text-ink-2 hover:bg-surface-raised',
                      )
                    }
                  >
                    {navLabels[item.path as keyof typeof navLabels]}
                  </NavLink>
                ))}
                {isAuthenticated ? (
                  <>
                    <NavLink to="/profile" className={cn('rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-white/10', darkChrome ? 'text-cream' : 'text-navy hover:bg-surface-raised')}>
                      {language === 'ar' ? 'حسابي' : 'Profile'}
                    </NavLink>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await signOut()
                          navigate('/')
                        } catch {
                          // Keep the current page if logout fails.
                        }
                      }}
                      className={cn('rounded-lg px-3 py-2.5 text-start text-sm font-bold hover:bg-red/10', darkChrome ? 'text-red-bright' : 'text-red hover:bg-red/5')}
                    >
                      {language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink to="/login" className={cn('rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-white/10', darkChrome ? 'text-cream' : 'text-navy hover:bg-surface-raised')}>
                      {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                    </NavLink>
                    <NavLink to="/signup" className={cn('rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-white/10', darkChrome ? 'text-cream' : 'text-navy hover:bg-surface-raised')}>
                      {language === 'ar' ? 'إنشاء حساب' : 'Create account'}
                    </NavLink>
                  </>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className={cn('relative', isHome ? 'w-full' : 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6')}>
        {/* gold hairline wipe — a camera-like sweep on every navigation */}
        <motion.span
          key={`wipe-${location.pathname}`}
          aria-hidden
          initial={animationsEnabled ? { scaleX: 0, opacity: 0 } : false}
          animate={animationsEnabled ? { scaleX: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px origin-right bg-gradient-to-l from-transparent via-gold to-transparent"
        />
        {/* Route content — mounts IMMEDIATELY and is fully visible from the
            first frame. The entrance is a subtle transform-only settle (never
            opacity-gated), so no animation state — a throttled frame loop, a
            paused rAF, anything — can ever hide the page. The old page
            unmounts instantly; it never blocks the next one from mounting. */}
        <motion.div
          key={location.pathname}
          initial={animationsEnabled ? { y: 12, scale: 0.998 } : false}
          animate={animationsEnabled ? { y: 0, scale: 1 } : undefined}
          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Marketing footer — homepage only. Every other route keeps the page clean. */}
      {location.pathname === '/' && <SiteFooter />}
    </div>
  )
}
