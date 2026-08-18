import { motion } from 'framer-motion'
import type { TeamId } from '../../types/game'
import { cn } from '../../utils/cn'

interface PointButtonProps {
  points: number
  team1Played: boolean
  team2Played: boolean
  isPlayable: boolean
  onClick: () => void
  /** Free-for-all: this cell was already used by the viewing player. */
  used?: boolean
  /** Whether this cell sits on the current team's side of the arena. */
  activeSide?: boolean
}

/**
 * Game-show challenge pill.
 *
 * A wide, rounded, horizontal quiz button rather than a tall tile:
 *  • tiered identity — 100 = BLUE (easy), 300 = GREEN (medium), 500 = RED (hard)
 *  • a colored lamp dot that ignites on hover
 *  • embossed gradient number with subtle depth
 *  • press physics — small scale-down on click
 *
 * The point values and their order never change — only the look.
 */
function tileTier(points: number) {
  if (points <= 100) {
    return {
      label: 'سهل',
      lamp: 'bg-[#3b82f6]',
      lampGlow: 'group-hover:shadow-[0_0_12px_rgba(59,130,246,0.9)]',
      surface: 'from-[#1e4d78] via-[#17344f] to-[#0b1a2c]',
      border: 'border-[#3b82f6]/45',
      hoverBorder: 'hover:border-[#60a5fa]/90',
      numGradient: 'from-[#dbeafe] via-[#93c5fd] to-[#3b82f6]',
      labelBg: 'bg-[#3b82f6]/20',
      labelText: 'text-[#bfdbfe]',
      glow: 'hover:shadow-[0_0_22px_rgba(59,130,246,0.3),0_6px_14px_rgba(0,0,0,0.45)]',
    }
  }
  if (points <= 300) {
    return {
      label: 'متوسط',
      lamp: 'bg-[#22c55e]',
      lampGlow: 'group-hover:shadow-[0_0_12px_rgba(34,197,94,0.9)]',
      surface: 'from-[#1f6b4a] via-[#16452f] to-[#0b201a]',
      border: 'border-[#22c55e]/45',
      hoverBorder: 'hover:border-[#4ade80]/90',
      numGradient: 'from-[#dcfce7] via-[#86efac] to-[#22c55e]',
      labelBg: 'bg-[#22c55e]/20',
      labelText: 'text-[#bbf7d0]',
      glow: 'hover:shadow-[0_0_22px_rgba(34,197,94,0.3),0_6px_14px_rgba(0,0,0,0.45)]',
    }
  }
  return {
    label: 'صعب',
    lamp: 'bg-[#ef4444]',
    lampGlow: 'group-hover:shadow-[0_0_14px_rgba(239,68,68,0.95)]',
    surface: 'from-[#8f2f2b] via-[#5c201f] to-[#2a0f0e]',
    border: 'border-[#ef4444]/50',
    hoverBorder: 'hover:border-[#f87171]/95',
    numGradient: 'from-[#fee2e2] via-[#fca5a5] to-[#ef4444]',
    labelBg: 'bg-[#ef4444]/20',
    labelText: 'text-[#fecaca]',
    glow: 'hover:shadow-[0_0_26px_rgba(239,68,68,0.4),0_6px_14px_rgba(0,0,0,0.5)]',
  }
}

export function PointButton({
  points,
  team1Played,
  team2Played,
  isPlayable,
  onClick,
  used = false,
  activeSide = false,
}: PointButtonProps) {
  const completed = used || (team1Played && team2Played)
  const partial = !used && (team1Played || team2Played)
  const tier = tileTier(points)

  return (
    <motion.button
      type="button"
      disabled={!isPlayable}
      whileHover={isPlayable ? { y: -2, scale: 1.03 } : undefined}
      whileTap={isPlayable ? { y: 1, scale: 0.95 } : undefined}
      onClick={onClick}
      aria-label={
        completed
          ? `${points} points — completed`
          : isPlayable
            ? `${points} points — available`
            : partial
              ? `${points} points — partially played`
              : `${points} points`
      }
      className={cn(
        // Wide horizontal pill: lamp dot + number + difficulty chip.
        // Phones (< sm) get a compact pill that fits the 2-column arena;
        // the difficulty chip is a color-coded luxury and only shows at sm+.
        'group relative flex h-11 w-full items-center justify-center gap-1 overflow-hidden rounded-full border px-1.5 transition-all duration-150 ease-out sm:h-10 sm:gap-2 sm:px-2.5',
        // Subtle depth
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-3px_6px_rgba(0,0,0,0.22),0_3px_0_rgba(5,10,18,0.85),0_8px_16px_rgba(0,0,0,0.4)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/60',
        completed
          ? 'cursor-not-allowed border-white/[0.07] bg-[#0a1622] opacity-35 saturate-[0.2] shadow-none'
          : isPlayable
            ? cn(
                'cursor-pointer bg-gradient-to-b',
                tier.surface,
                tier.border,
                tier.hoverBorder,
                tier.glow,
              )
            : partial
              ? 'cursor-not-allowed border-white/15 bg-[#0f1e2c] opacity-65 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_0_rgba(5,10,18,0.8)]'
              : 'cursor-not-allowed border-white/[0.07] bg-[#0a1622] opacity-35 shadow-none',
      )}
    >
      {/* Difficulty lamp dot */}
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-200 sm:h-2 sm:w-2',
          completed ? 'bg-white/15' : cn(tier.lamp, tier.lampGlow),
        )}
      />

      {/* Point value — embossed gradient number */}
      <span className={cn('score-number relative leading-none tabular-nums', completed ? 'text-white/20' : 'text-sm sm:text-lg')}>
        {completed ? (
          '✓'
        ) : (
          <span
            className={cn('bg-gradient-to-b bg-clip-text text-transparent', tier.numGradient)}
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}
          >
            {points}
          </span>
        )}
      </span>

      {/* Difficulty micro-caption — sm+ only (phones encode difficulty by color) */}
      <span
        className={cn(
          'relative z-10 hidden shrink-0 rounded-full px-1.5 py-[1px] text-[7px] font-black leading-none sm:inline-block sm:text-[8px]',
          completed ? 'bg-white/[0.07] text-white/20' : cn(tier.labelBg, tier.labelText),
        )}
      >
        {completed ? 'انتهت' : tier.label}
      </span>

      {/* Active-side halo — the current team's pills carry a faint pulse */}
      {activeSide && isPlayable && !completed && (
        <span aria-hidden className="pointer-events-none absolute -inset-px rounded-full border border-white/20" />
      )}

      {/* One-team partial indicator — team dots */}
      {partial && !completed && (
        <span className="absolute -top-1 start-1/2 z-10 flex -translate-x-1/2 gap-1">
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
        'h-[6px] w-[6px] rounded-full border border-[#0B1526]',
        played
          ? team === 1
            ? 'bg-[#3b82f6] shadow-[0_0_6px_rgba(59,130,246,0.8)]'
            : 'bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.8)]'
          : 'bg-white/15',
      )}
    />
  )
}
