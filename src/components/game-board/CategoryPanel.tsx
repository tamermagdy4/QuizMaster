import { motion } from 'framer-motion'
import type { BoardCell } from '../../types/board'
import type { GameCategory } from '../../types/game'
import { getCategoryAsset } from '../../data/categoryAssets'
import { PointButton } from './PointButton'
import { cn } from '../../utils/cn'
import { useTranslation, presentCategory } from '../../i18n/translations'

interface CategoryPanelProps {
  category: GameCategory
  index: number
  leftCells: BoardCell[]
  rightCells: BoardCell[]
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  onSelectCell: (categoryId: string, slotIndex: number) => void
  /** Free-for-all: marks the viewing player's own used cells. */
  isCellUsed?: (categoryId: string, slotIndex: number) => boolean
  /** Which side of the arena the current team plays on. */
  activeSide?: 'left' | 'right'
}

/**
 * One category of the arena — a vertical game-show panel:
 *
 * ┌──────────────────────────┐
 * │      كرة القدم (title)    │
 * ├──────┬───────────┬───────┤
 * │ 500  │           │ 500   │
 * │ 300  │   IMAGE   │ 300   │
 * │ 100  │           │ 100   │
 * └──────┴───────────┴───────┘
 *
 * The artwork fills the central lane; point pills sit on both sides.
 */
export function CategoryPanel({
  category,
  index,
  leftCells,
  rightCells,
  isCellPlayable,
  onSelectCell,
  isCellUsed,
  activeSide,
}: CategoryPanelProps) {
  const { english } = useTranslation()
  const assetUrl = getCategoryAsset(category.id)
  const title = presentCategory(category.id, category.title, english)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
        ease: [0.25, 1, 0.5, 1],
      }}
      role="group"
      aria-label={title}
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-gradient-to-b from-[#0e2030] to-[#08121d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_14px_34px_rgba(0,0,0,0.45)] transition-colors duration-300 sm:rounded-2xl',
        'border-[#1E293B] hover:border-[#D4A843]/40',
      )}
    >
      {/* Gold top edge */}
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#D4A843]/70 to-transparent" />

      {/* Category title bar — always readable */}
      <div className="relative z-10 flex shrink-0 items-center justify-center gap-1 border-b border-white/10 bg-[#050b13]/80 px-2 py-1.5 backdrop-blur-sm sm:gap-2 sm:py-2">
        <span className="text-xs leading-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] sm:text-base" aria-hidden>
          {category.icon}
        </span>
        <h3
          title={title}
          className="font-display min-w-0 text-center text-[11px] font-extrabold leading-tight text-white line-clamp-2 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] sm:text-sm sm:line-clamp-1 lg:text-base"
        >
          {title}
        </h3>
      </div>

      {/*
       * Body. Desktop/tablet (sm+): the classic 3-lane arena —
       *   [points | artwork | points]
       * Phones (< sm): a compact two-column layout — the artwork becomes a
       * full-width banner on top, then both point lanes sit side-by-side
       * below it. The `order-*` classes re-arrange the same three DOM nodes
       * for each breakpoint (no duplicated markup).
       */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 p-1 sm:grid-cols-[1fr_1.6fr_1fr] sm:grid-rows-1 sm:items-stretch sm:gap-1.5 sm:p-1.5">
        {/* Left lane (team 1 side) — phones: second grid column; sm+: first */}
        <div className="order-2 flex min-h-0 flex-col justify-center gap-1 sm:order-1 sm:gap-2">
          {leftCells.map((cell) => (
            <PointButton
              key={`${cell.categoryId}-${cell.slotIndex}`}
              points={cell.points}
              team1Played={cell.team1Played}
              team2Played={cell.team2Played}
              isPlayable={isCellPlayable(cell.categoryId, cell.slotIndex)}
              used={isCellUsed?.(cell.categoryId, cell.slotIndex)}
              activeSide={activeSide === 'left'}
              onClick={() => onSelectCell(cell.categoryId, cell.slotIndex)}
            />
          ))}
        </div>

        {/* Central artwork — phones: full-width banner; sm+: center lane */}
        <div className="relative order-1 col-span-2 h-16 min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#050b13] sm:order-2 sm:col-span-1 sm:h-auto sm:flex-1 sm:rounded-xl">
          {assetUrl ? (
            <>
              <img
                src={assetUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* Scrim so the art recedes and the pills stay dominant */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060f17]/85 via-transparent to-[#060f17]/40" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#17324a] via-[#102433] to-[#060f17] text-xl sm:text-4xl">
              {category.icon}
            </div>
          )}
          {/* Center glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,rgba(47,125,126,0.12),transparent_70%)]" />
        </div>

        {/* Right lane (team 2 side) — phones: third grid column; sm+: last */}
        <div className="order-3 flex min-h-0 flex-col justify-center gap-1 sm:gap-2">
          {rightCells.map((cell) => (
            <PointButton
              key={`${cell.categoryId}-${cell.slotIndex}`}
              points={cell.points}
              team1Played={cell.team1Played}
              team2Played={cell.team2Played}
              isPlayable={isCellPlayable(cell.categoryId, cell.slotIndex)}
              used={isCellUsed?.(cell.categoryId, cell.slotIndex)}
              activeSide={activeSide === 'right'}
              onClick={() => onSelectCell(cell.categoryId, cell.slotIndex)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
