import { BoardRow } from './BoardRow'
import { getCategoryById } from '../../utils/categories'
import type { BoardCell } from '../../types/board'
import type { TeamId } from '../../types/game'

interface BoardGridProps {
  categoryIds: string[]
  cells: BoardCell[][]
  currentTurn: TeamId
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  onSelectCell: (categoryId: string, slotIndex: number) => void
}

export function BoardGrid({
  categoryIds,
  cells,
  isCellPlayable,
  onSelectCell,
}: BoardGridProps) {
  return (
    <div className="flex flex-col gap-3">
      {categoryIds.map((categoryId, index) => {
        const category = getCategoryById(categoryId)
        if (!category) return null

        const categoryCells = cells[index] ?? []
        const leftCells = categoryCells.slice(0, 3)
        const rightCells = categoryCells.slice(3, 6)

        return (
          <BoardRow
            key={categoryId}
            category={category}
            leftCells={leftCells}
            rightCells={rightCells}
            isCellPlayable={isCellPlayable}
            onSelectCell={onSelectCell}
          />
        )
      })}
    </div>
  )
}
