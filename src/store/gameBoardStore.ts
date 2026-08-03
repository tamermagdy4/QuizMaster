import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultLifelines } from '../data/lifelines'
import type { ActiveQuestion, BoardCell, Lifeline, PointValue } from '../types/board'
import { POINT_SLOTS, TOTAL_CATEGORIES } from '../types/board'
import type { TeamId } from '../types/game'
import { useGameSetupStore } from './gameSetupStore'

const QUESTION_BANK: Record<string, { question: string; answer: string }[]> = {
  history: [
    {
      question: 'في أي سنة انطلقت الثورة العربية الكبرى؟',
      answer: 'انطلقت الثورة العربية الكبرى في عام 1916م.',
    },
    {
      question: 'من هو المؤسس الحفيد للدولة السعودية؟',
      answer: 'الملك عبد العزيز بن عبد الرحمن آل سعود.',
    },
  ],
  geography: [
    {
      question: 'ما عاصمة المغرب؟',
      answer: 'عاصمة المغرب هي الرباط.',
    },
    {
      question: 'ما أكبر دولة عربية من حيث المساحة؟',
      answer: 'السعودية هي أكبر دولة عربية من حيث المساحة.',
    },
  ],
  science: [
    {
      question: 'ما الوحدة الأساسية للطاقة في النظام الدولي؟',
      answer: 'الوحدة الأساسية للطاقة هي الجول.',
    },
    {
      question: 'أي جسم يحيط بالأرض ويكون سبب الليل والنهار؟',
      answer: 'الشمس هي مصدر الضوء وسبب النهار، والأرض تدور حول نفسها.',
    },
  ],
  sports: [
    {
      question: 'كم عدد لاعبي كرة القدم في الملعب في وقت واحد؟',
      answer: '11 لاعباً من كل فريق.',
    },
    {
      question: 'في أي رياضة يطلق على البطولة العالمية الكبرى اسم مونديال؟',
      answer: 'كرة القدم.',
    },
  ],
  literature: [
    {
      question: 'من مؤلف كتاب ألف ليلة وليلة؟',
      answer: 'الكتاب جمعه مؤلفون متعددون عبر العصور وليس له مؤلف واحد محدد.',
    },
    {
      question: 'أي شاعر عربي اشتهر بقصيدة المعلقات؟',
      answer: 'المعلقات من أشهر قصائد الجاهلية، ولا يعزى لاسم واحد محدد.',
    },
  ],
  art: [
    {
      question: 'ما اللون الأساسي الذي يميز الفن الإسلامي في الزخارف؟',
      answer: 'الأزرق والذهبي من أكثر الألوان شيوعاً في الزخارف الإسلامية.',
    },
    {
      question: 'ما اسم أشهر ميدان في باريس يرتاده الفنانون؟',
      answer: 'ميدان ليوناردو دا فينشي أو ميدان دو تيه؟',
    },
  ],
}

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

  initializeBoard: () => void
  isCellPlayable: (categoryId: string, slotIndex: number) => boolean
  selectQuestion: (categoryId: string, slotIndex: number) => ActiveQuestion | null
  clearActiveQuestion: () => void
  getCell: (categoryId: string, slotIndex: number) => BoardCell | undefined
  switchTurn: () => void
  resolveQuestion: (winner: TeamId | null) => void
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

function cloneLifelines(): Lifeline[] {
  return defaultLifelines().map((lifeline) => ({ ...lifeline }))
}

function getQuestionContent(categoryId: string, slotIndex: number) {
  const items = QUESTION_BANK[categoryId] ?? []
  const fallback = items[slotIndex % Math.max(items.length, 1)] ?? {
    question: `سؤال في ${categoryId}`,
    answer: 'الإجابة ستظهر هنا عند التحقق.',
  }

  return fallback
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

      initializeBoard: () => {
        const setup = useGameSetupStore.getState()
        let categoryIds = [...setup.team1CategoryIds, ...setup.team2CategoryIds]

        if (categoryIds.length < TOTAL_CATEGORIES) {
          categoryIds = ['history', 'geography', 'science', 'sports', 'literature', 'art']
        }

        set({
          isInitialized: true,
          gameName: setup.gameName || 'مسابقة تجريبية',
          team1Name: setup.team1Name || 'الفريق الأول',
          team2Name: setup.team2Name || 'الفريق الثاني',
          categoryIds: categoryIds.slice(0, TOTAL_CATEGORIES),
          cells: buildCells(categoryIds.slice(0, TOTAL_CATEGORIES)),
          currentTurn: 1,
          team1Score: 0,
          team2Score: 0,
          team1Lifelines: cloneLifelines(),
          team2Lifelines: cloneLifelines(),
          activeQuestion: null,
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

        const { question, answer } = getQuestionContent(categoryId, slotIndex)
        const questionState: ActiveQuestion = {
          categoryId,
          slotIndex,
          points: cell.points as PointValue,
          team: get().currentTurn,
          questionText: question,
          answerText: answer,
        }

        set({ activeQuestion: questionState })
        return questionState
      },

      clearActiveQuestion: () => set({ activeQuestion: null }),

      switchTurn: () => {
        set((state) => ({
          currentTurn: state.currentTurn === 1 ? 2 : 1,
        }))
      },

      resolveQuestion: (winner) => {
        const activeQuestion = get().activeQuestion
        if (!activeQuestion) return

        set((state) => {
          const nextCells = state.cells.map((column) =>
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

          const nextTurn = state.currentTurn === 1 ? 2 : 1

          return {
            cells: nextCells,
            currentTurn: nextTurn,
            team1Score:
              winner === 1 ? state.team1Score + activeQuestion.points : state.team1Score,
            team2Score:
              winner === 2 ? state.team2Score + activeQuestion.points : state.team2Score,
            activeQuestion: null,
          }
        })
      },
    }),
    {
      name: 'quizmaster-board',
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
      }),
    },
  ),
)

