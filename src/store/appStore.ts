import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Direction } from '../types'
import type { LifelineId } from '../types/board'

type Language = 'ar' | 'en'

interface AppState {
  language: Language
  direction: Direction
  soundEnabled: boolean
  questionDuration: 15 | 20 | 30 | 45 | 60
  enabledLifelines: LifelineId[]
  theme: 'premium' | 'light'
  animationsEnabled: boolean
  setLanguage: (language: Language) => void
  setDirection: (direction: Direction) => void
  toggleDirection: () => void
  setSoundEnabled: (enabled: boolean) => void
  setQuestionDuration: (duration: AppState['questionDuration']) => void
  toggleLifelineAvailability: (lifelineId: LifelineId) => void
  setTheme: (theme: AppState['theme']) => void
  setAnimationsEnabled: (enabled: boolean) => void
  resetAppSettings: () => void
}

const defaultAppSettings = {
  language: 'ar' as Language,
  direction: 'rtl' as Direction,
  soundEnabled: true,
  questionDuration: 30 as const,
  enabledLifelines: ['double', 'two-answers', 'block', 'call', 'wheel'] as LifelineId[],
  theme: 'premium' as const,
  animationsEnabled: true,
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...defaultAppSettings,
      setLanguage: (language) => set({ language, direction: language === 'ar' ? 'rtl' : 'ltr' }),
      setDirection: (direction) => set({ direction, language: direction === 'rtl' ? 'ar' : 'en' }),
      toggleDirection: () =>
        set((state) => {
          const direction = state.direction === 'rtl' ? 'ltr' : 'rtl'
          return { direction, language: direction === 'rtl' ? 'ar' : 'en' }
        }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setQuestionDuration: (questionDuration) => set({ questionDuration }),
      toggleLifelineAvailability: (lifelineId) => set((state) => ({
        enabledLifelines: state.enabledLifelines.includes(lifelineId)
          ? state.enabledLifelines.filter((id) => id !== lifelineId)
          : [...state.enabledLifelines, lifelineId],
      })),
      setTheme: (theme) => set({ theme }),
      setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
      resetAppSettings: () => set(defaultAppSettings),
    }),
    {
      name: 'quizmaster-app-settings',
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AppState>
        const direction = persisted.direction ?? currentState.direction
        const language = persisted.language ?? (direction === 'rtl' ? 'ar' : 'en')

        return {
          ...currentState,
          ...persisted,
          direction,
          language,
        }
      },
    },
  ),
)
