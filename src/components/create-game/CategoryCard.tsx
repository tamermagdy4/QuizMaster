import { motion } from 'framer-motion'
import type { GameCategory, TeamId } from '../../types/game'
import { cn } from '../../utils/cn'

interface CategoryCardProps {
  category: GameCategory
  owner: TeamId | null
  isSelectable: boolean
  onToggle: () => void
}

export function CategoryCard({ category, owner, isSelectable, onToggle }: CategoryCardProps) {
  const isSelected = owner !== null
  const disabled = !isSelected && !isSelectable

  return (
    <motion.button
      type="button"
      layout
      whileHover={disabled ? undefined : { y: -4, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border text-start transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
        isSelected
          ? owner === 1
            ? 'border-royal-400/60 shadow-glow-royal'
            : 'border-gold-400/60 shadow-glow-gold'
          : disabled
            ? 'cursor-not-allowed border-white/8 opacity-50'
            : 'cursor-pointer border-white/15 hover:border-white/30',
      )}
    >
      <div
        className={cn(
          'relative flex h-32 items-center justify-center bg-gradient-to-br',
          category.gradient,
        )}
      >
        <div className="absolute inset-0 bg-black/20" />
        <span className="relative text-5xl drop-shadow-lg" aria-hidden>
          {category.icon}
        </span>

        {isSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              'absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold text-midnight-950',
              owner === 1 ? 'bg-royal-400' : 'bg-gold-400',
            )}
          >
            {owner === 1 ? 'فريق ١' : 'فريق ٢'}
          </motion.span>
        )}
      </div>

      <div
        className={cn(
          'glass-panel flex flex-1 flex-col gap-1 rounded-none border-0 border-t p-4',
          isSelected && 'bg-white/10',
        )}
      >
        <h3 className="text-base font-bold text-white">{category.title}</h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-white/60">
          {category.description}
        </p>
      </div>
    </motion.button>
  )
}
