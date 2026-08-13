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

function pointColor(points: number): { border: string; text: string; hover: string; glow: string; dot: string; label: string } {
  if (points <= 100) {
    return {
      border: 'border-[#16A34A]/60',
      text: 'text-[#4ADE80]',
      hover: 'hover:bg-[#16A34A]/10 hover:shadow-[0_0_20px_rgba(22,163,74,0.35)]',
      glow: 'shadow-[0_0_12px_rgba(22,163,74,0.25)]',
      dot: 'bg-[#4ADE80]',
      label: 'سهل',
    }
  }
  if (points <= 300) {
    return {
      border: 'border-[#2563EB]/60',
      text: 'text-[#60A5FA]',
      hover: 'hover:bg-[#2563EB]/10 hover:shadow-[0_0_20px_rgba(37,99,235,0.35)]',
      glow: 'shadow-[0_0_12px_rgba(37,99,235,0.25)]',
      dot: 'bg-[#60A5FA]',
      label: 'متوسط',
    }
  }
  return {
    border: 'border-[#DC2626]/60',
    text: 'text-[#F87171]',
    hover: 'hover:bg-[#DC2626]/10 hover:shadow-[0_0_20px_rgba(220,38,38,0.35)]',
    glow: 'shadow-[0_0_12px_rgba(220,38,38,0.25)]',
    dot: 'bg-[#F87171]',
    label: 'صعب',
  }
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
  const colors = pointColor(points)

  return (
    <motion.button
      type="button"
      disabled={!isPlayable}
      whileHover={isPlayable ? { scale: 1.04, y: -2 } : undefined}
      whileTap={isPlayable ? { scale: 0.95 } : undefined}
      onClick={onClick}
      className={cn(
        'relative flex h-16 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed bg-[#0B1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
        completed
          ? 'cursor-not-allowed border-gray-600/30 bg-[#0B1220]/60 text-gray-500 line-through opacity-75'
          : isPlayable
            ? cn('cursor-pointer', colors.border, colors.text, colors.hover, colors.glow)
            : partial
              ? 'cursor-not-allowed border-amber-500/40 bg-amber-900/10 text-amber-500/60 opacity-80'
              : 'cursor-not-allowed border-gray-600/20 bg-[#0B1220]/40 text-gray-600',
      )}
    >
      <span className="text-[10px] font-bold leading-none opacity-70">{colors.label}</span>
      <span className="text-xl font-black leading-tight">{completed ? '✓' : points}</span>

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
        'h-2 w-2 rounded-full border border-[#0B1220] shadow-sm',
        played
          ? team === 1
            ? 'bg-[#3B82F6]'
            : 'bg-[#EF4444]'
          : 'bg-gray-600',
      )}
    />
  )
}
