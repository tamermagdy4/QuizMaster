import { BoardColumn } from './BoardColumn'
import { getCategoriesByIds } from '../../utils/categories'
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
  const categories = getCategoriesByIds(categoryIds)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3 sm:gap-4">
        {categories.map((category, index) => (
          <BoardColumn
            key={category.id}
            category={category}
            cells={cells[index] ?? []}
            columnIndex={index}
            isCellPlayable={isCellPlayable}
            onSelectCell={onSelectCell}
          />
        ))}
      </div>
    </div>
  )
}
