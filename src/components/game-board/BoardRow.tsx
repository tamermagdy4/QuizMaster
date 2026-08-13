import { motion } from 'framer-motion'
import type { BoardCell } from '../../types/board'
import type { GameCategory } from '../../types/game'
import { getCategoryAsset } from '../../data/categoryAssets'
import { PointButton } from './PointButton'

interface BoardRowProps {
  category: GameCategory
  leftCells: BoardCell[]
  rightCells: BoardCell[]
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  onSelectCell: (categoryId: string, slotIndex: number) => void
}

export function BoardRow({
  category,
  leftCells,
  rightCells,
  isCellPlayable,
  onSelectCell,
}: BoardRowProps) {
  const assetUrl = getCategoryAsset(category.id)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(150px,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2"
    >
      {leftCells.map((cell) => (
        <PointButton
          key={`${cell.categoryId}-${cell.slotIndex}`}
          points={cell.points}
          team1Played={cell.team1Played}
          team2Played={cell.team2Played}
          isPlayable={isCellPlayable(cell.categoryId, cell.slotIndex)}
          onClick={() => onSelectCell(cell.categoryId, cell.slotIndex)}
        />
      ))}

      <div className="flex h-[76px] items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-[#D4A843]/50 bg-gradient-to-br from-[#172238] via-[#0B1220] to-[#070B15] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:border-[#D4A843]/80 hover:shadow-[0_0_24px_rgba(212,168,67,0.28)]">
        {assetUrl ? (
          <img src={assetUrl} alt={category.title} className="h-11 w-11 rounded-xl object-cover shadow-lg ring-1 ring-[#D4A843]/30" />
        ) : (
          <span className="text-3xl" aria-hidden>{category.icon}</span>
        )}
        <span className="text-sm font-black text-[#F5D98B] whitespace-nowrap drop-shadow-sm">{category.title}</span>
      </div>

      {rightCells.map((cell) => (
        <PointButton
          key={`${cell.categoryId}-${cell.slotIndex}`}
          points={cell.points}
          team1Played={cell.team1Played}
          team2Played={cell.team2Played}
          isPlayable={isCellPlayable(cell.categoryId, cell.slotIndex)}
          onClick={() => onSelectCell(cell.categoryId, cell.slotIndex)}
        />
      ))}
    </motion.div>
  )
}
