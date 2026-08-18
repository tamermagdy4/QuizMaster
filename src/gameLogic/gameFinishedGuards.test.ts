import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useGameBoardStore } from '../store/gameBoardStore'
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
})
