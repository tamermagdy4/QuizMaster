import { motion } from 'framer-motion'
import { defaultLifelines } from '../../data/lifelines'
import { LIFELINES_PER_TEAM, type TeamId } from '../../types/game'
import type { LifelineId } from '../../types/board'
import { cn } from '../../utils/cn'
import { useTranslation, presentLifeline } from '../../i18n/translations'
interface Props { teamId: TeamId; teamName: string; selectedIds: LifelineId[]; onToggle: (teamId: TeamId, id: LifelineId) => void }
const allLifelines = defaultLifelines()
export function LifelineSelector({ teamId, teamName, selectedIds, onToggle }: Props) {
  const { t, english } = useTranslation()
  const full = selectedIds.length >= LIFELINES_PER_TEAM
  const accentBorder = teamId === 1 ? 'border-teal/60 bg-teal/15 shadow-[0_0_14px_rgba(47,125,126,0.25)]' : 'border-gold/60 bg-gold/15 shadow-[0_0_14px_rgba(201,162,39,0.25)]'
  const accentCheck = teamId === 1 ? 'bg-teal' : 'bg-gold'
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-cream/80">{t('lifelines')} · {teamName}</h3>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', full ? 'bg-white/10 text-cream/70' : 'bg-white/10 text-cream/60')}>
          {selectedIds.length} / {LIFELINES_PER_TEAM}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {allLifelines.map((lifeline) => {
          const selected = selectedIds.includes(lifeline.id)
          const disabled = !selected && full
          const copy = presentLifeline(lifeline.id, lifeline.label, lifeline.description, english)
          return (
            <motion.button
              key={lifeline.id}
              type="button"
              layout
              whileTap={!disabled ? { scale: 0.93 } : undefined}
              onClick={() => onToggle(teamId, lifeline.id)}
              disabled={disabled}
              title={copy.description}
              aria-label={copy.description}
              aria-pressed={selected}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center transition',
                selected
                  ? accentBorder
                  : disabled
                    ? 'cursor-not-allowed border-white/8 bg-white/[0.03] opacity-40'
                    : 'border-white/12 bg-[#0B1526]/60 hover:border-teal/40 hover:bg-white/5',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm transition',
                  selected ? 'bg-white/15' : 'bg-white/8 group-hover:bg-white/12',
                )}
              >
                {lifeline.icon}
              </span>
              <span className={cn('block w-full truncate text-[8px] font-bold leading-tight', selected ? 'text-cream' : 'text-cream/60')}>
                {copy.label}
              </span>
              {selected && (
                <motion.span
                  layoutId={`lifeline-check-${teamId}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className={cn('absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.45)]', accentCheck)}
                  aria-hidden
                >
                  ✓
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
