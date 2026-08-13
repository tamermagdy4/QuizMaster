import type { PointValue } from '../types/board'
import type { AdminQuestion } from './adminData'

const STORAGE_KEY = 'quizmaster-admin-question-overrides'

type StoredState = {
  upserts: AdminQuestion[]
  deletedIds: string[]
}

const emptyState: StoredState = { upserts: [], deletedIds: [] }

function readState(): StoredState {
  if (typeof window === 'undefined') return emptyState
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<StoredState>
    return {
      upserts: Array.isArray(parsed.upserts) ? parsed.upserts : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds.filter((id): id is string => typeof id === 'string') : [],
    }
  } catch {
    return emptyState
  }
}

function writeState(state: StoredState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function getAdminQuestionOverrides(): StoredState {
  return readState()
}

export function createAdminQuestion(input: Omit<AdminQuestion, 'id' | 'categoryTitle'> & { categoryTitle: string }): AdminQuestion {
  const state = readState()
  const question: AdminQuestion = {
    ...input,
    id: `${input.categoryId}-${input.points}-admin-${Date.now()}`,
  }
  writeState({
    upserts: [...state.upserts, question],
    deletedIds: state.deletedIds.filter((id) => id !== question.id),
  })
  return question
}

export function updateAdminQuestion(question: AdminQuestion) {
  const state = readState()
  writeState({
    upserts: [...state.upserts.filter((item) => item.id !== question.id), question],
    deletedIds: state.deletedIds.filter((id) => id !== question.id),
  })
}

export function deleteAdminQuestion(id: string) {
  const state = readState()
  writeState({
    upserts: state.upserts.filter((item) => item.id !== id),
    deletedIds: state.deletedIds.includes(id) ? state.deletedIds : [...state.deletedIds, id],
  })
}

export function clearAdminQuestionOverrides() {
  window.localStorage.removeItem(STORAGE_KEY)
}

export function isAdminPointValue(value: number): value is PointValue {
  return value === 100 || value === 300 || value === 500
}
