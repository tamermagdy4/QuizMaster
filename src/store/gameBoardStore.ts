import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultLifelines } from '../data/lifelines'
import { getQuestionEntries, getQuestionEntriesByPoints, loadRemoteQuestions } from '../data/questionLoader'
import type { ActiveQuestion, BoardCell, Lifeline, LifelineId, PointValue } from '../types/board'
import { POINT_SLOTS, TOTAL_CATEGORIES } from '../types/board'
import type { TeamId } from '../types/game'
import { useGameSetupStore } from './gameSetupStore'
import { useAppStore } from './appStore'

interface GameBoardState {
  isInitialized: boolean
  gameName: string
  team1Name: string
  team2Name: string
  categoryIds: string[]
  cells: BoardCell[][]
  currentTurn: TeamId
  team1Score: number
  team2Score: number
  team1Lifelines: Lifeline[]
  team2Lifelines: Lifeline[]
  activeQuestion: ActiveQuestion | null
  usedQuestionKeys: string[]

  pendingDoublePoints: TeamId | null
  blockActive: TeamId | null
  callFriendActive: TeamId | null
  callFriendTimeLeft: number
  callFriendHint: string | null
  wheelBonus: { teamId: TeamId; points: number } | null
  answerSubmitted: boolean
  selectedAnswer: string | null
  answerCorrect: boolean | null
  answerPoints: number

  initializeBoard: () => Promise<void>
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  selectQuestion: (categoryId: string, slotIndex: number) => ActiveQuestion | null

  clearActiveQuestion: () => void
  getCell: (categoryId: string, slotIndex: number) => BoardCell | undefined
  switchTurn: () => void
  resolveQuestion: (winner: TeamId | null) => void
  selectAnswer: (answer: string) => void
  submitAnswer: (answer: string) => void
  finishSubmittedQuestion: () => void
  useLifeline: (lifelineId: LifelineId) => void
  clearCallFriend: () => void
  tickCallFriend: () => void
}

function buildCells(categoryIds: string[]): BoardCell[][] {
  return categoryIds.map((categoryId) =>
    POINT_SLOTS.map((points, slotIndex) => ({
      categoryId,
      slotIndex,
      points,
      team1Played: false,
      team2Played: false,
    })),
  )
}

function repairCategoryIds(rawCategoryIds: string[]): string[] {
  const seen = new Set<string>()
  const repaired: string[] = []

  if (Array.isArray(rawCategoryIds)) {
    for (const id of rawCategoryIds) {
      if (repaired.length >= TOTAL_CATEGORIES) break
      if (!id || typeof id !== 'string' || seen.has(id)) continue
      seen.add(id)
      repaired.push(id)
    }
  }

  if (repaired.length < TOTAL_CATEGORIES) {
    const fillerPool = [
      'general-knowledge',
      'football',
      'countries',
      'capitals',
      'flags',
      'history',
      'science',
      'technology',
      'movies',
      'sports',
    ]
    for (const id of fillerPool) {
      if (repaired.length >= TOTAL_CATEGORIES) break
      if (!id || seen.has(id)) continue
      seen.add(id)
      repaired.push(id)
    }
  }

  return repaired
}

function repairCells(categoryIds: string[], rawCells: BoardCell[][]): BoardCell[][] {
  return categoryIds.map((categoryId) => {
    const existingColumn = rawCells.find((column) => column[0]?.categoryId === categoryId)
    if (existingColumn && existingColumn.length === POINT_SLOTS.length) {
      return existingColumn
    }
    return POINT_SLOTS.map((points, slotIndex) => ({
      categoryId,
      slotIndex,
      points,
      team1Played: false,
      team2Played: false,
    }))
  })
}

function buildLifelinesFromIds(ids: LifelineId[]): Lifeline[] {
  const all = defaultLifelines()
  return ids
    .map((id) => all.find((l) => l.id === id))
    .filter((l): l is Lifeline => l !== undefined)
    .map((l) => ({ ...l, used: false }))
}

function cloneLifelines(): Lifeline[] {
  return defaultLifelines().map((lifeline) => ({ ...lifeline }))
}


function temporaryAnswerType(question: string, answer: string): string {
  const text = question.toLowerCase()
  const normalizedAnswer = answer.trim()
  if (/^-?\d+(?:[.,]\d+)?$/.test(normalizedAnswer.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[,،]/g, '.'))) {
    return /متى|أي سنة|اي سنة|أي عام|اي عام/.test(text) ? 'year' : 'number'
  }
  if (/متى|أي سنة|اي سنة|أي عام|اي عام/.test(text)) return 'year'
  if (/ممثل|ممثلة|لعب دور/.test(text)) return 'actor'
  if (/مخرج/.test(text)) return 'director'
  if (/مدرب/.test(text)) return 'coach'
  if (/عاصمة/.test(text)) return 'capital'
  if (/مدينة|مدينه/.test(text)) return 'city'
  if (/دولة|دوله|علم/.test(text)) return 'country'
  if (/نادي|ناد|فريق|فريق/.test(text)) return 'team'
  if (/هداف|من سجل|من اللاعب|لاعب/.test(text)) return 'player'
  if (/فيلم|مسلسل/.test(text)) return 'movie'
  if (/بطولة|بطوله|الدوري|كأس|كاس/.test(text)) return 'tournament'
  return 'other'
}

function buildTemporaryAnswerOptions(categoryId: string, questionText: string, correctAnswer: string): string[] {
  const answer = correctAnswer.trim()
  if (!answer) return []
  const type = temporaryAnswerType(questionText, answer)
  const entries = getQuestionEntries(categoryId)
  const candidates = [...new Set(entries
    .filter((entry) => entry.answer?.trim() && entry.answer.trim() !== answer)
    .filter((entry) => temporaryAnswerType(entry.question, entry.answer) === type)
    .map((entry) => entry.answer.trim()))]
  let distractors: string[] = []

  if (type === 'number' || type === 'year') {
    const value = Number(answer.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(',', '.'))
    if (Number.isFinite(value)) {
      const offsets = type === 'year' ? [-2, -1, 1] : [-2, -1, 2]
      distractors = offsets.map((offset) => String(value + offset)).filter((option) => option !== answer && Number(option) >= 0)
    }
  }

  distractors = [...new Set([...distractors, ...candidates])].slice(0, 3)
  return [answer, ...distractors].sort(() => Math.random() - 0.5)
}

function getQuestionContent(categoryId: string, points: PointValue, usedQuestionKeys: string[]) {
  const items = getQuestionEntriesByPoints(categoryId, points)

  if (items.length === 0) {
    return {
      question: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      answer: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      questionKey: '',
      found: false,
      media: '',
      mediaType: 'image',
      careerImage: '',
      answerMedia: '',
      hint: '',
      answerOptions: [],
    }
  }

  const unusedItems = items.filter((item) => !usedQuestionKeys.includes(item.id ?? ''))

  if (unusedItems.length === 0) {
    return {
      question: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      answer: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      questionKey: '',
      found: false,
      media: '',
      mediaType: 'image',
      careerImage: '',
      answerMedia: '',
      hint: '',
      answerOptions: [],
    }
  }

  const randomItem = unusedItems[Math.floor(Math.random() * unusedItems.length)]

  return {
    ...randomItem,
    questionKey: randomItem.id ?? `${categoryId}-${points}-${randomItem.question}`,
    found: true,
    media: randomItem.media || '',
    mediaType: (randomItem.mediaType as 'image' | 'video' | 'career') || 'image',
    careerImage: randomItem.careerImage || '',
    answerMedia: randomItem.answerMedia || '',
    hint: randomItem.hint || '',
  }
}

export const useGameBoardStore = create<GameBoardState>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      gameName: '',
      team1Name: '',
      team2Name: '',
      categoryIds: [],
      cells: [],
      currentTurn: 1,
      team1Score: 0,
      team2Score: 0,
      team1Lifelines: cloneLifelines(),
      team2Lifelines: cloneLifelines(),
      activeQuestion: null,
      usedQuestionKeys: [],

      pendingDoublePoints: null,
      blockActive: null,
      callFriendActive: null,
      callFriendTimeLeft: 0,
      callFriendHint: null,
      wheelBonus: null,
      answerSubmitted: false,
      selectedAnswer: null,
      answerCorrect: null,
      answerPoints: 0,

      initializeBoard: async () => {
        await loadRemoteQuestions()
        localStorage.removeItem('quizmaster-board')
        const setup = useGameSetupStore.getState()
        const rawCategoryIds = [...setup.team1CategoryIds, ...setup.team2CategoryIds]
        const finalCategoryIds = repairCategoryIds(rawCategoryIds)

        const enabledLifelines = useAppStore.getState().enabledLifelines
        const team1Lifelines = buildLifelinesFromIds(
          (setup.team1LifelineIds as LifelineId[]).filter((id) => enabledLifelines.includes(id)),
        )
        const team2Lifelines = buildLifelinesFromIds(
          (setup.team2LifelineIds as LifelineId[]).filter((id) => enabledLifelines.includes(id)),
        )

        set({
          isInitialized: true,
          gameName: setup.gameName || 'مسابقة تجريبية',
          team1Name: setup.team1Name || 'الفريق الأول',
          team2Name: setup.team2Name || 'الفريق الثاني',
          categoryIds: finalCategoryIds,
          cells: buildCells(finalCategoryIds),
          currentTurn: 1,
          team1Score: 0,
          team2Score: 0,
          team1Lifelines,
          team2Lifelines,
          activeQuestion: null,
          usedQuestionKeys: [],
          pendingDoublePoints: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          wheelBonus: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        })
      },

      getCell: (categoryId, slotIndex) => {
        const column = get().cells.find((col) => col[0]?.categoryId === categoryId)
        return column?.[slotIndex]
      },

      isCellPlayable: (categoryId, slotIndex) => {
        const cell = get().getCell(categoryId, slotIndex)
        if (!cell) return false
        if (cell.team1Played || cell.team2Played) return false
        return true
      },

      selectQuestion: (categoryId, slotIndex) => {
        if (!get().isCellPlayable(categoryId, slotIndex)) return null

        const cell = get().getCell(categoryId, slotIndex)
        if (!cell) return null

        const questionContent = getQuestionContent(categoryId, cell.points, get().usedQuestionKeys)
        const state = get()
        const doubleApplied = state.pendingDoublePoints === state.currentTurn

        const questionState: ActiveQuestion = {
          categoryId,
          slotIndex,
          points: cell.points as PointValue,
          team: state.currentTurn,
          questionText: questionContent.question,
          answerText: questionContent.answer,
          media: questionContent.media,
          mediaType: (questionContent.mediaType as 'image' | 'video' | 'career') || 'image',
          careerImage: questionContent.careerImage,
          answerMedia: questionContent.answerMedia,
          hint: questionContent.hint,
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied,
        }

        set({
          activeQuestion: questionState,
          usedQuestionKeys: questionContent.found && questionContent.questionKey
            ? [...get().usedQuestionKeys, questionContent.questionKey]
            : get().usedQuestionKeys,
          pendingDoublePoints: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          wheelBonus: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        })
        return questionState
      },


      clearActiveQuestion: () =>
        set({
          activeQuestion: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          wheelBonus: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        }),

      switchTurn: () => {
        set((state) => ({
          currentTurn: state.currentTurn === 1 ? 2 : 1,
        }))
      },

      resolveQuestion: (winner) => {
        const state = get()
        const activeQuestion = state.activeQuestion
        if (!activeQuestion) return

        let points = activeQuestion.points
        let blocked = false

        if (activeQuestion.doubleApplied) {
          points = points * 2
        }

        if (winner === 1 && state.blockActive === 1) {
          blocked = true
        }

        if (winner === 2 && state.blockActive === 2) {
          blocked = true
        }

        set((prevState) => {
          const nextCells = prevState.cells.map((column) =>
            column.map((cell) => {
              if (
                cell.categoryId !== activeQuestion.categoryId ||
                cell.slotIndex !== activeQuestion.slotIndex
              ) {
                return cell
              }

              return {
                ...cell,
                team1Played: true,
                team2Played: true,
              }
            }),
          )

          const nextTurn = prevState.currentTurn === 1 ? 2 : 1

          let team1Score = prevState.team1Score
          let team2Score = prevState.team2Score

          if (winner === 1 && !blocked) {
            team1Score += points
          } else if (winner === 2 && !blocked) {
            team2Score += points
          }

          return {
            cells: nextCells,
            currentTurn: nextTurn,
            team1Score,
            team2Score,
            activeQuestion: null,
            pendingDoublePoints: null,
            blockActive: null,
            callFriendActive: null,
            callFriendTimeLeft: 0,
            callFriendHint: null,
            answerSubmitted: false,
            selectedAnswer: null,
            answerCorrect: null,
            answerPoints: 0,
          }
        })
      },

      selectAnswer: (answer) => {
        const state = get()
        if (!state.activeQuestion) return
        if (state.activeQuestion.answered) return

        const isCorrect = answer === state.activeQuestion.answerText
        const winner = isCorrect ? state.activeQuestion.team : null

        const points = state.activeQuestion.points
        const displayPoints = state.activeQuestion.doubleApplied ? points * 2 : points

        let blocked = false
        if (winner === 1 && state.blockActive === 1) blocked = true
        if (winner === 2 && state.blockActive === 2) blocked = true

        set((prevState) => {
          const aq = prevState.activeQuestion!
          const nextCells = prevState.cells.map((column) =>
            column.map((cell) => {
              if (cell.categoryId === aq.categoryId && cell.slotIndex === aq.slotIndex) {
                return { ...cell, team1Played: true, team2Played: true }
              }
              return cell
            }),
          )

          let team1Score = prevState.team1Score
          let team2Score = prevState.team2Score
          if (isCorrect && !blocked && winner === 1) team1Score += displayPoints
          if (isCorrect && !blocked && winner === 2) team2Score += displayPoints

          return {
            cells: nextCells,
            currentTurn: prevState.currentTurn === 1 ? 2 : 1,
            team1Score,
            team2Score,
            activeQuestion: null,
            pendingDoublePoints: null,
            blockActive: null,
            callFriendActive: null,
            callFriendTimeLeft: 0,
            callFriendHint: null,
          }
        })
      },

      submitAnswer: (answer) => {
        const state = get()
        const activeQuestion = state.activeQuestion
        if (!activeQuestion || activeQuestion.answered || state.answerSubmitted) return

        const isCorrect = answer === activeQuestion.answerText
        const points = activeQuestion.doubleApplied ? activeQuestion.points * 2 : activeQuestion.points
        const blocked = isCorrect && state.blockActive === activeQuestion.team
        const awardedPoints = isCorrect && !blocked ? points : 0

        set((prevState) => ({
          [activeQuestion.team === 1 ? 'team1Score' : 'team2Score']:
            activeQuestion.team === 1
              ? prevState.team1Score + awardedPoints
              : prevState.team2Score + awardedPoints,
          activeQuestion: prevState.activeQuestion
            ? { ...prevState.activeQuestion, answered: true }
            : null,
          answerSubmitted: true,
          selectedAnswer: answer,
          answerCorrect: isCorrect,
          answerPoints: awardedPoints,
        }))
      },

      finishSubmittedQuestion: () => {
        const state = get()
        const activeQuestion = state.activeQuestion
        if (!activeQuestion || !state.answerSubmitted) return

        const nextCells = state.cells.map((column) =>
          column.map((cell) =>
            cell.categoryId === activeQuestion.categoryId && cell.slotIndex === activeQuestion.slotIndex
              ? { ...cell, team1Played: true, team2Played: true }
              : cell,
          ),
        )

        set({
          cells: nextCells,
          currentTurn: state.currentTurn === 1 ? 2 : 1,
          activeQuestion: null,
          pendingDoublePoints: null,
          blockActive: null,
          callFriendActive: null,
          callFriendTimeLeft: 0,
          callFriendHint: null,
          answerSubmitted: false,
          selectedAnswer: null,
          answerCorrect: null,
          answerPoints: 0,
        })
      },

      useLifeline: (lifelineId) => {
        const state = get()

        if (lifelineId === 'double') {
          const teamId = state.activeQuestion?.team ?? state.currentTurn
          const lifelinesKey = teamId === 1 ? 'team1Lifelines' : 'team2Lifelines'
          const lifelines = state[lifelinesKey]
          const lifeline = lifelines.find((l) => l.id === 'double')
          if (!lifeline || lifeline.used) return
          if (state.pendingDoublePoints !== null) return

          const updatedLifelines = lifelines.map((l) =>
            l.id === 'double' ? { ...l, used: true } : l,
          )

          if (state.activeQuestion) {
            if (state.activeQuestion.answered || state.activeQuestion.lifelineUsed) return
            set({
              [lifelinesKey]: updatedLifelines,
              activeQuestion: {
                ...state.activeQuestion,
                doubleApplied: true,
                lifelineUsed: 'double',
              },
            })
          } else {
            set({ [lifelinesKey]: updatedLifelines, pendingDoublePoints: teamId })
          }
          return
        }

        if (lifelineId === 'wheel') {
          const teamId = state.activeQuestion?.team ?? state.currentTurn
          const lifelinesKey = teamId === 1 ? 'team1Lifelines' : 'team2Lifelines'
          const lifelines = state[lifelinesKey]
          const lifeline = lifelines.find((l) => l.id === 'wheel')
          if (!lifeline || lifeline.used) return
          if (state.activeQuestion?.answered || state.activeQuestion?.lifelineUsed) return

          const updatedLifelines = lifelines.map((l) =>
            l.id === 'wheel' ? { ...l, used: true } : l,
          )
          const bonuses = [50, 100, 150, 200]
          const bonus = bonuses[Math.floor(Math.random() * bonuses.length)]
          set((prev) => ({
            [lifelinesKey]: updatedLifelines,
            ...(state.activeQuestion
              ? { activeQuestion: { ...state.activeQuestion, lifelineUsed: 'wheel' as LifelineId } }
              : {}),
            [teamId === 1 ? 'team1Score' : 'team2Score']:
              teamId === 1 ? prev.team1Score + bonus : prev.team2Score + bonus,
            wheelBonus: { teamId, points: bonus },
          }))
          return
        }

        if (!state.activeQuestion) return

        const teamId = state.activeQuestion.team
        const lifelinesKey = teamId === 1 ? 'team1Lifelines' : 'team2Lifelines'
        const lifelines = state[lifelinesKey]
        const lifeline = lifelines.find((l) => l.id === lifelineId)

        if (!lifeline || lifeline.used) return
        if (state.activeQuestion.answered) return
        if (state.activeQuestion.lifelineUsed) return

        const updatedLifelines = lifelines.map((l) =>
          l.id === lifelineId ? { ...l, used: true } : l,
        )

        set({
          [lifelinesKey]: updatedLifelines,
          activeQuestion: { ...state.activeQuestion, lifelineUsed: lifelineId },
        })

        switch (lifelineId) {
          case 'two-answers': {
            const options = buildTemporaryAnswerOptions(
              state.activeQuestion.categoryId,
              state.activeQuestion.questionText,
              state.activeQuestion.answerText,
            )
            set({
              activeQuestion: {
                ...state.activeQuestion,
                twoAnswersUsed: true,
                answerOptions: options,
                lifelineUsed: lifelineId,
              },
            })
            break
          }

          case 'block': {
            const blockedTeam = teamId === 1 ? 2 : 1
            set({ blockActive: blockedTeam as TeamId })
            break
          }

          case 'call': {
            const hint = state.activeQuestion.hint?.trim() || 'اقتراح الصديق: ركّز على الكلمات المفتاحية في السؤال واستبعد الإجابات البعيدة عن الموضوع.'
            set({ callFriendActive: teamId, callFriendTimeLeft: 30, callFriendHint: hint })
            break
          }
        }
      },

      clearCallFriend: () => set({ callFriendActive: null, callFriendTimeLeft: 0, callFriendHint: null }),

      tickCallFriend: () => {
        const state = get()
        if (state.callFriendTimeLeft <= 0) return

        const next = state.callFriendTimeLeft - 1
        if (next <= 0) {
          set({ callFriendActive: null, callFriendTimeLeft: 0, callFriendHint: null })
        } else {
          set({ callFriendTimeLeft: next })
        }
      },
    }),
    {
      name: 'quizmaster-board',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<GameBoardState> | undefined
        if (!persisted) return currentState

        const merged = { ...currentState, ...persisted }

        if (merged.isInitialized && Array.isArray(merged.categoryIds)) {
          merged.categoryIds = repairCategoryIds(merged.categoryIds)
          merged.cells = repairCells(merged.categoryIds, Array.isArray(merged.cells) ? merged.cells : [])
        }

        return merged
      },
      partialize: (state) => ({
        isInitialized: state.isInitialized,
        gameName: state.gameName,
        team1Name: state.team1Name,
        team2Name: state.team2Name,
        categoryIds: state.categoryIds,
        cells: state.cells,
        currentTurn: state.currentTurn,
        team1Score: state.team1Score,
        team2Score: state.team2Score,
        team1Lifelines: state.team1Lifelines,
        team2Lifelines: state.team2Lifelines,
        activeQuestion: state.activeQuestion,
        usedQuestionKeys: state.usedQuestionKeys,
        callFriendHint: state.callFriendHint,
        answerSubmitted: state.answerSubmitted,
        selectedAnswer: state.selectedAnswer,
        answerCorrect: state.answerCorrect,
        answerPoints: state.answerPoints,
      }),
    },
  ),
)
