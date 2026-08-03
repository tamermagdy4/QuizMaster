import { motion } from 'framer-motion'
import { gameCategories } from '../../data/categories'
import { CATEGORIES_PER_TEAM, type TeamId } from '../../types/game'
import { cn } from '../../utils/cn'
import { CategoryCard } from './CategoryCard'

interface CategoryGridProps {
  className?: string
  activeTeam: TeamId
  team1Count: number
  team2Count: number
  getCategoryOwner: (id: string) => TeamId | null
  onToggleCategory: (id: string) => void
}

export function CategoryGrid({
  className,
  activeTeam,
  team1Count,
  team2Count,
  getCategoryOwner,
  onToggleCategory,
}: CategoryGridProps) {
  const activeTeamFull =
    activeTeam === 1 ? team1Count >= CATEGORIES_PER_TEAM : team2Count >= CATEGORIES_PER_TEAM

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-xl font-bold text-white">اختر الفئات</h2>
        <p className="mt-1 text-sm text-white/60">
          {activeTeam === 1
            ? 'الفريق الأول يختار ٣ فئات'
            : 'الفريق الثاني يختار ٣ فئات'}
        </p>
      </div>

      <motion.div
        layout
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {gameCategories.map((category, index) => {
          const owner = getCategoryOwner(category.id)
          const isSelectable = owner !== null || !activeTeamFull

          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
            >
              <CategoryCard
                category={category}
                owner={owner}
                isSelectable={isSelectable}
                onToggle={() => onToggleCategory(category.id)}
              />
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
