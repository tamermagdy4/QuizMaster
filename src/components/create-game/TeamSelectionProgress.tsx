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
      <div className="rounded-2xl border border-orange-200 bg-white/75 p-3 shadow-[0_8px_24px_rgba(140,90,40,0.1)] backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-orange-800">مؤشر اختيار الفئات</h3>
          <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">3 / 3 لكل فريق</span>
        </div>

        <div className="space-y-3">
          <TeamRow
            teamLabel={team1Name.trim() || 'الفريق الأول'}
            count={team1Count}
            isActive={activeTeam === 1}
            accent="sky"
          />
          <TeamRow
            teamLabel={team2Name.trim() || 'الفريق الثاني'}
            count={team2Count}
            isActive={activeTeam === 2}
            accent="rose"
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
  accent: 'sky' | 'rose'
}

function TeamRow({ teamLabel, count, isActive, accent }: TeamRowProps) {
  const complete = count === CATEGORIES_PER_TEAM
  const percent = (count / CATEGORIES_PER_TEAM) * 100

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border-2 px-4 py-3 transition-all duration-200',
        isActive
          ? accent === 'sky'
            ? 'border-sky-400 bg-sky-50 shadow-[0_0_24px_rgba(14,165,233,0.15)]'
            : 'border-rose-400 bg-rose-50 shadow-[0_0_24px_rgba(244,63,94,0.15)]'
          : 'border-orange-200 bg-white/70',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-2.5 w-2.5 rounded-full',
              accent === 'sky' ? 'bg-sky-500' : 'bg-rose-500',
            )}
          />
          <span className="font-bold text-orange-950">{teamLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700"
            >
              دور الاختيار
            </motion.span>
          )}
          {complete && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
            >
              مكتمل
            </motion.span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-orange-900/60">المختار:</span>
        <span
          className={cn(
            'font-black tabular-nums',
            complete ? 'text-emerald-600' : isActive ? 'text-orange-600' : 'text-orange-900/60',
          )}
        >
          {count} / {CATEGORIES_PER_TEAM}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-orange-100">
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'h-full rounded-full',
            accent === 'sky' ? 'bg-sky-500' : 'bg-rose-500',
          )}
        />
      </div>
    </motion.div>
  )
}
