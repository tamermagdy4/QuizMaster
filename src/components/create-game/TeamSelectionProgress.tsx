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
      <div className="dark-card p-3 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-gold-bright">مؤشر اختيار الفئات</h3>
          <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-cream/60">3 / 3 لكل فريق</span>
        </div>

        <div className="space-y-3">
          <TeamRow
            teamLabel={team1Name.trim() || 'الفريق الأول'}
            count={team1Count}
            isActive={activeTeam === 1}
            accent="teal"
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
  accent: 'teal' | 'gold'
}

function TeamRow({ teamLabel, count, isActive, accent }: TeamRowProps) {
  const complete = count === CATEGORIES_PER_TEAM
  const percent = (count / CATEGORIES_PER_TEAM) * 100
  const accentText = accent === 'teal' ? 'text-teal-bright' : 'text-gold-bright'
  const accentBar = accent === 'teal' ? 'bg-teal-bright' : 'bg-gold-bright'
  const accentDot = accent === 'teal' ? 'bg-teal' : 'bg-gold'

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border-2 px-4 py-3 transition-all duration-200',
        isActive
          ? accent === 'teal'
            ? 'border-teal/60 bg-teal/10 shadow-[0_0_22px_rgba(47,125,126,0.2)]'
            : 'border-gold/60 bg-gold/10 shadow-[0_0_22px_rgba(201,162,39,0.2)]'
          : 'border-white/10 bg-[#0B1526]/60',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', accentDot)} />
          <span className="font-bold text-cream">{teamLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold-bright"
            >
              دور الاختيار
            </motion.span>
          )}
          {complete && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-green/15 px-2 py-0.5 text-[11px] font-bold text-green-bright"
            >
              مكتمل
            </motion.span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-cream/50">المختار:</span>
        <span className={cn('font-black tabular-nums', complete ? 'text-green-bright' : isActive ? accentText : 'text-cream/50')}>
          {count} / {CATEGORIES_PER_TEAM}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn('h-full rounded-full', accentBar)}
        />
      </div>
    </motion.div>
  )
}
