import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { categorySections, gameCategories } from '../../data/categories'
import { CATEGORIES_PER_TEAM, type TeamId } from '../../types/game'
import { cn } from '../../utils/cn'
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

  const activeTeamFull =
    activeTeam === 1 ? team1Count >= CATEGORIES_PER_TEAM : team2Count >= CATEGORIES_PER_TEAM

  const sectionCounts = useMemo(() => {
    return gameCategories.reduce(
      (counts, category) => {
        counts[category.sectionId] = (counts[category.sectionId] ?? 0) + 1
        return counts
      },
      {} as Record<string, number>,
    )
  }, [])

  const filteredCategories = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()

    return gameCategories.filter((category) => {
      const matchesSection = activeSection === 'all' || category.sectionId === activeSection
      const matchesSearch =
        normalized.length === 0 ||
        category.title.toLowerCase().includes(normalized) ||
        category.description.toLowerCase().includes(normalized)

      return matchesSection && matchesSearch
    })
  }, [activeSection, searchTerm])

  const selectedSectionTitle =
    activeSection === 'all'
      ? 'كل الأقسام'
      : categorySections.find((section) => section.id === activeSection)?.title ?? 'كل الأقسام'

  const activeTeamLabel = activeTeam === 1 ? 'الفريق الأول' : 'الفريق الثاني'

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">اختر الفئات</h2>
              <p className="mt-1 text-sm text-white/60">
                {activeTeam === 1
                  ? 'الفريق الأول يختار ٣ فئات'
                  : 'الفريق الثاني يختار ٣ فئات'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/70">
                {filteredCategories.length} فئة معروضة
              </div>
              <div className="rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1.5 text-xs font-semibold text-gold-100">
                {activeTeamLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
            {categorySections.map((section) => {
              const isActive = activeSection === section.id

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition duration-200',
                    isActive
                      ? 'border-gold-400/50 bg-gold-400/15 text-gold-100 shadow-[0_0_24px_rgba(245,200,66,0.15)]'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <span className="ms-1" aria-hidden>
                    {section.icon}
                  </span>
                  <span>{section.title}</span>
                  <span className="ms-1 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] text-white/80">
                    {section.id === 'all' ? gameCategories.length : sectionCounts[section.id] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <GlassInput
          label="بحث عن الفئة"
          placeholder="ابحث عن اسم الفئة أو وصفها"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
        <span>{filteredCategories.length} فئة متاحة</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-white/80">
          {selectedSectionTitle}
        </span>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-white/65 backdrop-blur-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-2xl">
            🔎
          </div>
          <p className="text-sm font-semibold text-white/80">لا توجد فئات مطابقة لبحثك الحالي.</p>
          <p className="mt-1 text-xs text-white/55">جرّب كلمة مختلفة أو اختر قسمًا آخر من الأعلى.</p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filteredCategories.map((category, index) => {
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
      )}
    </div>
  )
}
