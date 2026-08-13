import { gameCategories } from '../data/categories'
import type { GameCategory } from '../types/game'

export function getCategoryById(id: string): GameCategory {
  const found = gameCategories.find((category) => category.id === id)
  if (found) return found

  return {
    id,
    title: id,
    description: '',
    gradient: 'from-purple-600/70 via-indigo-600/50 to-blue-900/70',
    accent: '#8b5cf6',
    icon: '🎯',
    image: '🎯',
    questionCount: 30,
    difficulty: 'medium',
    sectionId: 'general',
  }
}

export function getCategoriesByIds(ids: string[]): GameCategory[] {
  return ids.map((id) => getCategoryById(id))
}
