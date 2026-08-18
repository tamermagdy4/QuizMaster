import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { categorySections, gameCategories } from '../../data/categories'
import { CATEGORIES_PER_TEAM, type TeamId } from '../../types/game'
import { cn } from '../../utils/cn'
import { useTranslation, presentCategory, presentSection } from '../../i18n/translations'
import { GlassInput } from '../ui/GlassInput'
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
  const [activeSection, setActiveSection] = useState<(typeof categorySections)[number]['id']>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const { english, t } = useTranslation()

  const full = activeTeam === 1 ? team1Count >= CATEGORIES_PER_TEAM : team2Count >= CATEGORIES_PER_TEAM

  const counts = useMemo(
    () =>
      gameCategories.reduce<Record<string, number>>((acc, category) => {
        acc[category.sectionId] = (acc[category.sectionId] ?? 0) + 1
        return acc
      }, {}),
    [],
  )

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase()
    return gameCategories.filter(
      (category) =>
        (activeSection === 'all' || category.sectionId === activeSection) &&
        (!needle ||
          category.title.toLowerCase().includes(needle) ||
          category.description.toLowerCase().includes(needle) ||
          presentCategory(category.id, category.title, true).toLowerCase().includes(needle)),
    )
  }, [activeSection, searchTerm])

  const selectedCount = team1Count + team2Count

  return (
    <section className={cn('stage-dark min-w-0 rounded-[18px] lg:rounded-[24px] border border-white/10 p-4 sm:p-6', className)}>
      {/* header — the world picker title */}
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">{t('stepsCategories')} 2</p>
          <h1 className="font-display mt-1 flex items-center gap-2.5 text-xl font-extrabold text-cream sm:text-2xl">
            <span className="text-teal-bright" aria-hidden>▦</span>
            {t('chooseCategories')}
          </h1>
          <p className="mt-1 text-xs text-cream/55 sm:text-sm">
            {english ? 'Choose 3 categories for each team' : 'اختر 3 فئات لكل فريق'}
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <GlassInput
            dark
            label=""
            placeholder={t('searchCategories')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-11 rounded-full pe-5"
          />
        </div>
      </div>

      {/* section filter — slim pills */}
      <div className="my-4 flex flex-wrap gap-1.5 sm:gap-2">
        {categorySections.map((section) => {
          const active = activeSection === section.id
          const count = section.id === 'all' ? gameCategories.length : counts[section.id] ?? 0
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition',
                active
                  ? 'border-gold/60 bg-gold/15 text-gold-bright shadow-[0_0_16px_rgba(201,162,39,0.2)]'
                  : 'border-white/12 bg-white/[0.04] text-cream/60 hover:border-white/25 hover:text-cream',
              )}
            >
              <span>{section.icon}</span>
              <span>{presentSection(section.id, section.title, english)}</span>
              <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10px]">{count}</span>
            </button>
          )
        })}
      </div>

      {/* the worlds — cinematic tiles, not cards */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-cream/55">
          {t('noCategories')}
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filtered.map((category, index) => {
            const owner = getCategoryOwner(category.id)
            return (
              <motion.div
                key={category.id}
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="min-w-0"
              >
                <CategoryCard
                  category={category}
                  owner={owner}
                  isSelectable={owner !== null || !full}
                  onToggle={() => onToggleCategory(category.id)}
                />
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* selection status — the match configuration bar */}
      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-teal/25 bg-teal/10 px-4 py-2.5 text-sm text-cream/80 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 leading-6">
          <span className="mt-0.5 text-teal-bright" aria-hidden>ℹ</span>
          {t('selectionHint')}
        </p>
        <div className="flex shrink-0 items-center gap-4 text-xs font-bold">
          <span className="text-cream/60">
            {t('selectedCategory')} <b className="text-gold-bright">{selectedCount} / 6</b>
          </span>
          <span className="text-cream/40">
            {t('availableCategory')} {Math.max(gameCategories.length - selectedCount, 0)}
          </span>
        </div>
      </div>
    </section>
  )
}
