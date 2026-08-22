import { AnimatePresence, motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
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
 * Compact lifeline menu anchored to the game HUD.
 * Flat, dark, minimal — just an icon button that opens a dropdown.
 */
export function HelpMenu({ lifelines, accent, getDisabled, activeLifelineId, onSelect, english, footer }: HelpMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  const usedCount = lifelines.filter((l) => l.used).length
  const total = lifelines.length

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={english ? 'Lifelines menu' : 'قائمة المساعدات'}
        className={cn(
          'flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-bold transition-colors sm:h-8 sm:text-xs',
          open
            ? 'bg-white/10 text-white'
            : 'text-white/40 hover:bg-white/5 hover:text-white/70 active:text-white/50',
        )}
      >
        <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">{english ? 'Lifelines' : 'المساعدات'}</span>
        {usedCount > 0 && (
          <span className="rounded-full bg-white/10 px-1 py-px text-[8px] text-white/30">
            {total - usedCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute end-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-white/10 bg-[#0e1622]/98 p-1.5 sm:w-64"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
          >
            <div className="mb-1 border-b border-white/[0.06] px-2 pb-1.5">
              <span className="text-[10px] font-bold text-white/40">
                {english ? 'Lifelines' : 'المساعدات'}
              </span>
            </div>

            <ul className="space-y-0.5">
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
                        'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors',
                        isUsed || isDisabled
                          ? 'cursor-not-allowed opacity-30'
                          : isActive
                            ? 'bg-white/[0.06]'
                            : 'hover:bg-white/[0.04]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm',
                          isUsed || isDisabled
                            ? 'bg-white/[0.04] text-white/20'
                            : isActive
                              ? 'bg-[#c69c46]/15 text-[#e4c478]'
                              : accent === 'royal'
                                ? 'bg-[#4d79a7]/10 text-[#8eaecf]'
                                : 'bg-[#c69c46]/10 text-[#e4c478]',
                        )}
                        aria-hidden
                      >
                        {lifeline.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-[11px] font-bold leading-tight',
                            isUsed || isDisabled ? 'text-white/25' : isActive ? 'text-white' : 'text-white/70',
                          )}
                        >
                          {lifeline.label}
                        </span>
                        {lifeline.description && (
                          <span className="block truncate text-[9px] text-white/25">{lifeline.description}</span>
                        )}
                      </span>

                      {isUsed && (
                        <span className="shrink-0 text-[8px] font-bold text-white/20">
                          {english ? 'Used' : '✓'}
                        </span>
                      )}
                      {!isUsed && !isActive && !isDisabled && (
                        <span className="shrink-0 text-[8px] font-bold text-white/20">
                          {english ? 'Ready' : '•'}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            {footer && <div className="mt-1 border-t border-white/[0.06] px-2 pt-1.5">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
