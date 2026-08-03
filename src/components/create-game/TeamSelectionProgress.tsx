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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">مؤشر اختيار الفئات</h3>
          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-white/70">3 / 3 لكل فريق</span>
        </div>

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
      </div>
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
  const percent = (count / CATEGORIES_PER_TEAM) * 100

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border px-4 py-3 transition-all duration-200',
        isActive
          ? accent === 'royal'
            ? 'border-royal-400/50 bg-royal-500/15 shadow-[0_0_30px_rgba(107,77,255,0.15)]'
            : 'border-gold-400/50 bg-gold-400/10 shadow-[0_0_30px_rgba(245,200,66,0.12)]'
          : 'border-white/10 bg-white/5',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-white/75" />
          <span className="font-semibold text-white">{teamLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white/80"
            >
              دور الاختيار
            </motion.span>
          )}
          {complete && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-teal-400/20 px-2 py-0.5 text-[11px] text-teal-300"
            >
              مكتمل
            </motion.span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-white/65">المختار:</span>
        <span
          className={cn(
            'font-bold tabular-nums',
            complete ? 'text-teal-300' : isActive ? 'text-gold-400' : 'text-white/70',
          )}
        >
          {count} / {CATEGORIES_PER_TEAM}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
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
