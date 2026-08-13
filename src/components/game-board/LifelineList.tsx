import { motion } from 'framer-motion'
import type { Lifeline } from '../../types/board'
import { cn } from '../../utils/cn'

interface LifelineListProps {
  lifelines: Lifeline[]
  accent: 'royal' | 'gold'
  getDisabled?: (lifelineId: string) => boolean
  activeLifelineId?: string | null
  onSelect?: (lifelineId: string) => void
}

export function LifelineList({ lifelines, accent, getDisabled, activeLifelineId, onSelect }: LifelineListProps) {
  return (
    <ul className="space-y-2">
      {lifelines.map((lifeline, index) => {
        const isUsed = lifeline.used
        const isActive = activeLifelineId === lifeline.id
        const isDisabled = getDisabled ? getDisabled(lifeline.id) : isUsed

        return (
          <motion.li
            key={lifeline.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return
                onSelect?.(lifeline.id)
              }}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-right transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843]/60',
                isUsed
                  ? 'cursor-not-allowed border-gray-700/40 bg-[#0F172A] opacity-50'
                  : isActive
                    ? 'border-[#D4A843]/60 bg-[#D4A843]/10 shadow-[0_0_20px_rgba(212,168,67,0.25)]'
                    : isDisabled
                      ? 'cursor-not-allowed border-gray-700/30 bg-[#0F172A]/60 opacity-60'
                      : accent === 'royal'
                        ? 'cursor-pointer border-[#3B82F6]/30 bg-[#3B82F6]/5 shadow-[0_4px_14px_rgba(59,130,246,0.1)] hover:border-[#3B82F6]/50 hover:bg-[#3B82F6]/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                        : 'cursor-pointer border-[#EF4444]/30 bg-[#EF4444]/5 shadow-[0_4px_14px_rgba(239,68,68,0.1)] hover:border-[#EF4444]/50 hover:bg-[#EF4444]/10 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base shadow-inner transition-transform duration-200 group-hover:scale-105',
                  isUsed ? 'bg-gray-800' : isActive ? 'bg-[#D4A843]/20' : 'bg-[#1E293B]',
                )}
                aria-hidden
              >
                {lifeline.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'text-sm font-semibold',
                  isUsed ? 'text-gray-500' : isActive ? 'text-[#D4A843]' : 'text-white',
                )}>
                  {lifeline.label}
                </p>
                <p className="truncate text-xs text-gray-400">{lifeline.description}</p>
              </div>
              {isUsed && (
                <span className="shrink-0 text-xs text-gray-500">مُستخدم</span>
              )}
              {isActive && !isUsed && (
                <span className="shrink-0 text-xs font-bold text-[#D4A843]">✓ نشط</span>
              )}
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}
