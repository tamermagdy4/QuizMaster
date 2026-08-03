import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useDirectionSync } from '../hooks/useDirectionSync'
import { useAppStore } from '../store/appStore'
import { NavLinkItem } from '../components/NavLinkItem'
import type { NavItem } from '../types'

const navItems: NavItem[] = [
  { path: '/', label: 'الرئيسية' },
  { path: '/create', label: 'إنشاء لعبة' },
  { path: '/board', label: 'لوحة اللعب' },
  { path: '/question', label: 'السؤال' },
  { path: '/results', label: 'النتائج' },
  { path: '/settings', label: 'الإعدادات' },
  { path: '/admin', label: 'الإدارة' },
]

export function MainLayout() {
  useDirectionSync()
  const location = useLocation()
  const { direction, toggleDirection } = useAppStore()

  return (
    <div className="ambient-bg relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -start-24 top-20 h-72 w-72 rounded-full bg-royal-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 bottom-16 h-64 w-64 rounded-full bg-gold-400/15 blur-3xl"
      />

      <header className="glass-panel sticky top-0 z-50 mx-auto w-full max-w-6xl rounded-none border-x-0 border-t-0 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500 to-gold-400 text-lg font-bold text-midnight-950 shadow-glow-gold">
              س
            </div>
            <div>
              <p className="text-lg font-semibold text-white">ساحة الأسئلة</p>
              <p className="text-xs text-white/60">مسابقة معرفية عربية</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <NavLinkItem
                key={item.path}
                to={item.path}
                label={item.label}
                end={item.path === '/'}
              />
            ))}
          </nav>

          <button
            type="button"
            onClick={toggleDirection}
            className="glass-button rounded-xl px-4 py-2 text-sm font-medium text-white"
          >
            {direction === 'rtl' ? 'EN' : 'عربي'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-center text-sm text-white/45 sm:px-6">
        © {new Date().getFullYear()} ساحة الأسئلة — تجربة أصلية بالكامل
      </footer>
    </div>
  )
}
