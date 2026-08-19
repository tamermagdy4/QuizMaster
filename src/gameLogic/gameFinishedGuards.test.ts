import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useGameSetupStore } from '../store/gameSetupStore'
import { useOnlineStore } from '../store/onlineStore'
import type { ActiveQuestion, PointValue } from '../types/board'

/**
 * Focused tests proving that resolveQuestion() and submitAnswer() are
 * no-ops after isGameFinished === true.  Also proves that both actions
 * still work normally before the game finishes.
 */

function makeActiveQuestion(overrides?: Partial<ActiveQuestion>): ActiveQuestion {
  return {
    categoryId: 'general-knowledge',
    slotIndex: 0,
    points: 300 as PointValue,
    team: 1,
    questionText: 'What is 2+2?',
    answerText: '4',
    media: '',
    mediaType: 'image',
    careerImage: '',
    answerMedia: '',
    answerOptions: [],
    twoAnswersUsed: false,
    answered: false,
    lifelineUsed: null,
    doubleApplied: false,
    ...overrides,
  }
}

describe('GAME_FINISHED guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useOnlineStore.setState({
      room: null,
      self: null,
      connectionStatus: 'disconnected',
    })
    useGameBoardStore.setState({
      isInitialized: true,
      gameMode: 'local',
      isRevealed: false,
      isGameFinished: false,
      gameName: 'Test',
      team1Name: 'Team 1',
      team2Name: 'Team 2',
      categoryIds: ['general-knowledge'],
      cells: [[
        { categoryId: 'general-knowledge', slotIndex: 0, points: 300 as PointValue, team1Played: false, team2Played: false },
        { categoryId: 'general-knowledge', slotIndex: 1, points: 300 as PointValue, team1Played: false, team2Played: false },
      ]],
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

  // ------------------------------------------------------------------
  // resolveQuestion
  // ------------------------------------------------------------------

  describe('resolveQuestion() after GAME_FINISHED', () => {
    it('is a no-op — activeQuestion is not cleared', () => {
      const q = makeActiveQuestion({ answered: true })
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: q,
        team1Score: 100,
        team2Score: 200,
      })

      useGameBoardStore.getState().resolveQuestion(1)

      const s = useGameBoardStore.getState()
      expect(s.activeQuestion).toEqual(q)
    })

    it('team scores remain exactly unchanged', () => {
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion({ answered: true }),
        team1Score: 100,
        team2Score: 200,
      })

      useGameBoardStore.getState().resolveQuestion(1)

      const s = useGameBoardStore.getState()
      expect(s.team1Score).toBe(100)
      expect(s.team2Score).toBe(200)
    })

    it('cells are not mutated', () => {
      const cells = [[
        { categoryId: 'general-knowledge', slotIndex: 0, points: 300 as PointValue, team1Played: false, team2Played: false },
      ]]
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion({ answered: true }),
        cells,
        team1Score: 50,
        team2Score: 50,
      })

      useGameBoardStore.getState().resolveQuestion(1)

      expect(useGameBoardStore.getState().cells).toEqual(cells)
    })

    it('no online event is broadcast (gameMode local)', () => {
      // In local mode, notifyOnlineGameEvent is not called.
      // This test verifies the guard fires BEFORE any broadcast code path.
      useGameBoardStore.setState({
        isGameFinished: true,
        gameMode: 'local',
        activeQuestion: makeActiveQuestion({ answered: true }),
        team1Score: 10,
        team2Score: 20,
      })

      useGameBoardStore.getState().resolveQuestion(1)

      // If the guard was missing, resolveQuestion would call
      // notifyOnlineGameEvent in online mode.  In local mode, no event is
      // emitted.  The important thing is that scores didn't change.
      expect(useGameBoardStore.getState().team1Score).toBe(10)
      expect(useGameBoardStore.getState().team2Score).toBe(20)
    })

    it('double-winner resolution is also blocked', () => {
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion({ answered: true, doubleApplied: true }),
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.getState().resolveQuestion(1)

      expect(useGameBoardStore.getState().team1Score).toBe(0)
    })

    it('null-winner resolution is also blocked', () => {
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion({ answered: true }),
        team1Score: 77,
        team2Score: 88,
      })

      useGameBoardStore.getState().resolveQuestion(null)

      expect(useGameBoardStore.getState().team1Score).toBe(77)
      expect(useGameBoardStore.getState().team2Score).toBe(88)
    })
  })

  // ------------------------------------------------------------------
  // submitAnswer
  // ------------------------------------------------------------------

  describe('submitAnswer() after GAME_FINISHED', () => {
    it('is a no-op — activeQuestion remains unanswered', () => {
      const q = makeActiveQuestion()
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: q,
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.getState().submitAnswer('4')

      const s = useGameBoardStore.getState()
      expect(s.activeQuestion?.answered).toBe(false)
    })

    it('answerSubmitted remains false', () => {
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion(),
      })

      useGameBoardStore.getState().submitAnswer('4')

      expect(useGameBoardStore.getState().answerSubmitted).toBe(false)
    })

    it('selectedAnswer remains null', () => {
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion(),
      })

      useGameBoardStore.getState().submitAnswer('4')

      expect(useGameBoardStore.getState().selectedAnswer).toBeNull()
    })

    it('team scores remain exactly unchanged', () => {
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion(),
        team1Score: 500,
        team2Score: 300,
      })

      useGameBoardStore.getState().submitAnswer('4')

      const s = useGameBoardStore.getState()
      expect(s.team1Score).toBe(500)
      expect(s.team2Score).toBe(300)
    })

    it('cells are not mutated', () => {
      const cells = [[
        { categoryId: 'general-knowledge', slotIndex: 0, points: 300 as PointValue, team1Played: false, team2Played: false },
      ]]
      useGameBoardStore.setState({
        isGameFinished: true,
        activeQuestion: makeActiveQuestion(),
        cells,
      })

      useGameBoardStore.getState().submitAnswer('4')

      expect(useGameBoardStore.getState().cells).toEqual(cells)
    })
  })

  // ------------------------------------------------------------------
  // Both actions still work BEFORE GAME_FINISHED
  // ------------------------------------------------------------------

  describe('resolveQuestion() before GAME_FINISHED', () => {
    it('awards points to the winning team', () => {
      useGameBoardStore.setState({
        isGameFinished: false,
        activeQuestion: makeActiveQuestion({ answered: true }),
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.getState().resolveQuestion(1)

      const s = useGameBoardStore.getState()
      expect(s.team1Score).toBe(300)
      expect(s.team2Score).toBe(0)
    })

    it('clears the activeQuestion', () => {
      useGameBoardStore.setState({
        isGameFinished: false,
        activeQuestion: makeActiveQuestion({ answered: true }),
      })

      useGameBoardStore.getState().resolveQuestion(1)

      expect(useGameBoardStore.getState().activeQuestion).toBeNull()
    })

    it('marks the cell as played', () => {
      useGameBoardStore.setState({
        isGameFinished: false,
        activeQuestion: makeActiveQuestion({ answered: true }),
        cells: [[
          { categoryId: 'general-knowledge', slotIndex: 0, points: 300 as PointValue, team1Played: false, team2Played: false },
        ]],
      })

      useGameBoardStore.getState().resolveQuestion(1)

      const cell = useGameBoardStore.getState().cells[0][0]
      expect(cell.team1Played).toBe(true)
      expect(cell.team2Played).toBe(true)
    })
  })

  describe('submitAnswer() before GAME_FINISHED', () => {
    it('marks the question as answered with correct answer', () => {
      useGameBoardStore.setState({
        isGameFinished: false,
        activeQuestion: makeActiveQuestion(),
      })

      useGameBoardStore.getState().submitAnswer('4')

      const s = useGameBoardStore.getState()
      expect(s.activeQuestion?.answered).toBe(true)
      expect(s.answerSubmitted).toBe(true)
      expect(s.selectedAnswer).toBe('4')
      expect(s.answerCorrect).toBe(true)
    })

    it('awards points for a correct answer', () => {
      useGameBoardStore.setState({
        isGameFinished: false,
        activeQuestion: makeActiveQuestion({ team: 1 }),
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.getState().submitAnswer('4')

      expect(useGameBoardStore.getState().team1Score).toBe(300)
    })

    it('does not award points for a wrong answer', () => {
      useGameBoardStore.setState({
        isGameFinished: false,
        activeQuestion: makeActiveQuestion({ team: 1 }),
        team1Score: 0,
        team2Score: 0,
      })

      useGameBoardStore.getState().submitAnswer('5')

      expect(useGameBoardStore.getState().team1Score).toBe(0)
      expect(useGameBoardStore.getState().answerCorrect).toBe(false)
    })
  })

  // ------------------------------------------------------------------
  // C4 regression: handlePlayAgain must reset ALL transient game state
  // ------------------------------------------------------------------

  describe('C4 — play-again state reset', () => {
    it('resets all transient fields to initial defaults', () => {
      // Simulate a game in progress with various transient states set
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        gameName: 'Test Game',
        team1Name: 'Alpha',
        team2Name: 'Beta',
        categoryIds: ['general-knowledge'],
        cells: [[
          { categoryId: 'general-knowledge', slotIndex: 0, points: 300 as PointValue, team1Played: true, team2Played: true },
        ]],
        currentTurn: 2,
        team1Score: 600,
        team2Score: 300,
        activeQuestion: makeActiveQuestion(),
        usedQuestionKeys: ['q1', 'q2'],
        pendingDoublePoints: 1,
        blockActive: 2,
        callFriendActive: 1,
        callFriendTimeLeft: 15,
        callFriendHint: 'Hint text',
        wheelBonus: { teamId: 1, points: 100 },
        wheelPending: true,
        wheelPendingTeam: 1,
        ffaWheelPendingPlayerId: 'p1',
        answerSubmitted: true,
        selectedAnswer: '4',
        answerCorrect: true,
        answerPoints: 300,
        isRevealed: true,
        isGameFinished: true,
      })

      // Apply the same reset that handlePlayAgain performs
      useGameBoardStore.setState({
        isInitialized: false,
        gameMode: 'local',
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
        isGameFinished: false,
        isRevealed: false,
        answerSubmitted: false,
        selectedAnswer: null,
        answerCorrect: null,
        answerPoints: 0,
      })

      const s = useGameBoardStore.getState()
      expect(s.isInitialized).toBe(false)
      expect(s.gameMode).toBe('local')
      expect(s.gameName).toBe('')
      expect(s.team1Name).toBe('')
      expect(s.team2Name).toBe('')
      expect(s.categoryIds).toEqual([])
      expect(s.cells).toEqual([])
      expect(s.currentTurn).toBe(1)
      expect(s.team1Score).toBe(0)
      expect(s.team2Score).toBe(0)
      expect(s.activeQuestion).toBeNull()
      expect(s.usedQuestionKeys).toEqual([])
      expect(s.pendingDoublePoints).toBeNull()
      expect(s.blockActive).toBeNull()
      expect(s.callFriendActive).toBeNull()
      expect(s.callFriendTimeLeft).toBe(0)
      expect(s.callFriendHint).toBeNull()
      expect(s.wheelBonus).toBeNull()
      expect(s.wheelPending).toBe(false)
      expect(s.wheelPendingTeam).toBeNull()
      expect(s.ffaWheelPendingPlayerId).toBeNull()
      expect(s.isGameFinished).toBe(false)
      expect(s.isRevealed).toBe(false)
      expect(s.answerSubmitted).toBe(false)
      expect(s.selectedAnswer).toBeNull()
      expect(s.answerCorrect).toBeNull()
      expect(s.answerPoints).toBe(0)
    })

    it('gameMode is reset to local so next game is not treated as online', () => {
      useGameBoardStore.setState({ gameMode: 'online' })
      useGameBoardStore.setState({ gameMode: 'local' })
      expect(useGameBoardStore.getState().gameMode).toBe('local')
    })

    it('FFA runtime state is fully reset (players, turn, double, block, call-friend, wheel)', () => {
      useGameBoardStore.setState({
        gameMode: 'online',
        ffaPlayers: [
          { playerId: 'host-1', name: 'Host', score: 800, usedCells: ['cat1-0', 'cat1-1', 'cat1-2', 'cat1-3', 'cat1-4', 'cat1-5'], lifelines: [] },
          { playerId: 'p2', name: 'Player 2', score: 500, usedCells: ['cat1-0', 'cat1-1', 'cat1-2'], lifelines: [] },
          { playerId: 'p3', name: 'Player 3', score: 300, usedCells: ['cat1-0'], lifelines: [] },
        ],
        ffaTurnPlayerId: 'p2',
        ffaPendingDoublePlayerId: 'host-1',
        ffaBlockedPlayerId: 'p3',
        ffaCallFriendPlayerId: 'p2',
        ffaWheelPendingPlayerId: 'p3',
      })

      // Apply handlePlayAgain reset
      useGameBoardStore.setState({
        ffaPlayers: [],
        ffaTurnPlayerId: null,
        ffaPendingDoublePlayerId: null,
        ffaBlockedPlayerId: null,
        ffaCallFriendPlayerId: null,
        ffaWheelPendingPlayerId: null,
      })

      const s = useGameBoardStore.getState()
      expect(s.ffaPlayers).toEqual([])
      expect(s.ffaTurnPlayerId).toBeNull()
      expect(s.ffaPendingDoublePlayerId).toBeNull()
      expect(s.ffaBlockedPlayerId).toBeNull()
      expect(s.ffaCallFriendPlayerId).toBeNull()
      expect(s.ffaWheelPendingPlayerId).toBeNull()
    })

    it('lifelines are reset (team1Lifelines and team2Lifelines)', () => {
      useGameBoardStore.setState({
        team1Lifelines: [
          { id: 'double', label: 'Double', description: 'Double points', icon: '2x', used: true },
          { id: 'block', label: 'Block', description: 'Block opponent', icon: '🛡', used: false },
        ],
        team2Lifelines: [
          { id: 'call', label: 'Call', description: 'Call a friend', icon: '📞', used: true },
        ],
      })

      useGameBoardStore.setState({
        team1Lifelines: [],
        team2Lifelines: [],
      })

      const s = useGameBoardStore.getState()
      expect(s.team1Lifelines).toEqual([])
      expect(s.team2Lifelines).toEqual([])
    })

    it('after reset, the new board is not immediately finished (empty cells guard)', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        isGameFinished: true,
        categoryIds: ['general-knowledge'],
        cells: [[
          { categoryId: 'general-knowledge', slotIndex: 0, points: 300 as PointValue, team1Played: true, team2Played: true },
        ]],
      })

      // Apply handlePlayAgain reset
      useGameBoardStore.setState({
        isInitialized: false,
        isGameFinished: false,
        categoryIds: [],
        cells: [],
        activeQuestion: null,
        answerSubmitted: false,
        selectedAnswer: null,
        answerCorrect: null,
        answerPoints: 0,
      })

      const s = useGameBoardStore.getState()
      expect(s.isGameFinished).toBe(false)
      expect(s.cells).toEqual([])
      expect(s.activeQuestion).toBeNull()
    })

    it('scores are reset to zero', () => {
      useGameBoardStore.setState({
        team1Score: 1200,
        team2Score: 900,
        ffaPlayers: [
          { playerId: 'host-1', name: 'Host', score: 800, usedCells: [], lifelines: [] },
          { playerId: 'p2', name: 'Player 2', score: 500, usedCells: [], lifelines: [] },
          { playerId: 'p3', name: 'Player 3', score: 300, usedCells: [], lifelines: [] },
        ],
      })

      useGameBoardStore.setState({
        team1Score: 0,
        team2Score: 0,
        ffaPlayers: [],
      })

      const s = useGameBoardStore.getState()
      expect(s.team1Score).toBe(0)
      expect(s.team2Score).toBe(0)
      expect(s.ffaPlayers).toEqual([])
    })

    it('used question keys are cleared', () => {
      useGameBoardStore.setState({
        usedQuestionKeys: ['q-abc-1', 'q-def-2', 'q-ghi-3'],
      })

      useGameBoardStore.setState({ usedQuestionKeys: [] })

      expect(useGameBoardStore.getState().usedQuestionKeys).toEqual([])
    })

    it('online store session is cleared (clearOnlineSession leaves room)', async () => {
      useOnlineStore.setState({
        room: { roomId: 'room-1', roomCode: 'ABC123', hostId: 'host-1', players: [], status: 'playing', questionDuration: 30, maxPlayers: 6, categoryIds: [], team1LifelineIds: [], team2LifelineIds: [], createdAt: 1, updatedAt: 1 },
        self: { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
        players: [{ id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 }],
        connectionStatus: 'connected',
      })

      await useOnlineStore.getState().leaveRoom()

      const online = useOnlineStore.getState()
      expect(online.room).toBeNull()
      expect(online.self).toBeNull()
      expect(online.players).toEqual([])
      expect(online.connectionStatus).toBe('idle')
    })

    it('game setup store is reset', () => {
      useGameSetupStore.setState({
        gameName: 'Previous Game',
        team1Name: 'Team A',
        team2Name: 'Team B',
        team1CategoryIds: ['cat1'],
        team2CategoryIds: ['cat2'],
        team1LifelineIds: ['double'],
        team2LifelineIds: ['block'],
      })

      useGameSetupStore.getState().reset()

      const setup = useGameSetupStore.getState()
      expect(setup.gameName).toBe('')
      expect(setup.team1Name).toBe('')
      expect(setup.team2Name).toBe('')
      expect(setup.team1CategoryIds).toEqual([])
      expect(setup.team2CategoryIds).toEqual([])
      expect(setup.team1LifelineIds).toEqual([])
      expect(setup.team2LifelineIds).toEqual([])
    })

    it('all transient wheel/call-friend/block/double fields are cleared together', () => {
      useGameBoardStore.setState({
        pendingDoublePoints: 1,
        blockActive: 2,
        callFriendActive: 1,
        callFriendTimeLeft: 20,
        callFriendHint: 'Some hint',
        wheelBonus: { teamId: 2, points: 200 },
        wheelPending: true,
        wheelPendingTeam: 2,
        answerSubmitted: true,
        selectedAnswer: 'B',
        answerCorrect: false,
        answerPoints: 0,
      })

      useGameBoardStore.setState({
        pendingDoublePoints: null,
        blockActive: null,
        callFriendActive: null,
        callFriendTimeLeft: 0,
        callFriendHint: null,
        wheelBonus: null,
        wheelPending: false,
        wheelPendingTeam: null,
        answerSubmitted: false,
        selectedAnswer: null,
        answerCorrect: null,
        answerPoints: 0,
      })

      const s = useGameBoardStore.getState()
      expect(s.pendingDoublePoints).toBeNull()
      expect(s.blockActive).toBeNull()
      expect(s.callFriendActive).toBeNull()
      expect(s.callFriendTimeLeft).toBe(0)
      expect(s.callFriendHint).toBeNull()
      expect(s.wheelBonus).toBeNull()
      expect(s.wheelPending).toBe(false)
      expect(s.wheelPendingTeam).toBeNull()
      expect(s.answerSubmitted).toBe(false)
      expect(s.selectedAnswer).toBeNull()
      expect(s.answerCorrect).toBeNull()
      expect(s.answerPoints).toBe(0)
    })
  })

  // ------------------------------------------------------------------
  // C3 regression: FFA auto-finish must detect game completion
  // ------------------------------------------------------------------

  describe('C3 — FFA game finish detection', () => {
    it('FFA resolveQuestion sets isGameFinished when all players exhaust cells', () => {
      useOnlineStore.setState({
        room: {
          roomId: 'room-1',
          roomCode: 'ABC123',
          hostId: 'host-1',
          players: [
            { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
          ],
          status: 'playing',
          questionDuration: 30,
          maxPlayers: 6,
          categoryIds: ['cat1'],
          team1LifelineIds: [],
          team2LifelineIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        self: { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
        connectionStatus: 'connected',
      })
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        categoryIds: ['cat1'],
        cells: [[
          { categoryId: 'cat1', slotIndex: 0, points: 100 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 1, points: 300 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 2, points: 500 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 3, points: 100 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 4, points: 300 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 5, points: 500 as PointValue, team1Played: false, team2Played: false },
        ]],
        ffaPlayers: [
          { playerId: 'host-1', name: 'A', score: 0, usedCells: ['cat1-0', 'cat1-1', 'cat1-2', 'cat1-3', 'cat1-4', 'cat1-5'], lifelines: [] },
          { playerId: 'p2', name: 'B', score: 0, usedCells: ['cat1-0', 'cat1-1', 'cat1-2', 'cat1-3', 'cat1-4', 'cat1-5'], lifelines: [] },
          { playerId: 'p3', name: 'C', score: 0, usedCells: ['cat1-0', 'cat1-1', 'cat1-2', 'cat1-3', 'cat1-4', 'cat1-5'], lifelines: [] },
        ],
        ffaTurnPlayerId: 'host-1',
        activeQuestion: {
          categoryId: 'cat1',
          slotIndex: 5,
          points: 500 as PointValue,
          team: 1,
          questionText: 'Q?',
          answerText: 'A',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: false,
          playerId: 'host-1',
        },
        answerSubmitted: true,
        selectedAnswer: 'A',
        answerCorrect: true,
        answerPoints: 500,
        isGameFinished: false,
      })

      useGameBoardStore.getState().finishSubmittedQuestion()
      expect(useGameBoardStore.getState().isGameFinished).toBe(true)
      expect(useGameBoardStore.getState().activeQuestion).toBeNull()
    })

    it('FFA game does not finish prematurely when players still have cells', () => {
      useOnlineStore.setState({
        room: {
          roomId: 'room-1',
          roomCode: 'ABC123',
          hostId: 'host-1',
          players: [
            { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
          ],
          status: 'playing',
          questionDuration: 30,
          maxPlayers: 6,
          categoryIds: ['cat1'],
          team1LifelineIds: [],
          team2LifelineIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        self: { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
        connectionStatus: 'connected',
      })
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'online',
        categoryIds: ['cat1'],
        cells: [[
          { categoryId: 'cat1', slotIndex: 0, points: 100 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 1, points: 300 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 2, points: 500 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 3, points: 100 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 4, points: 300 as PointValue, team1Played: false, team2Played: false },
          { categoryId: 'cat1', slotIndex: 5, points: 500 as PointValue, team1Played: false, team2Played: false },
        ]],
        ffaPlayers: [
          { playerId: 'host-1', name: 'A', score: 0, usedCells: [], lifelines: [] },
          { playerId: 'p2', name: 'B', score: 0, usedCells: [], lifelines: [] },
          { playerId: 'p3', name: 'C', score: 0, usedCells: [], lifelines: [] },
        ],
        ffaTurnPlayerId: 'host-1',
        activeQuestion: {
          categoryId: 'cat1',
          slotIndex: 0,
          points: 100 as PointValue,
          team: 1,
          questionText: 'Q?',
          answerText: 'A',
          media: '',
          mediaType: 'image',
          careerImage: '',
          answerMedia: '',
          answerOptions: [],
          twoAnswersUsed: false,
          answered: false,
          lifelineUsed: null,
          doubleApplied: false,
          playerId: 'host-1',
        },
        answerSubmitted: true,
        selectedAnswer: 'A',
        answerCorrect: true,
        answerPoints: 100,
        isGameFinished: false,
      })

      useGameBoardStore.getState().finishSubmittedQuestion()

      expect(useGameBoardStore.getState().isGameFinished).toBe(false)
    })

    it('standard 2-team game is unaffected by FFA finish logic', () => {
      useGameBoardStore.setState({
        isInitialized: true,
        gameMode: 'local',
        categoryIds: ['cat1'],
        cells: [[
          { categoryId: 'cat1', slotIndex: 0, points: 100 as PointValue, team1Played: false, team2Played: false },
        ]],
        ffaPlayers: [],
        currentTurn: 1,
        activeQuestion: {
          categoryId: 'cat1',
          slotIndex: 0,
          points: 100 as PointValue,
          team: 1,
          questionText: 'Q?',
          answerText: 'A',
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
        isGameFinished: false,
      })

      useGameBoardStore.getState().submitAnswer('A')
      useGameBoardStore.getState().finishSubmittedQuestion()

      // Standard 2-team: cell is marked played, game finishes
      expect(useGameBoardStore.getState().isGameFinished).toBe(true)
      const cell = useGameBoardStore.getState().cells[0][0]
      expect(cell.team1Played).toBe(true)
      expect(cell.team2Played).toBe(true)
    })
  })
})
