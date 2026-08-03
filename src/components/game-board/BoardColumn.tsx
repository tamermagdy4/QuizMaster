import { motion } from 'framer-motion'
import type { BoardCell } from '../../types/board'
import type { GameCategory } from '../../types/game'
import { cn } from '../../utils/cn'
import { PointButton } from './PointButton'

interface BoardColumnProps {
  category: GameCategory
  cells: BoardCell[]
  columnIndex: number
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  onSelectCell: (categoryId: string, slotIndex: number) => void
}

export function BoardColumn({
  category,
  cells,
  columnIndex,
  isCellPlayable,
  onSelectCell,
}: BoardColumnProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: columnIndex * 0.06, duration: 0.35 }}
      className="flex min-w-[120px] flex-1 flex-col gap-2 sm:min-w-[130px]"
    >
      <div
        className={cn(
          'glass-panel-strong flex min-h-[72px] flex-col items-center justify-center rounded-xl px-2 py-3 text-center',
        )}
      >
        <span className="mb-1 text-xl" aria-hidden>
          {category.icon}
        </span>
        <h3 className="text-sm font-bold leading-tight text-white">{category.title}</h3>
      </div>

      <div className="flex flex-col gap-2">
        {cells.map((cell) => (
          <PointButton
            key={`${cell.categoryId}-${cell.slotIndex}`}
            points={cell.points}
            team1Played={cell.team1Played}
            team2Played={cell.team2Played}
            isPlayable={isCellPlayable(cell.categoryId, cell.slotIndex)}
            onClick={() => onSelectCell(cell.categoryId, cell.slotIndex)}
          />
        ))}
      </div>
    </motion.div>
  )
}
