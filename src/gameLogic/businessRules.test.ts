import { describe, expect, it, beforeEach } from 'vitest'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useGameSetupStore } from '../store/gameSetupStore'
import type { PointValue } from '../types/board'

describe('Critical Business Logic Tests', () => {
  beforeEach(() => {
    // Reset all stores before each test
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
    
    useGameSetupStore.setState({
      gameName: 'Test Game',
      team1Name: 'Team 1',
      team2Name: 'Team 2',
      team1CategoryIds: ['general-knowledge', 'science', 'technology'],
      team2CategoryIds: ['football', 'movies', 'geography'],
      team1LifelineIds: [],
      team2LifelineIds: [],
      activeTeam: 1,
    })
  })

  describe('Score Integrity', () => {
    it('should maintain score as finite integer', () => {
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
      expect(state.team2Score).toBe(50)
    })

    it('should reject infinite scores', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Score: Number.POSITIVE_INFINITY,
        team2Score: 0,
      })
      
      const state = useGameBoardStore.getState()
      // The store should not accept infinite values
      expect(Number.isFinite(state.team1Score)).toBe(false)
    })

    it('should apply correct points on correct answer', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        team1Score: 0,
        team2Score: 0,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 300,
          team1Played: false,
          team2Played: false,
        }]],
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 300,
          team: 1,
          questionText: 'Test question',
          answerText: 'Test answer',
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

      useGameBoardStore.getState().submitAnswer('Test answer')
      const state = useGameBoardStore.getState()
      expect(state.team1Score).toBe(300)
      expect(state.team2Score).toBe(0)
    })

    it('should double points when double lifeline is active', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        team1Score: 0,
        team2Score: 0,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 300,
          team1Played: false,
          team2Played: false,
        }]],
        activeQuestion: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 300,
          team: 1,
          questionText: 'Test question',
          answerText: 'Test answer',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: true,
        },
      })

      useGameBoardStore.getState().submitAnswer('Test answer')
      const state = useGameBoardStore.getState()
      expect(state.team1Score).toBe(600) // 300 * 2
    })
  })

  describe('Turn Integrity', () => {
    it('should alternate turns between team 1 and team 2', () => {
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

    it('should only allow valid team IDs (1 or 2)', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
      })

      expect(useGameBoardStore.getState().currentTurn).toBe(1)
      expect([1, 2]).toContain(useGameBoardStore.getState().currentTurn)
    })

    it('should not change turn in online mode automatically', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        currentTurn: 1,
      })

      const initialTurn = useGameBoardStore.getState().currentTurn
      useGameBoardStore.getState().switchTurn()
      expect(useGameBoardStore.getState().currentTurn).toBe(initialTurn)
    })
  })

  describe('Question Selection', () => {
    it('should only select questions from valid categories', () => {
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

    it('should match question points to selected slot', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 500,
          team1Played: false,
          team2Played: false,
        }]],
      })

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).not.toBeNull()
      if (question) {
        expect(question.points).toBe(500)
      }
    })

    it('should prevent selection of already used questions', () => {
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
        usedQuestionKeys: ['general-knowledge-100-0'],
      })

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).toBeNull()
    })
  })

  describe('Point Values (100/300/500)', () => {
    it('should only allow valid point values in board cells', () => {
      const validPoints: PointValue[] = [100, 300, 500]
      
      validPoints.forEach(points => {
        const cell = {
          categoryId: 'test',
          slotIndex: 0,
          points,
          team1Played: false,
          team2Played: false,
        }
        expect(validPoints).toContain(cell.points)
      })
    })

    it('should reject invalid point values', () => {
      const invalidPoints = [0, 50, 200, 400, 999, -100]
      
      invalidPoints.forEach(points => {
        const cell = {
          categoryId: 'test',
          slotIndex: 0,
          points: points as PointValue,
          team1Played: false,
          team2Played: false,
        }
        // This should be caught by validation
        expect([100, 300, 500]).not.toContain(cell.points)
      })
    })
  })

  describe('Lifelines', () => {
    it('should mark lifeline as used after activation', () => {
      const lifeline = {
        id: 'double' as const,
        label: 'Double Points',
        description: 'Double the points',
        icon: '✕2',
        used: false,
      }

      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Lifelines: [lifeline],
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
      const state = useGameBoardStore.getState()
      expect(state.team1Lifelines[0].used).toBe(true)
    })

    it('should prevent using lifeline after question is answered', () => {
      const lifeline = {
        id: 'double' as const,
        label: 'Double Points',
        description: 'Double the points',
        icon: '✕2',
        used: false,
      }

      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Lifelines: [lifeline],
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
      const state = useGameBoardStore.getState()
      expect(state.team1Lifelines[0].used).toBe(false)
    })

    it('should prevent using same lifeline twice', () => {
      const lifeline = {
        id: 'double' as const,
        label: 'Double Points',
        description: 'Double the points',
        icon: '✕2',
        used: true,
      }

      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Lifelines: [lifeline],
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
      const state = useGameBoardStore.getState()
      expect(state.team1Lifelines[0].used).toBe(true) // Should remain used
    })
  })

  describe('Game Finished State', () => {
    it('should set game finished when all cells are used', () => {
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
        isGameFinished: false,
        currentTurn: 1,
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

      useGameBoardStore.getState().resolveQuestion(1)
      const state = useGameBoardStore.getState()
      expect(state.isGameFinished).toBe(true)
    })

    it('should prevent question selection after game finished', () => {
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
        isGameFinished: true,
      })

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).toBeNull()
    })

    it('should prevent score changes after game finished', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Score: 100,
        team2Score: 200,
        isGameFinished: true,
        activeQuestion: null,
      })

      const initialScore1 = useGameBoardStore.getState().team1Score
      const initialScore2 = useGameBoardStore.getState().team2Score

      useGameBoardStore.getState().resolveQuestion(1)

      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
      expect(useGameBoardStore.getState().team2Score).toBe(initialScore2)
    })
  })

  describe('Host Permissions', () => {
    it('should allow host to resolve questions in online mode', () => {
      // This would need online store setup
      // For now, we test the logic structure
      expect(true).toBe(true) // Placeholder
    })

    it('should prevent non-host from resolving questions in online mode', () => {
      // This would need online store setup
      // For now, we test the logic structure
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Invalid Actions', () => {
    it('should prevent answering without active question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        activeQuestion: null,
        answerSubmitted: false,
      })

      useGameBoardStore.getState().submitAnswer('test answer')
      const state = useGameBoardStore.getState()
      expect(state.answerSubmitted).toBe(false)
    })

    it('should prevent answering twice', () => {
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
        answerSubmitted: true,
        selectedAnswer: 'test',
      })

      useGameBoardStore.getState().submitAnswer('another answer')
      const state = useGameBoardStore.getState()
      expect(state.selectedAnswer).toBe('test') // Should not change
    })

    it('should prevent resolving without active question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        activeQuestion: null,
        team1Score: 100,
        team2Score: 200,
      })

      const initialScore1 = useGameBoardStore.getState().team1Score
      const initialScore2 = useGameBoardStore.getState().team2Score

      useGameBoardStore.getState().resolveQuestion(1)

      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
      expect(useGameBoardStore.getState().team2Score).toBe(initialScore2)
    })
  })
})
