import type { BoardCell } from '../../types/board'
import type { TeamId } from '../../types/game'
import { getCategoryById } from '../../utils/categories'
import { CategoryPanel } from './CategoryPanel'

interface CategoryBoardProps {
  categoryIds: string[]
  cells: BoardCell[][]
  currentTurn: TeamId
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  onSelectCell: (categoryId: string, slotIndex: number) => void
  /** Free-for-all: marks the viewing player's own used cells. */
  isCellUsed?: (categoryId: string, slotIndex: number) => boolean
}

/**
 * The arena — 6 category panels arranged 3 × 2 on desktop, 2 × 3 on
 * tablets, 1 column on phones. Team 1 owns the left lane, team 2 the
 * right lane; the active lane is highlighted.
 */
export function CategoryBoard({
  categoryIds,
  cells,
  currentTurn,
  isCellPlayable,
  onSelectCell,
  isCellUsed,
}: CategoryBoardProps) {
  const activeSide: 'left' | 'right' = currentTurn === 1 ? 'left' : 'right'

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-3 lg:grid-rows-2 lg:gap-3">
      {categoryIds.map((categoryId, index) => {
        const category = getCategoryById(categoryId)
        if (!category) return null

        const categoryCells = cells[index] ?? []
        // Left lane = the first three slots (500/300/100 descending),
        // right lane = the last three (100/300/500 ascending) — mirrored.
        const leftCells = categoryCells.slice(0, 3)
        const rightCells = categoryCells.slice(3, 6)

        return (
          <CategoryPanel
            key={categoryId}
            category={category}
            index={index}
            leftCells={leftCells}
            rightCells={rightCells}
            isCellPlayable={isCellPlayable}
            onSelectCell={onSelectCell}
            isCellUsed={isCellUsed}
            activeSide={activeSide}
          />
        )
      })}
    </div>
  )
}
