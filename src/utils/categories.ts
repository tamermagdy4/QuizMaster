import { gameCategories } from '../data/categories'
import type { GameCategory } from '../types/game'

export function getCategoryById(id: string): GameCategory | undefined {
  return gameCategories.find((category) => category.id === id)
}

export function getCategoriesByIds(ids: string[]): GameCategory[] {
  return ids
    .map((id) => getCategoryById(id))
    .filter((category): category is GameCategory => category !== undefined)
}
