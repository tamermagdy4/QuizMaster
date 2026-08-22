import { AnimatePresence, motion } from 'framer-motion'
import type { Lifeline } from '../../types/board'
import { cn } from '../../utils/cn'

interface LifelineListProps {
  lifelines: Lifeline[]
  accent: 'royal' | 'gold'
  getDisabled?: (lifelineId: string) => boolean
  activeLifelineId?: string | null
  onSelect?: (lifelineId: string) => void
}

/**
 * Game-show control deck — each lifeline is a physical tool card with a
 * coloured icon tile and a status chip (متاح / مُستخدم / نشط). `accent`
 * colours the idle state: royal (team 1, blue) vs gold (team 2, gold).
 */
export function LifelineList({ lifelines, accent, getDisabled, activeLifelineId, onSelect }: LifelineListProps) {
  return (
    <ul className="space-y-1 sm:space-y-1.5">
      {lifelines.map((lifeline, index) => {
        const isUsed = lifeline.used
        const isActive = activeLifelineId === lifeline.id
        const isDisabled = getDisabled ? getDisabled(lifeline.id) : isUsed

        return (
          <motion.li
            key={lifeline.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          >
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return
                onSelect?.(lifeline.id)
              }}
              aria-label={
                isUsed
                  ? `${lifeline.label} — used`
                  : isActive
                    ? `${lifeline.label} — active`
                    : isDisabled
                      ? `${lifeline.label} — locked`
                      : `${lifeline.label} — available`
              }
              className={cn(
                'group flex w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-start transition-all duration-200 ease-out sm:gap-2.5 sm:px-2.5 sm:py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/60',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_14px_rgba(0,0,0,0.35)]',
                isUsed
                  ? 'cursor-not-allowed border-white/[0.07] bg-[#0b1017] opacity-45'
                  : isActive
                    ? 'border-gold/70 bg-gold/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(198,156,70,0.3)]'
                    : isDisabled
                      ? 'cursor-not-allowed border-white/[0.07] bg-[#0b1017] opacity-45'
                      : accent === 'royal'
                        ? 'cursor-pointer border-[#4d79a7]/40 bg-[#4d79a7]/[0.07] hover:-translate-y-0.5 hover:border-[#8eaecf]/70 hover:bg-[#4d79a7]/15 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(77,121,167,0.28)] active:translate-y-0 active:scale-[0.98]'
                        : 'cursor-pointer border-gold/40 bg-gold/[0.06] hover:-translate-y-0.5 hover:border-gold/70 hover:bg-gold/15 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(198,156,70,0.28)] active:translate-y-0 active:scale-[0.98]',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm shadow-inner transition-transform duration-200 group-hover:scale-105 sm:h-9 sm:w-9 sm:text-base',
                  isUsed
                    ? 'bg-white/[0.06] grayscale'
                    : isActive
                      ? 'bg-gold/25'
                      : accent === 'royal'
                        ? 'bg-[#4d79a7]/15'
                        : 'bg-gold/15',
                )}
                aria-hidden
              >
                {lifeline.icon}
              </span>

              <div className="min-w-0 flex-1">
                <p className={cn(
                  'text-[12px] font-bold leading-tight sm:text-[13px]',
                  isUsed ? 'text-gray-500' : isActive ? 'text-gold-bright' : 'text-cream',
                )}>
                  {lifeline.label}
                </p>
                <p className="truncate text-[10px] text-cream/40 sm:text-[11px]">{lifeline.description}</p>
              </div>

              {isUsed ? (
                <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[9px] font-black text-gray-400">
                  مُستخدم
                </span>
              ) : isActive ? (
                <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-black text-gold-bright">
                  ✓ نشط
                </span>
              ) : (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black',
                    accent === 'royal' ? 'bg-[#4d79a7]/12 text-[#8eaecf]' : 'bg-gold/12 text-gold-bright',
                  )}
                >
                  متاح
                </span>
              )}
            </button>

            {/*
             * Function hint — appears below the cell while the lifeline is
             * selected/active, with a soft fade + slide entrance.
             */}
            <AnimatePresence initial={false}>
              {isActive && (
                <motion.p
                  initial={{ opacity: 0, y: -5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={cn(
                    'mt-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold leading-relaxed',
                    accent === 'royal'
                      ? 'border-[#4d79a7]/35 bg-[#4d79a7]/10 text-[#8eaecf]'
                      : 'border-gold/35 bg-gold/10 text-gold-bright',
                  )}
                >
                  {lifeline.icon} {lifeline.description}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.li>
        )
      })}
    </ul>
  )
}
