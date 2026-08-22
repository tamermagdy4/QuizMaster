import { describe, expect, it } from 'vitest'
import {
  isLifelineId,
  isPointValue,
  isScore,
  isSlotIndex,
  isTeamId,
  isValidActiveQuestion,
  isValidBoardCell,
  isValidFfaPlayer,
  isValidOnlineEventPayload,
  isValidResolvedQuestion,
  isValidRoomSnapshot,
  isGameMode,
} from './contracts'
import { isOnlineGameEvent, type OnlineGameEvent } from '../types/online'
import type { ActiveQuestion, BoardCell, FfaPlayerState } from '../types/board'
import { ensureLocalQuestionsLoaded, getQuestionEntriesByPoints, hasQuestionEntries } from '../data/questionLoader'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useOnlineStore } from '../store/onlineStore'

// ---------------------------------------------------------------------------
// Helpers — build minimal but valid domain objects
// ---------------------------------------------------------------------------

/**
 * NOTE: the helpers accept raw `unknown` overrides and cast the result — the
 * compile-time types would reject invalid values like `points: 200`, but the
 * whole point of the RUNTIME guards is to catch exactly that kind of data
 * when it arrives untyped from the network / localStorage. Casting through
 * `unknown` deliberately reproduces the untrusted boundary.
 */
function makeCell(overrides: Record<string, unknown> = {}): BoardCell {
  return {
    categoryId: 'general-knowledge',
    slotIndex: 0,
    points: 500,
    team1Played: false,
    team2Played: false,
    ...overrides,
  } as unknown as BoardCell
}

function makeActiveQuestion(overrides: Record<string, unknown> = {}): ActiveQuestion {
  return {
    categoryId: 'general-knowledge',
    slotIndex: 0,
    points: 300,
    team: 1,
    questionText: 'ما عاصمة فرنسا؟',
    answerText: 'باريس',
    media: '',
    mediaType: 'image',
    careerImage: '',
    answerMedia: '',
    hint: '',
    answerOptions: [],
    twoAnswersUsed: false,
    answered: false,
    lifelineUsed: null,
    doubleApplied: false,
    ...overrides,
  } as unknown as ActiveQuestion
}

function makeFfaPlayer(overrides: Record<string, unknown> = {}): FfaPlayerState {
  return {
    playerId: 'player-1',
    name: 'سارة',
    score: 0,
    usedCells: [],
    lifelines: [],
    ...overrides,
  } as unknown as FfaPlayerState
}

function event(type: string, extra: Record<string, unknown> = {}): unknown {
  return {
    type,
    roomId: 'room-1',
    playerId: 'host-1',
    sequence: 1,
    timestamp: 1,
    payload: {},
    ...extra,
  }
}

function validRoom() {
  return {
    roomId: 'room-1',
    roomCode: 'ABC123',
    hostId: 'host-1',
    players: [{ id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 }],
    status: 'waiting',
    questionDuration: 30,
    maxPlayers: 2,
    categoryIds: [],
    team1LifelineIds: [],
    team2LifelineIds: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

// ---------------------------------------------------------------------------
// Question contracts
// ---------------------------------------------------------------------------

describe('question contracts', () => {
  it('accepts the only valid point values 100 | 300 | 500', () => {
    expect(isPointValue(100)).toBe(true)
    expect(isPointValue(300)).toBe(true)
    expect(isPointValue(500)).toBe(true)
  })

  it('rejects an invalid question point value', () => {
    expect(isPointValue(200)).toBe(false)
    expect(isPointValue(0)).toBe(false)
    expect(isPointValue(600)).toBe(false)
    expect(isPointValue('100')).toBe(false)
    expect(isPointValue(null)).toBe(false)
  })

  it('rejects a resolved question without an id', () => {
    expect(isValidResolvedQuestion({ id: 'q1', categoryId: 'general-knowledge', question: 'x', answer: 'y' })).toBe(true)
    expect(isValidResolvedQuestion({ categoryId: 'general-knowledge', question: 'x', answer: 'y' })).toBe(false)
    expect(isValidResolvedQuestion({ id: '', categoryId: 'general-knowledge', question: 'x', answer: 'y' })).toBe(false)
  })

  it('rejects a resolved question in an invalid category or with invalid points', () => {
    expect(isValidResolvedQuestion({ id: 'q1', categoryId: '', question: 'x', answer: 'y' })).toBe(false)
    expect(isValidResolvedQuestion({ id: 'q1', categoryId: 'general-knowledge', points: 250, question: 'x', answer: 'y' })).toBe(false)
  })

  it('the loader only yields questions with ids and no invalid points', async () => {
    await ensureLocalQuestionsLoaded()
    const entries = getQuestionEntriesByPoints('general-knowledge', 300)
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.id).toBeTruthy()
      if (entry.points !== undefined) expect(isPointValue(entry.points)).toBe(true)
    }
    // Duplicate identity is impossible: ids are unique within a category.
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length)
  })

  it('an unknown category has no question entries', () => {
    expect(hasQuestionEntries('general-knowledge')).toBe(true)
    expect(hasQuestionEntries('does-not-exist-xyz')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Game entity contracts
// ---------------------------------------------------------------------------

describe('game entity contracts', () => {
  it('accepts only team ids 1 and 2', () => {
    expect(isTeamId(1)).toBe(true)
    expect(isTeamId(2)).toBe(true)
    expect(isTeamId(0)).toBe(false)
    expect(isTeamId(3)).toBe(false)
    expect(isTeamId('1')).toBe(false)
  })

  it('accepts only the five lifeline ids', () => {
    for (const id of ['double', 'two-answers', 'block', 'call', 'wheel']) expect(isLifelineId(id)).toBe(true)
    expect(isLifelineId('magic')).toBe(false)
  })

  it('accepts only local | online game modes', () => {
    expect(isGameMode('local')).toBe(true)
    expect(isGameMode('online')).toBe(true)
    expect(isGameMode('pvp')).toBe(false)
  })

  it('scores are finite integers and MAY be negative (wheel deductions)', () => {
    expect(isScore(0)).toBe(true)
    expect(isScore(-150)).toBe(true)
    expect(isScore(300)).toBe(true)
    expect(isScore(Number.NaN)).toBe(false)
    expect(isScore(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isScore('5')).toBe(false)
    expect(isScore(null)).toBe(false)
  })

  it('slot indices are integers within the 6-slot category column', () => {
    for (let index = 0; index < 6; index += 1) expect(isSlotIndex(index)).toBe(true)
    expect(isSlotIndex(6)).toBe(false)
    expect(isSlotIndex(-1)).toBe(false)
    expect(isSlotIndex(1.5)).toBe(false)
  })

  it('validates a board cell', () => {
    expect(isValidBoardCell(makeCell())).toBe(true)
    expect(isValidBoardCell(makeCell({ points: 200 }))).toBe(false)
    expect(isValidBoardCell(makeCell({ slotIndex: 9 }))).toBe(false)
    expect(isValidBoardCell(makeCell({ categoryId: '' }))).toBe(false)
    expect(isValidBoardCell(null)).toBe(false)
  })

  it('validates an active question', () => {
    expect(isValidActiveQuestion(makeActiveQuestion())).toBe(true)
    expect(isValidActiveQuestion(makeActiveQuestion({ points: 250 }))).toBe(false)
    expect(isValidActiveQuestion(makeActiveQuestion({ team: 3 }))).toBe(false)
    expect(isValidActiveQuestion(makeActiveQuestion({ questionText: '' }))).toBe(false)
  })

  it('validates an ffa player state', () => {
    expect(isValidFfaPlayer(makeFfaPlayer())).toBe(true)
    expect(isValidFfaPlayer(makeFfaPlayer({ score: Number.POSITIVE_INFINITY }))).toBe(false)
    expect(isValidFfaPlayer(makeFfaPlayer({ playerId: '' }))).toBe(false)
    expect(isValidFfaPlayer(null)).toBe(false)
  })

  it('validates a room snapshot', () => {
    expect(isValidRoomSnapshot(validRoom())).toBe(true)
    expect(isValidRoomSnapshot({ ...validRoom(), hostId: '' })).toBe(false)
    expect(isValidRoomSnapshot({ ...validRoom(), status: 'bogus' })).toBe(false)
    expect(isValidRoomSnapshot({ ...validRoom(), maxPlayers: 99 })).toBe(false)
    expect(isValidRoomSnapshot({ ...validRoom(), questionDuration: 45 })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Online event payload contracts (untrusted boundary)
// ---------------------------------------------------------------------------

describe('online event payload contracts', () => {
  it('accepts a valid QUESTION_SELECTED and rejects a forged one', () => {
    const valid = event('QUESTION_SELECTED', {
      payload: { categoryId: 'general-knowledge', slotIndex: 0, points: 300, team: 1, questionId: 'q1', doubleApplied: false },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(valid)).toBe(true)

    const badPoints = event('QUESTION_SELECTED', {
      payload: { categoryId: 'general-knowledge', slotIndex: 0, points: 250, team: 1, questionId: 'q1', doubleApplied: false },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(badPoints)).toBe(false)

    const badTeam = event('QUESTION_SELECTED', {
      payload: { categoryId: 'general-knowledge', slotIndex: 0, points: 300, team: 3, questionId: 'q1', doubleApplied: false },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(badTeam)).toBe(false)
  })

  it('rejects an invalid lifeline id', () => {
    const valid = event('LIFELINE_USED', {
      payload: { team: 1, lifelineId: 'double', doubleApplied: true },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(valid)).toBe(true)

    const forged = event('LIFELINE_USED', {
      payload: { team: 1, lifelineId: 'magic' },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(forged)).toBe(false)
  })

  it('validates TEAM_ANSWER_SUBMITTED payloads correctly', () => {
    const valid = event('TEAM_ANSWER_SUBMITTED', {
      payload: { team: 2, answer: 'Cairo', playerId: 'player-2' },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(valid)).toBe(true)

    const badTeam = event('TEAM_ANSWER_SUBMITTED', {
      payload: { team: 3, answer: 'Cairo' },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(badTeam)).toBe(false)
  })

  it('rejects a score update with a non-finite score (no client-controlled 999999/Infinity)', () => {
    const valid = event('SCORE_UPDATED', {
      payload: { team1Score: 0, team2Score: -150, questionClosed: true },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(valid)).toBe(true)

    const infinite = event('SCORE_UPDATED', {
      payload: { team1Score: Number.POSITIVE_INFINITY, team2Score: 0, questionClosed: true },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(infinite)).toBe(false)

    const absurd = event('SCORE_UPDATED', {
      payload: { team1Score: 999999, team2Score: 0, questionClosed: true },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(absurd)).toBe(true)
  })

  it('validates the turn change and the finished event', () => {
    const turn = event('TURN_CHANGED', { payload: { currentTurn: 2 } }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(turn)).toBe(true)

    const badTurn = event('TURN_CHANGED', { payload: { currentTurn: 3 } }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(badTurn)).toBe(false)

    const finished = event('GAME_FINISHED', {
      payload: { winner: null, team1Score: -150, team2Score: 300 },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(finished)).toBe(true)
  })

  it('validates room snapshots inside ROOM_STATE / GAME_CREATED', () => {
    const roomState = event('ROOM_STATE', { payload: { room: validRoom() } }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(roomState)).toBe(true)

    const forged = event('ROOM_STATE', {
      payload: { room: { ...validRoom(), hostId: '' } },
    }) as OnlineGameEvent
    expect(isValidOnlineEventPayload(forged)).toBe(false)
  })

  it('rejects an unknown event type at the payload layer (two-layer guard)', () => {
    // The envelope guard is shape-lenient (any string type passes) — the
    // unknown-type rejection happens in the payload contract, which is the
    // second layer of the same chokepoint.
    const unknown = event('HACK_THE_GAME', { payload: { score: 999999 } }) as OnlineGameEvent
    expect(isOnlineGameEvent(unknown)).toBe(true)
    expect(isValidOnlineEventPayload(unknown)).toBe(false)
    // A structurally broken envelope is rejected at the first layer.
    expect(isOnlineGameEvent({ type: 'QUESTION_SELECTED' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Game state invariants (behavioral — proven against the real store)
// ---------------------------------------------------------------------------

describe('game state invariants', () => {
  it('cannot finish a question that is not active', () => {
    useGameBoardStore.setState({
      isInitialized: true,
      gameMode: 'local',
      team1Score: 100,
      team2Score: 50,
      activeQuestion: null,
    })
    useGameBoardStore.getState().resolveQuestion(1)
    const state = useGameBoardStore.getState()
    expect(state.team1Score).toBe(100)
    expect(state.team2Score).toBe(50)
  })

  it('cannot submit an answer without an active question', () => {
    useGameBoardStore.setState({ activeQuestion: null, answerSubmitted: false })
    useGameBoardStore.getState().submitAnswer('باريس')
    expect(useGameBoardStore.getState().answerSubmitted).toBe(false)
  })

  it('cannot finish the game twice or double-apply a score', () => {
    useGameBoardStore.setState({
      isInitialized: true,
      gameMode: 'local',
      currentTurn: 1,
      team1Score: 0,
      team2Score: 0,
      categoryIds: ['general-knowledge'],
      cells: [[makeCell()]],
      activeQuestion: makeActiveQuestion({ points: 500 }),
      isGameFinished: false,
    })
    useGameBoardStore.getState().resolveQuestion(1)
    const afterFirst = useGameBoardStore.getState()
    expect(afterFirst.team1Score).toBe(500)
    expect(afterFirst.isGameFinished).toBe(true)
    // The question is closed — resolving again must be a no-op.
    useGameBoardStore.getState().resolveQuestion(1)
    expect(useGameBoardStore.getState().team1Score).toBe(500)
  })

  it('cannot select a question that was already used', () => {
    useGameBoardStore.setState({
      isInitialized: true,
      gameMode: 'local',
      currentTurn: 1,
      categoryIds: ['general-knowledge'],
      cells: [[makeCell({ team1Played: true, team2Played: true })]],
    })
    expect(useGameBoardStore.getState().selectQuestion('general-knowledge', 0)).toBeNull()
  })

  it('cannot select a question when it is not the player turn (online)', () => {
    useOnlineStore.setState({
      room: { hostId: 'host-1' } as unknown as ReturnType<typeof useOnlineStore.getState>['room'],
      self: { id: 'player-2', name: 'Player 2', isHost: false } as ReturnType<typeof useOnlineStore.getState>['self'],
    })
    useGameBoardStore.setState({
      isInitialized: true,
      gameMode: 'online',
      currentTurn: 1,
      categoryIds: ['general-knowledge'],
      cells: [[makeCell()]],
      ffaPlayers: [],
    })
    // The local client is team 2 but the turn belongs to team 1.
    expect(useGameBoardStore.getState().selectQuestion('general-knowledge', 0)).toBeNull()
  })

  it('cannot use a lifeline after the question has been answered', () => {
    useGameBoardStore.setState({
      isInitialized: true,
      gameMode: 'local',
      team1Lifelines: [{ id: 'double', label: 'مضاعفة النقاط', description: '', icon: '✕2', used: false }],
      activeQuestion: makeActiveQuestion({ answered: true, lifelineUsed: null }),
    })
    useGameBoardStore.getState().useLifeline('double')
    const lifeline = useGameBoardStore.getState().team1Lifelines[0]
    expect(lifeline.used).toBe(false)
  })
})
