import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lifeline } from '../../types/board'
import { cn } from '../../utils/cn'

interface HelpMenuProps {
  lifelines: Lifeline[]
  accent: 'royal' | 'gold'
  getDisabled?: (lifelineId: string) => boolean
  activeLifelineId?: string | null
  onSelect?: (lifelineId: string) => void
  english: boolean
  /** Optional footer content (e.g. keyboard shortcuts). */
  footer?: ReactNode
}

/**
 * "المساعدات" — the lifeline help menu in the game header.
 *
 * A floating glass panel anchored to the header button. It lists the
 * EXISTING lifelines for the current team/question and calls the existing
 * `useLifeline` flow through `onSelect` — no new lifeline mechanic.
 */
export function HelpMenu({ lifelines, accent, getDisabled, activeLifelineId, onSelect, english, footer }: HelpMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={english ? 'Lifelines menu' : 'قائمة المساعدات'}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/60 lg:h-10 lg:px-3.5 lg:text-sm',
          'border-gold/45 bg-gold/10 text-gold-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_rgba(0,0,0,0.3)]',
          open
            ? 'border-gold/80 shadow-[0_0_22px_rgba(201,162,39,0.3)]'
            : 'hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-[0_0_20px_rgba(201,162,39,0.25)] active:translate-y-0',
        )}
      >
        <span aria-hidden className="text-base leading-none">🎛️</span>
        <span className="hidden sm:inline">{english ? 'Lifelines' : 'المساعدات'}</span>
        <span className="sm:hidden" aria-hidden>؟</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'absolute end-0 top-full z-50 mt-2 w-64 origin-top-end rounded-2xl border border-white/10 bg-[#0B1526]/95 p-2 shadow-[0_22px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:w-72',
            )}
          >
            <div className="mb-1.5 flex items-center justify-between border-b border-white/10 px-2 pb-2">
              <span className="text-xs font-black text-gold-bright">
                {english ? 'Lifelines' : 'المساعدات'}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-cream/60">
                {accent === 'royal' ? '🛡️' : '👑'}
              </span>
            </div>

            <ul className="space-y-1">
              {lifelines.map((lifeline) => {
                const isUsed = lifeline.used
                const isActive = activeLifelineId === lifeline.id
                const isDisabled = getDisabled ? getDisabled(lifeline.id) : isUsed
                return (
                  <li key={lifeline.id}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return
                        onSelect?.(lifeline.id)
                        setOpen(false)
                      }}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/60',
                        isUsed
                          ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-45'
                          : isActive
                            ? 'border-gold/70 bg-gold/10'
                            : isDisabled
                              ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-45'
                              : accent === 'royal'
                                ? 'cursor-pointer border-white/10 bg-white/[0.03] hover:border-[#3b82f6]/60 hover:bg-[#3b82f6]/10'
                                : 'cursor-pointer border-white/10 bg-white/[0.03] hover:border-gold/60 hover:bg-gold/10',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base',
                          isUsed
                            ? 'bg-white/[0.06] grayscale'
                            : isActive
                              ? 'bg-gold/25'
                              : accent === 'royal'
                                ? 'bg-[#3b82f6]/15'
                                : 'bg-gold/15',
                        )}
                        aria-hidden
                      >
                        {lifeline.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-xs font-bold leading-tight', isUsed ? 'text-gray-500' : isActive ? 'text-gold-bright' : 'text-cream')}>
                          {lifeline.label}
                        </span>
                        <span className="block truncate text-[10px] text-cream/45">{lifeline.description}</span>
                      </span>

                      {isUsed ? (
                        <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[9px] font-black text-gray-400">
                          {english ? 'Used' : 'تم الاستخدام'}
                        </span>
                      ) : isActive ? (
                        <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-black text-gold-bright">
                          {english ? 'Active' : '✓ نشط'}
                        </span>
                      ) : isDisabled ? (
                        <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-black text-gray-500">
                          {english ? 'Locked' : 'مقفول'}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black',
                            accent === 'royal' ? 'bg-[#3b82f6]/12 text-[#93c5fd]' : 'bg-gold/12 text-gold-bright',
                          )}
                        >
                          {english ? 'Ready' : 'متاح'}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            {footer && <div className="mt-1.5 border-t border-white/10 px-2 pt-1.5">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
