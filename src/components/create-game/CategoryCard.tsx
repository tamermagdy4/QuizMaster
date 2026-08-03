import { motion } from 'framer-motion'
import { getCategoryAsset } from '../../data/categoryAssets'
import { getQuestionEntries } from '../../data/questionLoader'
import type { GameCategory, TeamId } from '../../types/game'
import { cn } from '../../utils/cn'

interface CategoryCardProps {
  category: GameCategory
  owner: TeamId | null
  isSelectable: boolean
  onToggle: () => void
}

const difficultyMap = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
} as const

export function CategoryCard({ category, owner, isSelectable, onToggle }: CategoryCardProps) {
  const isSelected = owner !== null
  const disabled = !isSelected && !isSelectable
  const actualQuestionCount = getQuestionEntries(category.id).length
  const assetUrl = getCategoryAsset(category.id)

  return (
    <motion.button
      type="button"
      layout
      whileHover={disabled ? undefined : { y: -4, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-3xl border text-start transition duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
        isSelected
          ? owner === 1
            ? 'border-royal-400/60 shadow-glow-royal'
            : 'border-gold-400/60 shadow-glow-gold'
          : disabled
            ? 'cursor-not-allowed border-white/8 opacity-50'
            : 'cursor-pointer border-white/15 hover:border-white/30 hover:bg-white/5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.28)]',
      )}
    >
      <div
        className={cn(
          'relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br',
          category.gradient,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.3),transparent_45%)]" />
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-black/25 blur-2xl" />

        {assetUrl ? (
          <img
            src={assetUrl}
            alt={category.title}
            className="relative h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-black/25 text-4xl backdrop-blur-md transition duration-200 group-hover:scale-110 group-hover:rotate-3" aria-hidden>
            {category.icon}
          </span>
        )}

        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm transition duration-200 group-hover:bg-black/45">
            📝 {actualQuestionCount} سؤالًا
          </span>

          <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm transition duration-200 group-hover:bg-black/45">
            {difficultyMap[category.difficulty]}
          </span>
        </div>

        {isSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              'absolute start-3 bottom-3 rounded-full px-2.5 py-1 text-xs font-bold text-midnight-950',
              owner === 1 ? 'bg-royal-400' : 'bg-gold-400',
            )}
          >
            {owner === 1 ? 'فريق ١' : 'فريق ٢'}
          </motion.span>
        )}
      </div>

      <div
        className={cn(
          'glass-panel flex flex-1 flex-col gap-2 rounded-none border-0 border-t p-4 transition duration-200',
          isSelected && 'bg-white/10',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-white">{category.title}</h3>
          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-white/70">
            {category.icon}
          </span>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-white/60">
          {category.description}
        </p>

        <div className="mt-auto flex items-center justify-between text-[11px] text-white/55">
          <span>{actualQuestionCount} أسئلة متاحة</span>
          <span>{disabled ? 'غير متاح' : 'متاح للاختيار'}</span>
        </div>
      </div>
    </motion.button>
  )
}
