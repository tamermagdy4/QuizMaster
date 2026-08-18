import { describe, expect, it, beforeEach } from 'vitest'
import { useGameBoardStore } from '../store/gameBoardStore'

describe('State Machine Tests', () => {
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

  describe('Valid Transitions', () => {
    it('should transition from initialized to active question', () => {
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
      expect(useGameBoardStore.getState().activeQuestion).not.toBeNull()
    })

    it('should transition from active question to answered', () => {
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
      expect(useGameBoardStore.getState().activeQuestion?.answered).toBe(true)
    })

    it('should transition from answered to resolved', () => {
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
    })

    it('should transition from resolved to game finished when all cells used', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: true,
          team2Played: true,
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
      expect(useGameBoardStore.getState().isGameFinished).toBe(true)
    })

    it('should allow turn changes between questions', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
      })

      useGameBoardStore.getState().switchTurn()
      expect(useGameBoardStore.getState().currentTurn).toBe(2)
    })

    it('should allow lifeline usage during active question', () => {
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
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(true)
    })
  })

  describe('Invalid Transitions', () => {
    it('should prevent question selection without initialization', () => {
      useGameBoardStore.setState({
        isInitialized: false,
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

    it('should prevent question selection when cell already used', () => {
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

    it('should prevent answering without active question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        activeQuestion: null,
      })

      useGameBoardStore.getState().submitAnswer('Answer')
      expect(useGameBoardStore.getState().answerSubmitted).toBe(false)
    })

    it('should prevent answering when already answered', () => {
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
      expect(useGameBoardStore.getState().selectedAnswer).not.toBe('Another Answer')
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
      useGameBoardStore.getState().resolveQuestion(1)
      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
    })

    it('should prevent lifeline usage after question answered', () => {
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
      })

      useGameBoardStore.getState().useLifeline('double')
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(false)
    })

    it('should allow double lifeline pre-pick before game finish', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        isGameFinished: false,
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
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(true)
      expect(useGameBoardStore.getState().pendingDoublePoints).toBe(1)
    })

    it('should allow normal lifeline usage during active question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        isGameFinished: false,
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
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(true)
      expect(useGameBoardStore.getState().activeQuestion?.doubleApplied).toBe(true)
    })

    it('should prevent turn changes in online mode', () => {
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

  describe('Terminal State (GAME_FINISHED)', () => {
    it('should prevent question selection after game finished', () => {
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

      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question).toBeNull()
    })

    it('should prevent answer submission after game finished', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        isGameFinished: true,
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
      expect(useGameBoardStore.getState().answerSubmitted).toBe(false)
    })

    it('should prevent question resolution after game finished', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        isGameFinished: true,
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
        team1Score: 100,
        team2Score: 200,
      })

      const initialScore1 = useGameBoardStore.getState().team1Score
      useGameBoardStore.getState().resolveQuestion(1)
      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
    })

    it('should prevent lifeline usage after game finished', () => {
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
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(false)
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

      // Try various score mutation attempts
      useGameBoardStore.getState().resolveQuestion(1)
      useGameBoardStore.getState().submitAnswer('test')

      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
      expect(useGameBoardStore.getState().team2Score).toBe(initialScore2)
    })
  })

  describe('Duplicate Actions', () => {
    it('should prevent duplicate question selection', () => {
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

      const question1 = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question1).not.toBeNull()

      const question2 = useGameBoardStore.getState().selectQuestion('general-knowledge', 0)
      expect(question2).toBeNull()
    })

    it('should prevent duplicate answer submission', () => {
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

      useGameBoardStore.getState().submitAnswer('Another Answer')
      expect(useGameBoardStore.getState().selectedAnswer).toBe('Answer')
    })

    it('should prevent duplicate lifeline usage', () => {
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
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(true)

      useGameBoardStore.getState().useLifeline('double')
      expect(useGameBoardStore.getState().team1Lifelines[0].used).toBe(true)
    })
  })

  describe('Stale Actions', () => {
    it('should prevent resolving already resolved question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        currentTurn: 1,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: true,
          team2Played: true,
        }]],
        activeQuestion: null,
        team1Score: 100,
        team2Score: 200,
      })

      const initialScore1 = useGameBoardStore.getState().team1Score
      useGameBoardStore.getState().resolveQuestion(1)
      expect(useGameBoardStore.getState().team1Score).toBe(initialScore1)
    })

    it('should prevent answering resolved question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        activeQuestion: null,
      })

      useGameBoardStore.getState().submitAnswer('Answer')
      expect(useGameBoardStore.getState().answerSubmitted).toBe(false)
    })
  })

  describe('Repeated Actions', () => {
    it('should handle repeated turn changes correctly', () => {
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

    it('should handle repeated clear operations safely', () => {
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

      useGameBoardStore.getState().clearActiveQuestion()
      expect(useGameBoardStore.getState().activeQuestion).toBeNull()

      useGameBoardStore.getState().clearActiveQuestion()
      expect(useGameBoardStore.getState().activeQuestion).toBeNull()
    })
  })
})
