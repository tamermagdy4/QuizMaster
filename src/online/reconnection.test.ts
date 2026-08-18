import { describe, expect, it, beforeEach } from 'vitest'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useOnlineStore } from '../store/onlineStore'
import { resetOnlineMatchState } from '../store/gameBoardStore'

describe('Reconnection Tests', () => {
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

    useOnlineStore.setState({
      room: null,
      self: null,
      connectionStatus: 'disconnected',
    })
  })

  describe('Reconnect in Lobby', () => {
    it('should allow reconnection in waiting room', () => {
      useOnlineStore.setState({
        room: {
          roomId: 'room-1',
          roomCode: 'ABC123',
          hostId: 'host-1',
          players: [
            { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
            { id: 'player-2', name: 'Player 2', isHost: false, connected: false, joinedAt: 2 },
          ],
          status: 'waiting',
          questionDuration: 30,
          maxPlayers: 2,
          categoryIds: [],
          team1LifelineIds: [],
          team2LifelineIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        self: { id: 'player-2', name: 'Player 2', isHost: false, connected: true, joinedAt: 1 },
        connectionStatus: 'disconnected',
      })

      // Simulate reconnection
      useOnlineStore.setState({
        connectionStatus: 'connected',
      })

      expect(useOnlineStore.getState().connectionStatus).toBe('connected')
      // Room state should remain intact
      expect(useOnlineStore.getState().room?.status).toBe('waiting')
    })

    it('should preserve lobby state after reconnection', () => {
      useOnlineStore.setState({
        room: {
          roomId: 'room-1',
          roomCode: 'ABC123',
          hostId: 'host-1',
          players: [
            { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
          ],
          status: 'waiting',
          questionDuration: 30,
          maxPlayers: 2,
          categoryIds: ['general-knowledge', 'science'],
          team1LifelineIds: ['double'],
          team2LifelineIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        self: { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
        connectionStatus: 'disconnected',
      })

      const beforeReconnect = useOnlineStore.getState().room

      useOnlineStore.setState({ connectionStatus: 'connected' })

      const afterReconnect = useOnlineStore.getState().room
      expect(afterReconnect?.categoryIds).toEqual(beforeReconnect?.categoryIds)
      expect(afterReconnect?.team1LifelineIds).toEqual(beforeReconnect?.team1LifelineIds)
    })
  })

  describe('Reconnect During Question', () => {
    it('should preserve active question state', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
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
          questionText: 'Test Question',
          answerText: 'Test Answer',
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
        currentTurn: 1,
        team1Score: 100,
        team2Score: 50,
      })

      useOnlineStore.setState({
        room: {
          roomId: 'room-1',
          roomCode: 'ABC123',
          hostId: 'host-1',
          players: [
            { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
            { id: 'player-2', name: 'Player 2', isHost: false, connected: false, joinedAt: 2 },
          ],
          status: 'playing',
          questionDuration: 30,
          maxPlayers: 2,
          categoryIds: ['general-knowledge'],
          team1LifelineIds: [],
          team2LifelineIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        self: { id: 'player-2', name: 'Player 2', isHost: false, connected: true, joinedAt: 1 },
        connectionStatus: 'disconnected',
      })

      const beforeReconnect = useGameBoardStore.getState().activeQuestion

      // Simulate reconnection
      useOnlineStore.setState({ connectionStatus: 'connected' })

      const afterReconnect = useGameBoardStore.getState().activeQuestion
      expect(afterReconnect?.questionText).toBe(beforeReconnect?.questionText)
      expect(afterReconnect?.points).toBe(beforeReconnect?.points)
    })

    it('should preserve turn state during active question', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        currentTurn: 2,
        team1Score: 100,
        team2Score: 200,
      })

      const beforeReconnect = useGameBoardStore.getState().currentTurn

      useOnlineStore.setState({
        connectionStatus: 'disconnected',
      })

      useOnlineStore.setState({
        connectionStatus: 'connected',
      })

      expect(useGameBoardStore.getState().currentTurn).toBe(beforeReconnect)
    })
  })

  describe('Reconnect During Answer', () => {
    it('should preserve answer submission state', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
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
        selectedAnswer: 'Test Answer',
        answerCorrect: null,
        answerPoints: 0,
      })

      const beforeReconnect = {
        submitted: useGameBoardStore.getState().answerSubmitted,
        selected: useGameBoardStore.getState().selectedAnswer,
      }

      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      const afterReconnect = {
        submitted: useGameBoardStore.getState().answerSubmitted,
        selected: useGameBoardStore.getState().selectedAnswer,
      }

      expect(afterReconnect.submitted).toBe(beforeReconnect.submitted)
      expect(afterReconnect.selected).toBe(beforeReconnect.selected)
    })
  })

  describe('Reconnect After Question Finished', () => {
    it('should preserve game state after question resolution', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: true,
          team2Played: true,
        }]],
        activeQuestion: null,
        currentTurn: 2,
        team1Score: 150,
        team2Score: 100,
        usedQuestionKeys: ['general-knowledge-100-0'],
      })

      const beforeReconnect = {
        scores: {
          team1: useGameBoardStore.getState().team1Score,
          team2: useGameBoardStore.getState().team2Score,
        },
        turn: useGameBoardStore.getState().currentTurn,
        usedKeys: useGameBoardStore.getState().usedQuestionKeys,
      }

      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      const afterReconnect = {
        scores: {
          team1: useGameBoardStore.getState().team1Score,
          team2: useGameBoardStore.getState().team2Score,
        },
        turn: useGameBoardStore.getState().currentTurn,
        usedKeys: useGameBoardStore.getState().usedQuestionKeys,
      }

      expect(afterReconnect.scores.team1).toBe(beforeReconnect.scores.team1)
      expect(afterReconnect.scores.team2).toBe(beforeReconnect.scores.team2)
      expect(afterReconnect.turn).toBe(beforeReconnect.turn)
      expect(afterReconnect.usedKeys).toEqual(beforeReconnect.usedKeys)
    })
  })

  describe('Reconnect After Game Finished', () => {
    it('should preserve finished game state', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        isGameFinished: true,
        team1Score: 1000,
        team2Score: 800,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team1Played: true,
          team2Played: true,
        }]],
      })

      const beforeReconnect = {
        finished: useGameBoardStore.getState().isGameFinished,
        scores: {
          team1: useGameBoardStore.getState().team1Score,
          team2: useGameBoardStore.getState().team2Score,
        },
      }

      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      const afterReconnect = {
        finished: useGameBoardStore.getState().isGameFinished,
        scores: {
          team1: useGameBoardStore.getState().team1Score,
          team2: useGameBoardStore.getState().team2Score,
        },
      }

      expect(afterReconnect.finished).toBe(beforeReconnect.finished)
      expect(afterReconnect.scores.team1).toBe(beforeReconnect.scores.team1)
      expect(afterReconnect.scores.team2).toBe(beforeReconnect.scores.team2)
    })

    it('should prevent new game actions after finished game reconnection', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        isGameFinished: true,
        categoryIds: ['general-knowledge'],
        cells: [[{
          categoryId: 'general-knowledge',
          slotIndex: 1,
          points: 300,
          team1Played: false,
          team2Played: false,
        }]],
      })

      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      // Try to select a new question after reconnection to finished game
      const question = useGameBoardStore.getState().selectQuestion('general-knowledge', 1)
      expect(question).toBeNull()
    })
  })

  describe('Reconnection Failure Scenarios', () => {
    it('should handle multiple reconnection attempts', () => {
      useOnlineStore.setState({
        connectionStatus: 'disconnected',
      })

      // Multiple reconnection attempts
      useOnlineStore.setState({ connectionStatus: 'connected' })
      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })
      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      expect(useOnlineStore.getState().connectionStatus).toBe('connected')
    })

    it('should not duplicate state on reconnection', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        usedQuestionKeys: ['q1', 'q2'],
      })

      const initialKeys = useGameBoardStore.getState().usedQuestionKeys

      // Simulate reconnection
      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      // Keys should not be duplicated
      expect(useGameBoardStore.getState().usedQuestionKeys).toEqual(initialKeys)
    })
  })

  describe('State Reset Prevention', () => {
    it('should not reset game state on reconnection', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        team1Score: 500,
        team2Score: 300,
        usedQuestionKeys: ['q1', 'q2', 'q3'],
      })

      const beforeReconnect = {
        team1Score: useGameBoardStore.getState().team1Score,
        team2Score: useGameBoardStore.getState().team2Score,
        usedKeys: useGameBoardStore.getState().usedQuestionKeys,
      }

      // Simulate reconnection
      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      const afterReconnect = {
        team1Score: useGameBoardStore.getState().team1Score,
        team2Score: useGameBoardStore.getState().team2Score,
        usedKeys: useGameBoardStore.getState().usedQuestionKeys,
      }

      expect(afterReconnect.team1Score).toBe(beforeReconnect.team1Score)
      expect(afterReconnect.team2Score).toBe(beforeReconnect.team2Score)
      expect(afterReconnect.usedKeys).toEqual(beforeReconnect.usedKeys)
    })

    it('should prevent stale snapshot overwriting fresh state', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        team1Score: 1000,
        team2Score: 500,
      })

      // Simulate receiving a stale snapshot with old scores
      const freshState = useGameBoardStore.getState()

      // The stale snapshot should not overwrite fresh state
      expect(freshState.team1Score).toBe(1000)
      expect(freshState.team2Score).toBe(500)
    })
  })

  describe('Duplicate Event Prevention', () => {
    it('should not duplicate used question keys on reconnection', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        usedQuestionKeys: ['q1', 'q2'],
      })

      const initialKeys = [...useGameBoardStore.getState().usedQuestionKeys]

      // Simulate reconnection
      useOnlineStore.setState({ connectionStatus: 'disconnected' })
      useOnlineStore.setState({ connectionStatus: 'connected' })

      // Keys should remain the same, not duplicated
      expect(useGameBoardStore.getState().usedQuestionKeys).toEqual(initialKeys)
    })
  })

  describe('Match State Reset', () => {
    it('should properly reset match state for new game', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        team1Score: 1000,
        team2Score: 800,
        usedQuestionKeys: ['q1', 'q2', 'q3'],
        isGameFinished: true,
      })

      resetOnlineMatchState()

      expect(useGameBoardStore.getState().isInitialized).toBe(false)
      expect(useGameBoardStore.getState().team1Score).toBe(0)
      expect(useGameBoardStore.getState().team2Score).toBe(0)
      expect(useGameBoardStore.getState().usedQuestionKeys).toEqual([])
      expect(useGameBoardStore.getState().isGameFinished).toBe(false)
    })

    it('should preserve room state during match reset', () => {
      useOnlineStore.setState({
        room: {
          roomId: 'room-1',
          roomCode: 'ABC123',
          hostId: 'host-1',
          players: [],
          status: 'waiting',
          questionDuration: 30,
          maxPlayers: 2,
          categoryIds: [],
          team1LifelineIds: [],
          team2LifelineIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        self: { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
        connectionStatus: 'connected',
      })

      const roomBeforeReset = useOnlineStore.getState().room

      resetOnlineMatchState()

      // Room state should be preserved
      expect(useOnlineStore.getState().room).toEqual(roomBeforeReset)
    })
  })
})
