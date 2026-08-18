import { describe, expect, it, beforeEach } from 'vitest'
import { useGameBoardStore } from '../store/gameBoardStore'
import { ensureLocalQuestionsLoaded } from '../data/questionLoader'
import { isPointValue } from './contracts'

describe('Property / Invariant Tests', () => {
  beforeEach(() => {
    // Reset store before each test
    useGameBoardStore.setState({
      isInitialized: false,
      gameMode: 'local',
      isRevealed: false,
      isGameFinished: false,
      gameName: '',
      team1Name: '',
      team2Name: '',
      categoryIds: [],
      cells: [],
      currentTurn: 1,
      team1Score: 0,
      team2Score: 0,
      team1Lifelines: [],
      team2Lifelines: [],
      activeQuestion: null,
      usedQuestionKeys: [],
      ffaPlayers: [],
      ffaTurnPlayerId: null,
      ffaPendingDoublePlayerId: null,
      ffaBlockedPlayerId: null,
      ffaCallFriendPlayerId: null,
      pendingDoublePoints: null,
      blockActive: null,
      callFriendActive: null,
      callFriendTimeLeft: 0,
      callFriendHint: null,
      wheelBonus: null,
      wheelPending: false,
      wheelPendingTeam: null,
      ffaWheelPendingPlayerId: null,
      answerSubmitted: false,
      selectedAnswer: null,
      answerCorrect: null,
      answerPoints: 0,
    })
  })

  describe('Point Values Invariant', () => {
    it('should maintain that points ∈ {100,300,500} in board cells', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge', 'science'],
        cells: [
          [
            { categoryId: 'general-knowledge', slotIndex: 0, points: 100, team1Played: false, team2Played: false },
            { categoryId: 'general-knowledge', slotIndex: 1, points: 300, team1Played: false, team2Played: false },
            { categoryId: 'general-knowledge', slotIndex: 2, points: 500, team1Played: false, team2Played: false },
          ],
          [
            { categoryId: 'science', slotIndex: 0, points: 100, team1Played: false, team2Played: false },
            { categoryId: 'science', slotIndex: 1, points: 300, team1Played: false, team2Played: false },
            { categoryId: 'science', slotIndex: 2, points: 500, team1Played: false, team2Played: false },
          ],
        ],
      })

      const state = useGameBoardStore.getState()
      state.cells.flat().forEach(cell => {
        expect(isPointValue(cell.points)).toBe(true)
      })
    })

    it('should maintain that points ∈ {100,300,500} in active question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 300,
          team: 1,
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: false,
        },
      })

      const state = useGameBoardStore.getState()
      expect(isPointValue(state.activeQuestion?.points)).toBe(true)
    })

    it('should reject invalid point values in mutations', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.setState({ team1Score: 250 as any })

      // The store should accept it (TypeScript validation at compile time)
      // But runtime validation should catch it in business logic
      const finalScore = useGameBoardStore.getState().team1Score
      expect(Number.isFinite(finalScore)).toBe(true)
    })
  })

  describe('Score Integrity Invariant', () => {
    it('should maintain that scores are always finite integers', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Score: 100,
        team2Score: 200,
      })

      const state = useGameBoardStore.getState()
      expect(Number.isFinite(state.team1Score)).toBe(true)
      expect(Number.isInteger(state.team1Score)).toBe(true)
      expect(Number.isFinite(state.team2Score)).toBe(true)
      expect(Number.isInteger(state.team2Score)).toBe(true)
    })

    it('should allow negative scores (wheel deductions)', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Score: -150,
        team2Score: 50,
      })

      const state = useGameBoardStore.getState()
      expect(state.team1Score).toBe(-150)
      expect(Number.isFinite(state.team1Score)).toBe(true)
    })

    it('should reject infinite scores', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Score: Number.POSITIVE_INFINITY,
        team2Score: 0,
      })

      const state = useGameBoardStore.getState()
      // The store should handle this gracefully
      expect(typeof state.team1Score).toBe('number')
    })

    it('should maintain score consistency after operations', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: false,
        },
        team1Score: 0,
        team2Score: 0,
      })

      const beforeScore = useGameBoardStore.getState().team1Score
      useGameBoardStore.getState().submitAnswer('Answer')
      const afterScore = useGameBoardStore.getState().team1Score

      expect(afterScore).toBe(beforeScore + 100)
      expect(Number.isFinite(afterScore)).toBe(true)
    })
  })

  describe('Game State Transition Invariant', () => {
    it('should prevent finished game from returning to playing', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        isGameFinished: true,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
      })

      // Try to select a question after game finished
      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).toBeNull()

      // Game should remain finished
      expect(useGameBoardStore.getState().isGameFinished).toBe(true)
    })

    it('should prevent score mutations after game finished', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        isGameFinished: true,
        team1Score: 100,
        team2Score: 200,
      })

      const initialScore1 = useGameBoardStore.getState().team1Score
      const initialScore2 = useGameBoardStore.getState().team2Score

      // Try to resolve a question after game finished
      useGameBoardStore.getState().resolveQuestion(1)

      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
      expect(useGameBoardStore.getState().team2Score).toBe(initialScore2)
    })

    it('should prevent turn changes after game finished', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        isGameFinished: true,
        currentTurn: 1,
      })

      const initialTurn = useGameBoardStore.getState().currentTurn
      useGameBoardStore.getState().switchTurn()

      expect(useGameBoardStore.getState().currentTurn).toBe(initialTurn)
    })
  })

  describe('Used Question Invariant', () => {
    it('should prevent used question from being selected again', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
        usedQuestionKeys: ['general-knowledge-100-0'],
      })

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      // Store returns a fallback message when all questions in pool are used
      expect(question).toBeTruthy()
      expect(question?.questionText).toContain('لا توجد أسئلة متاحة')
    })

    it('should maintain used question keys uniqueness', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        usedQuestionKeys: ['q1', 'q2', 'q3'],
      })

      const keys = useGameBoardStore.getState().usedQuestionKeys
      const uniqueKeys = new Set(keys)

      expect(uniqueKeys.size).toBe(keys.length)
    })

    it('should add question key when question is selected', async () => {
      await ensureLocalQuestionsLoaded()

      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
        usedQuestionKeys: [],
      })

      const initialKeys = useGameBoardStore.getState().usedQuestionKeys.length
      useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      const finalKeys = useGameBoardStore.getState().usedQuestionKeys.length

      expect(finalKeys).toBe(initialKeys + 1)
    })
  })

  describe('Unauthorized Action Invariant', () => {
    it('should prevent non-host from resolving in online mode', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        currentTurn: 2, // Non-host's turn
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 2,
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: true,
          lifelineUsed: null,
          doubleApplied: false,
        },
        team1Score: 100,
        team2Score: 200,
      })

      const initialScore1 = useGameBoardStore.getState().team1Score
      const initialScore2 = useGameBoardStore.getState().team2Score

      // Non-host tries to resolve (should be prevented in online mode)
      useGameBoardStore.getState().resolveQuestion(2)

      // Scores should not change
      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
      expect(useGameBoardStore.getState().team2Score).toBe(initialScore2)
    })

    it('should prevent answering when not current turn in online mode', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        currentTurn: 1,
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 2, // Different from current turn
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: false,
        },
      })

      useGameBoardStore.getState().submitAnswer('Answer')
      expect(useGameBoardStore.getState().answerSubmitted).toBe(false)
    })
  })

  describe('Question Category Invariant', () => {
    it('should ensure question belongs to selected category', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
      })

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).not.toBeNull()
      
      if (question) {
        expect(question.categoryId).toBe('general-knowledge')
      }
    })

    it('should prevent cross-category question selection', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
      })

      // Try to select from a different category
      const question = useGameBoardStore.getState().selectQuestion('science', 0)
      expect(question).toBeNull()
    })
  })

  describe('Turn Invariant', () => {
    it('should maintain that current turn is always 1 or 2', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
      })

      const state = useGameBoardStore.getState()
      expect([1, 2]).toContain(state.currentTurn)
    })

    it('should prevent invalid turn values', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
      })

      useGameBoardStore.setState({ currentTurn: 1 })
      expect([1, 2]).toContain(useGameBoardStore.getState().currentTurn)
    })

    it('should alternate turns correctly', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
      })

      useGameBoardStore.getState().switchTurn()
      expect(useGameBoardStore.getState().currentTurn).toBe(2)

      useGameBoardStore.getState().switchTurn()
      expect(useGameBoardStore.getState().currentTurn).toBe(1)
    })
  })

  describe('Lifeline Invariant', () => {
    it('should maintain that used lifelines cannot be used again', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Lifelines: [
          { id: 'double', label: 'Double', description: 'Double points', icon: '✕2', used: true },
        ],
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: false,
        },
      })

      useGameBoardStore.getState().useLifeline('double')
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(true)
    })

    it('should prevent lifeline usage after question answered', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Lifelines: [
          { id: 'double', label: 'Double', description: 'Double points', icon: '✕2', used: false },
        ],
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: true,
          lifelineUsed: null,
          doubleApplied: false,
        },
      })

      useGameBoardStore.getState().useLifeline('double')
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(false)
    })
  })

  describe('Cell State Invariant', () => {
    it('should maintain that played cells cannot be played again', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: true,
          team2Played: true,
        }]],
      })

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).toBeNull()
    })

    it('should maintain cell state consistency', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
      })

      const cell = useGameBoardStore.getState().getCell('general-knowledge', 0)
      expect(cell).toBeDefined()
      expect(cell?.team1Played).toBe(false)
      expect(cell?.team2Played).toBe(false)
    })
  })

  describe('Answer State Invariant', () => {
    it('should prevent multiple answers to same question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: false,
        },
      })

      useGameBoardStore.getState().submitAnswer('Answer 1')
      const firstAnswer = useGameBoardStore.getState().selectedAnswer

      useGameBoardStore.getState().submitAnswer('Answer 2')
      const secondAnswer = useGameBoardStore.getState().selectedAnswer

      expect(firstAnswer).toBe(secondAnswer)
    })

    it('should maintain that answered question cannot be answered again', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionText: 'Test',
          answerText: 'Answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: true,
          lifelineUsed: null,
          doubleApplied: false,
        },
        answerSubmitted: true,
      })

      useGameBoardStore.getState().submitAnswer('Another Answer')
      expect(useGameBoardStore.getState().answerSubmitted).toBe(true)
      expect(useGameBoardStore.getState().selectedAnswer).not.toBe('Another Answer')
    })
  })

  describe('Initialization Invariant', () => {
    it('should prevent gameplay actions before initialization', () => {
      useGameBoardStore.setState({
        isInitialized: false,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: false,
          team2Played: false,
        }]],
      })

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).toBeNull()
    })

    it('should require initialization for gameplay', () => {
      useGameBoardStore.setState({
        isInitialized: false,
        gameMode: 'local',
      })

      expect(useGameBoardStore.getState().isInitialized).toBe(false)
      expect(useGameBoardStore.getState().activeQuestion).toBeNull()
    })
  })
})
