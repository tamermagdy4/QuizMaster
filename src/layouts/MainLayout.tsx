import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDirectionSync } from '../hooks/useDirectionSync'
import { useAppStore } from '../store/appStore'
import { NavLinkItem } from '../components/NavLinkItem'
import type { NavItem } from '../types'
import { startBackgroundMusic, stopBackgroundMusic, setMusicVolume } from '../utils/audioManager'

const navItems: NavItem[] = [
  { path: '/', label: 'الرئيسية' },
  { path: '/create', label: 'إنشاء لعبة' },
  { path: '/board', label: 'لوحة اللعب' },
  { path: '/question', label: 'السؤال' },
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

const visibleNavItems: NavItem[] = isAdmin
  ? [...navItems, { path: '/admin', label: 'الإدارة' }]
  : navItems
  const { direction, setDirection, musicEnabled, musicVolume, theme, animationsEnabled } = useAppStore()
  const language = direction === 'rtl' ? 'ar' : 'en'
  const navLabels = language === 'ar'
    ? { '/': 'الرئيسية', '/create': 'إنشاء لعبة', '/about': 'عن المطور', '/board': 'لوحة اللعب', '/question': 'السؤال', '/results': 'النتائج', '/settings': 'الإعدادات', '/admin': 'الإدارة' }
    : { '/': 'Home', '/create': 'Create Game', '/about': 'About', '/board': 'Game Board', '/question': 'Question', '/results': 'Results', '/settings': 'Settings', '/admin': 'Admin' }

  useEffect(() => {
    if (musicEnabled) startBackgroundMusic(musicVolume)
    else stopBackgroundMusic()
    setMusicVolume(musicVolume)
    return () => stopBackgroundMusic()
  }, [musicEnabled, musicVolume])

  return (
    <div className={`app-shell theme-${theme} ${animationsEnabled ? 'motion-enabled' : 'motion-reduced'} relative min-h-dvh overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'bg-slate-50 text-slate-800' : 'ambient-bg'}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -start-24 top-20 h-96 w-96 rounded-full bg-sky-200/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-20 bottom-20 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200/20 blur-3xl"
      />

      <header className={`sticky top-0 z-50 mx-auto w-full max-w-7xl border-b px-4 py-4 shadow-[0_2px_20px_rgba(23,107,135,0.06)] backdrop-blur-xl transition-colors duration-300 sm:px-6 ${theme === 'light' ? 'border-slate-200/80 bg-white/90' : 'border-slate-700/60 bg-slate-950/85'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 text-xl font-bold text-white shadow-[0_8px_20px_rgba(23,107,135,0.3)]">
              س
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{language === 'ar' ? 'فهلوي' : 'Fahloy'}</p>
              <p className="text-xs text-slate-500">{language === 'ar' ? 'مسابقة معرفية عربية' : 'Arabic Quiz Game'}</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
           {visibleNavItems.map((item) => (
              <NavLinkItem
                key={item.path}
                to={item.path}
                label={navLabels[item.path as keyof typeof navLabels]}
                end={item.path === '/'}
              />
            ))}
          </nav>
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
              >
                {language === 'ar'
                  ? `حسابي${user?.user_metadata?.display_name ? ` (${user.user_metadata.display_name})` : ''}`
                  : `Profile${user?.user_metadata?.display_name ? ` (${user.user_metadata.display_name})` : ''}`}
              </Link>

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
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-100"
              >
                {language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
              >
                {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
              </Link>

              <Link
                to="/signup"
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                {language === 'ar' ? 'إنشاء حساب' : 'Create account'}
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setDirection(language === 'ar' ? 'ltr' : 'rtl')}
            className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {language === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={animationsEnabled ? { opacity: 0, y: 16 } : false}
            animate={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
            exit={animationsEnabled ? { opacity: 0, y: -12 } : undefined}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-center text-sm text-slate-400 sm:px-6">
        © {new Date().getFullYear()} {language === 'ar' ? 'فهلوي' : 'Fahloy'} — {language === 'ar' ? 'تجربة أصلية بالكامل' : 'An original experience'}
      </footer>
    </div>
  )
}
