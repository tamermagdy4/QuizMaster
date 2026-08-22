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
      lamp: 'bg-[#60a5fa]',
      lampGlow: 'group-hover:shadow-[0_0_10px_rgba(96,165,250,0.7)]',
      surface: 'from-[#1e293b] via-[#141f2d] to-[#0f172a]',
      border: 'border-[#334155]/60',
      hoverBorder: 'hover:border-[#c69c46]',
      numGradient: 'from-[#ffffff] via-[#f1f5f9] to-[#cbd5e1]',
      labelBg: 'bg-sky-950/80 border border-sky-500/30',
      labelText: 'text-sky-300',
      glow: 'hover:shadow-[0_0_20px_rgba(198,156,70,0.2),0_8px_18px_rgba(0,0,0,0.5)]',
    }
  }
  if (points <= 300) {
    return {
      label: 'متوسط',
      lamp: 'bg-[#fbbf24]',
      lampGlow: 'group-hover:shadow-[0_0_10px_rgba(251,191,36,0.7)]',
      surface: 'from-[#1e293b] via-[#182333] to-[#0f172a]',
      border: 'border-[#334155]/60',
      hoverBorder: 'hover:border-[#c69c46]',
      numGradient: 'from-[#fef08a] via-[#e4c478] to-[#c69c46]',
      labelBg: 'bg-amber-950/80 border border-amber-500/30',
      labelText: 'text-amber-300',
      glow: 'hover:shadow-[0_0_20px_rgba(198,156,70,0.3),0_8px_18px_rgba(0,0,0,0.5)]',
    }
  }
  return {
    label: 'صعب',
    lamp: 'bg-[#f87171]',
    lampGlow: 'group-hover:shadow-[0_0_10px_rgba(248,113,113,0.7)]',
    surface: 'from-[#2a1d2e] via-[#1b1424] to-[#120d18]',
    border: 'border-[#47304f]/60',
    hoverBorder: 'hover:border-[#e4c478]',
    numGradient: 'from-[#fef3c7] via-[#fbbf24] to-[#f97316]',
    labelBg: 'bg-rose-950/80 border border-rose-500/30',
    labelText: 'text-rose-300',
    glow: 'hover:shadow-[0_0_20px_rgba(228,196,120,0.3),0_8px_18px_rgba(0,0,0,0.5)]',
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
          ? 'cursor-not-allowed border-white/[0.07] bg-[#0b1017] opacity-35 saturate-[0.2] shadow-none'
          : isPlayable
            ? cn(
                'cursor-pointer bg-gradient-to-b',
                tier.surface,
                tier.border,
                tier.hoverBorder,
                tier.glow,
              )
            : partial
              ? 'cursor-not-allowed border-white/15 bg-[#121c2a] opacity-65 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_0_rgba(5,10,18,0.8)]'
              : 'cursor-not-allowed border-white/[0.07] bg-[#0b1017] opacity-35 shadow-none',
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
        'h-[6px] w-[6px] rounded-full border border-[#0b1017]',
        played
          ? team === 1
            ? 'bg-[#4d79a7] shadow-[0_0_6px_rgba(77,121,167,0.8)]'
            : 'bg-[#b04d49] shadow-[0_0_6px_rgba(176,77,73,0.8)]'
          : 'bg-white/15',
      )}
    />
  )
}
