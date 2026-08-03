import { motion } from 'framer-motion'
import type { TeamId } from '../../types/game'
import { cn } from '../../utils/cn'

interface PointButtonProps {
  points: number
  team1Played: boolean
  team2Played: boolean
  isPlayable: boolean
  onClick: () => void
}

export function PointButton({
  points,
  team1Played,
  team2Played,
  isPlayable,
  onClick,
}: PointButtonProps) {
  const completed = team1Played && team2Played
  const partial = team1Played || team2Played

  return (
    <motion.button
      type="button"
      disabled={!isPlayable}
      whileHover={isPlayable ? { scale: 1.05, y: -2 } : undefined}
      whileTap={isPlayable ? { scale: 0.95 } : undefined}
      onClick={onClick}
      className={cn(
        'relative flex h-14 w-full items-center justify-center rounded-xl border text-lg font-bold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
        completed
          ? 'cursor-not-allowed border-white/8 bg-white/5 text-white/25 line-through'
          : isPlayable
            ? 'glass-button cursor-pointer border-gold-400/30 text-gold-400'
            : partial
              ? 'cursor-not-allowed border-white/15 bg-white/8 text-white/50'
              : 'cursor-not-allowed border-white/10 bg-white/5 text-white/35',
      )}
    >
      {completed ? '✓' : points}

      {partial && !completed && (
        <span className="absolute -top-1.5 end-1.5 flex gap-0.5">
          <TeamDot team={1} played={team1Played} />
          <TeamDot team={2} played={team2Played} />
        </span>
      )}
    </motion.button>
  )
}

function TeamDot({ team, played }: { team: TeamId; played: boolean }) {
  return (
    <span
      className={cn(
        'h-2 w-2 rounded-full border',
        played
          ? team === 1
            ? 'border-royal-400 bg-royal-400'
            : 'border-gold-400 bg-gold-400'
          : 'border-white/20 bg-transparent',
      )}
    />
  )
}
