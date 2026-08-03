import { motion } from 'framer-motion'
import { CATEGORIES_PER_TEAM, type TeamId } from '../../types/game'
import { cn } from '../../utils/cn'

interface TeamSelectionProgressProps {
  team1Name: string
  team2Name: string
  team1Count: number
  team2Count: number
  activeTeam: TeamId
}

export function TeamSelectionProgress({
  team1Name,
  team2Name,
  team1Count,
  team2Count,
  activeTeam,
}: TeamSelectionProgressProps) {
  return (
    <div className="space-y-3">
      <TeamRow
        teamLabel={team1Name.trim() || 'الفريق الأول'}
        count={team1Count}
        isActive={activeTeam === 1}
        accent="royal"
      />
      <TeamRow
        teamLabel={team2Name.trim() || 'الفريق الثاني'}
        count={team2Count}
        isActive={activeTeam === 2}
        accent="gold"
      />
    </div>
  )
}

interface TeamRowProps {
  teamLabel: string
  count: number
  isActive: boolean
  accent: 'royal' | 'gold'
}

function TeamRow({ teamLabel, count, isActive, accent }: TeamRowProps) {
  const complete = count === CATEGORIES_PER_TEAM

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border px-4 py-3 transition-colors',
        isActive
          ? accent === 'royal'
            ? 'border-royal-400/50 bg-royal-500/15'
            : 'border-gold-400/50 bg-gold-400/10'
          : 'border-white/10 bg-white/5',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-white">{teamLabel}</span>
        {isActive && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-full bg-white/15 px-2 py-0.5 text-xs text-white/80"
          >
            دور الاختيار
          </motion.span>
        )}
        {complete && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="rounded-full bg-teal-400/20 px-2 py-0.5 text-xs text-teal-400"
          >
            ✓ مكتمل
          </motion.span>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-white/65">المختار:</span>
        <span
          className={cn(
            'font-bold tabular-nums',
            complete ? 'text-teal-400' : isActive ? 'text-gold-400' : 'text-white/70',
          )}
        >
          {count} / {CATEGORIES_PER_TEAM}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={false}
          animate={{ width: `${(count / CATEGORIES_PER_TEAM) * 100}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'h-full rounded-full',
            accent === 'royal' ? 'bg-royal-400' : 'bg-gold-400',
          )}
        />
      </div>
    </motion.div>
  )
}
