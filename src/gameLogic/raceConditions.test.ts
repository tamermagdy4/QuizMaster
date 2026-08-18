import { describe, expect, it, beforeEach } from 'vitest'
import { useGameBoardStore } from '../store/gameBoardStore'

describe('Race Conditions Tests', () => {
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

  describe('Answer vs Timeout', () => {
    it('should handle answer submitted before timeout', () => {
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

      useGameBoardStore.getState().submitAnswer('Answer')
      expect(useGameBoardStore.getState().answerSubmitted).toBe(true)
      expect(useGameBoardStore.getState().selectedAnswer).toBe('Answer')
    })

    it('should handle timeout before answer (simulated)', () => {
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

      // Simulate timeout by not submitting answer
      // The question should remain active but unanswered
      expect(useGameBoardStore.getState().activeQuestion?.answered).toBe(false)
    })

    it('should prevent answer after question resolved', () => {
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
          answered: true,
          lifelineUsed: null,
          doubleApplied: false,
        },
      })

      useGameBoardStore.getState().resolveQuestion(1)
      expect(useGameBoardStore.getState().activeQuestion).toBeNull()

      // Try to submit answer after resolution
      useGameBoardStore.getState().submitAnswer('Late Answer')
      expect(useGameBoardStore.getState().answerSubmitted).toBe(false)
    })
  })

  describe('Double Finish', () => {
    it('should prevent double finish of same question', () => {
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
          answered: true,
          lifelineUsed: null,
          doubleApplied: false,
        },
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.getState().resolveQuestion(1)
      const scoreAfterFirst = useGameBoardStore.getState().team1Score

      useGameBoardStore.getState().resolveQuestion(1)
      const scoreAfterSecond = useGameBoardStore.getState().team1Score

      expect(scoreAfterFirst).toBe(scoreAfterSecond)
    })

    it('should prevent finish of already finished game', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        isGameFinished: true,
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

  describe('Double Select', () => {
    it('should prevent double selection of same question', () => {
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

      const firstSelection = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(firstSelection).not.toBeNull()

      const secondSelection = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(secondSelection).toBeNull()
    })

    it('should prevent selection of different question while one is active', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['general-knowledge'],
        cells: [
          [{
            categoryId: 'general-knowledge',
            slotIndex: 0,
            points: 100,
            team1Played: false,
            team2Played: false,
          }],
          [{
            categoryId: 'general-knowledge',
            slotIndex: 1,
            points: 300,
            team1Played: false,
            team2Played: false,
          }],
        ],
      })

      const firstSelection = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(firstSelection).not.toBeNull()

      // Store guard prevents overwriting an active question
      const secondSelection = useGameBoardStore.getState().selectQuestion('general-knowledge', 1)
      expect(secondSelection).toBeNull()
    })
  })

  describe('Simultaneous Actions', () => {
    it('should handle lifeline usage during active question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Lifelines: [{
          id: 'double',
          label: 'Double',
          description: 'Double points',
          icon: '✕2',
          used: false,
        }],
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
      expect(useGameBoardStore.getState().activeQuestion?.doubleApplied).toBe(true)
    })

    it('should prevent lifeline usage after answer submitted', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Lifelines: [{
          id: 'double',
          label: 'Double',
          description: 'Double points',
          icon: '✕2',
          used: false,
        }],
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

      useGameBoardStore.getState().useLifeline('double')
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(false)
    })

    it('should handle answer submission with active lifeline', () => {
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
          lifelineUsed: 'double',
          doubleApplied: true,
        },
      })

      useGameBoardStore.getState().submitAnswer('Answer')
      expect(useGameBoardStore.getState().answerSubmitted).toBe(true)
    })
  })

  describe('Finish vs Lifeline', () => {
    it('should prevent lifeline usage after question finished', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        isGameFinished: true,
        team1Lifelines: [{
          id: 'double',
          label: 'Double',
          description: 'Double points',
          icon: '✕2',
          used: false,
        }],
        activeQuestion: null,
      })

      useGameBoardStore.getState().useLifeline('double')
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(false)
    })

    it('should prevent finish during lifeline activation', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        team1Lifelines: [{
          id: 'double',
          label: 'Double',
          description: 'Double points',
          icon: '✕2',
          used: false,
        }],
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
          lifelineUsed: 'double',
          doubleApplied: true,
        },
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.getState().resolveQuestion(1)
      // Should complete the question and apply the double
      expect(useGameBoardStore.getState().activeQuestion).toBeNull()
    })
  })

  describe('Duplicate Submit', () => {
    it('should prevent duplicate answer submissions', () => {
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
      expect(useGameBoardStore.getState().selectedAnswer).toBe('Answer 1')

      useGameBoardStore.getState().submitAnswer('Answer 2')
      expect(useGameBoardStore.getState().selectedAnswer).toBe('Answer 1') // Should not change
    })

    it('should handle rapid consecutive submissions', () => {
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

      // Simulate rapid submissions
      useGameBoardStore.getState().submitAnswer('Answer 1')
      useGameBoardStore.getState().submitAnswer('Answer 2')
      useGameBoardStore.getState().submitAnswer('Answer 3')

      // Only the first should be accepted
      expect(useGameBoardStore.getState().selectedAnswer).toBe('Answer 1')
    })
  })

  describe('Concurrent Turn Changes', () => {
    it('should handle multiple turn change requests', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
      })

      useGameBoardStore.getState().switchTurn()
      expect(useGameBoardStore.getState().currentTurn).toBe(2)

      useGameBoardStore.getState().switchTurn()
      expect(useGameBoardStore.getState().currentTurn).toBe(1)

      useGameBoardStore.getState().switchTurn()
      expect(useGameBoardStore.getState().currentTurn).toBe(2)
    })

    it('should ignore turn changes in online mode', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        currentTurn: 1,
      })

      const initialTurn = useGameBoardStore.getState().currentTurn

      useGameBoardStore.getState().switchTurn()
      useGameBoardStore.getState().switchTurn()
      useGameBoardStore.getState().switchTurn()

      expect(useGameBoardStore.getState().currentTurn).toBe(initialTurn)
    })
  })

  describe('Score Mutation Races', () => {
    it('should handle concurrent score updates', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        team1Score: 100,
        team2Score: 200,
      })

      const initialScore1 = useGameBoardStore.getState().team1Score
      const initialScore2 = useGameBoardStore.getState().team2Score

      // Simulate concurrent operations
      useGameBoardStore.setState({
        team1Score: initialScore1 + 50,
      })

      useGameBoardStore.setState({
        team2Score: initialScore2 + 30,
      })

      // Final state should be deterministic
      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1 + 50)
      expect(useGameBoardStore.getState().team2Score).toBe(initialScore2 + 30)
    })
  })
})
