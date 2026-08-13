import type { GameCategory } from '../types/game'
import { hasQuestionEntries } from './questionLoader'

type SectionDefinition = {
  id: string
  title: string
  icon: string
}

type SectionModule = {
  sectionMeta?: SectionDefinition
  [key: string]: unknown
}

const sectionModules = import.meta.glob('./sections/*.ts', {
  eager: true,
}) as Record<string, SectionModule>

const sectionMap = new Map<string, SectionDefinition>()
const discoveredCategories: GameCategory[] = []

for (const module of Object.values(sectionModules)) {
  const sectionMeta = module.sectionMeta

  if (sectionMeta?.id) {
    sectionMap.set(sectionMeta.id, sectionMeta)
  }

  for (const value of Object.values(module)) {
    if (!Array.isArray(value)) {
      continue
    }

    discoveredCategories.push(
      ...value.filter((item): item is GameCategory => Boolean(item && typeof item === 'object' && 'id' in item)),
    )
  }
}

const orderedSectionDefinitions = Array.from(sectionMap.values())
const sectionOrder = new Map(orderedSectionDefinitions.map((section, index) => [section.id, index]))

const hiddenCategoryIds = new Set(['who-am-i-general', 'cars', 'currency-country', 'who-is-character', 'mohamed-salah'])

const orderedCategories = [...discoveredCategories]
  .filter((category) => hasQuestionEntries(category.id) && !hiddenCategoryIds.has(category.id))
  .sort((left, right) => {
    const leftIndex = sectionOrder.get(left.sectionId) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = sectionOrder.get(right.sectionId) ?? Number.MAX_SAFE_INTEGER

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    return left.title.localeCompare(right.title)
  })

export const categorySections = [
  {
    id: 'all',
    title: 'الكل',
    icon: '✨',
  },
  ...orderedSectionDefinitions,
] as const

export const gameCategories: GameCategory[] = orderedCategories
