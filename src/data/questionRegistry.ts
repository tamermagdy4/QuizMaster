import { gameCategories } from './categories'

export interface CategoryQuestionSource {
  categoryId: string
  questionFile: string
}

export const categoryQuestionSources: CategoryQuestionSource[] = gameCategories.map((category) => ({
  categoryId: category.id,
  questionFile: `./questions/${category.sectionId}/${category.id}.json`,
}))

export function getQuestionSource(categoryId: string): CategoryQuestionSource | undefined {
  return categoryQuestionSources.find((item) => item.categoryId === categoryId)
}
