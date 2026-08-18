import { motion } from 'framer-motion'
import type { GameCategory, TeamId } from '../../types/game'
import { getCategoryAsset } from '../../data/categoryAssets'
import { cn } from '../../utils/cn'
import { useTranslation, presentCategory } from '../../i18n/translations'

interface CategoryCardProps {
  category: GameCategory
  owner: TeamId | null
  isSelectable: boolean
  onToggle: () => void
}

export function CategoryCard({ category, owner, isSelectable, onToggle }: CategoryCardProps) {
  const { english, t } = useTranslation()
  const selected = owner !== null
  const disabled = !selected && !isSelectable
  const assetUrl = getCategoryAsset(category.id)

  return (
    <motion.button
      type="button"
      layout
      whileHover={disabled ? undefined : { y: -5, scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'group relative flex min-h-32 sm:min-h-44 w-full flex-col overflow-hidden rounded-xl text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/70',
        selected
          ? owner === 1
            ? 'ring-2 ring-teal/80 shadow-[0_0_34px_rgba(47,125,126,0.35)]'
            : 'ring-2 ring-gold/80 shadow-[0_0_34px_rgba(201,162,39,0.3)]'
          : disabled
            ? 'cursor-not-allowed opacity-40 saturate-[0.4]'
            : 'cursor-pointer shadow-[0_14px_34px_rgba(0,0,0,0.4)] hover:shadow-[0_20px_48px_rgba(0,0,0,0.55)]',
      )}
    >
      {/* image world — the environment of the category */}
      <div className="absolute inset-0">
        {assetUrl ? (
          <img
            src={assetUrl}
            alt=""
            aria-hidden
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#15263A] to-[#0B1526] text-6xl">
            {category.icon}
          </div>
        )}
        {/* cinematic scrim — deep at the bottom so the title stays readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#02060B] via-[#02060B]/80 via-35% to-transparent" />
        {/* selected atmosphere tint */}
        {selected && (
          <div
            className="absolute inset-0"
            style={{
              background:
                owner === 1
                  ? 'radial-gradient(80% 60% at 50% 110%, rgba(47,125,126,0.28), transparent 65%)'
                  : 'radial-gradient(80% 60% at 50% 110%, rgba(201,162,39,0.26), transparent 65%)',
            }}
          />
        )}
      </div>

      {/* gold top edge on hover */}
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-gold/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* team badge */}
      {selected && (
        <span
          className={cn(
            'absolute start-3 top-3 z-10 rounded-full px-3 py-1 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.45)]',
            owner === 1 ? 'bg-teal' : 'bg-gold',
          )}
        >
          {owner === 1 ? `${t('teamOne')} ✓` : `${t('teamTwo')} ✓`}
        </span>
      )}

      {/* title — solid readable panel over the image */}
      <div className="relative z-10 mt-auto px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm sm:rounded-xl sm:px-3.5 sm:py-2.5">
          <h3 className="font-display text-sm font-extrabold leading-snug text-white sm:text-base">
            {presentCategory(category.id, category.title, english)}
          </h3>
          <span className="mt-0.5 block text-[10px] font-bold text-cream/75 sm:text-[11px]">
            {category.questionCount
              ? `${category.questionCount} ${english ? 'questions' : 'سؤال'}`
              : english
                ? 'Ready to play'
                : 'جاهز للعب'}
          </span>
        </div>
      </div>
    </motion.button>
  )
}
