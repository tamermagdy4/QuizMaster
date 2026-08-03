import { motion } from 'framer-motion'
import type { Lifeline } from '../../types/board'
import { cn } from '../../utils/cn'

interface LifelineListProps {
  lifelines: Lifeline[]
  accent: 'royal' | 'gold'
}

export function LifelineList({ lifelines, accent }: LifelineListProps) {
  return (
    <ul className="space-y-2">
      {lifelines.map((lifeline, index) => (
        <motion.li
          key={lifeline.id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-3 py-2.5',
            lifeline.used
              ? 'border-white/8 bg-white/5 opacity-50'
              : accent === 'royal'
                ? 'border-royal-400/25 bg-royal-500/10'
                : 'border-gold-400/25 bg-gold-400/10',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base',
              lifeline.used ? 'bg-white/10' : 'bg-white/15',
            )}
            aria-hidden
          >
            {lifeline.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{lifeline.label}</p>
            <p className="truncate text-xs text-white/50">{lifeline.description}</p>
          </div>
          {lifeline.used && (
            <span className="shrink-0 text-xs text-white/40">مُستخدم</span>
          )}
        </motion.li>
      ))}
    </ul>
  )
}
