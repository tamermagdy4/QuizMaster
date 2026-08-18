/**
 * Test Fixtures for QuizMaster
 * 
 * Provides helper functions to create test data objects for unit tests.
 * These fixtures are designed to be minimal but complete, avoiding
 * giant fixtures that make tests dependent on irrelevant details.
 */

import type { GameCategory } from '../types/game'
import type { ActiveQuestion, BoardCell, FfaPlayerState, Lifeline, PointValue } from '../types/board'
import type { OnlineGameEvent, OnlineRoom } from '../types/online'

// ---------------------------------------------------------------------------
// Game Fixtures
// ---------------------------------------------------------------------------

export function createGameCategory(overrides: Partial<GameCategory> = {}): GameCategory {
  return {
    id: 'test-category',
    title: 'Test Category',
    icon: '🧪',
    image: '🧪',
    description: 'Test category for unit tests',
    questionCount: 150,
    difficulty: 'easy',
    sectionId: 'test',
    gradient: 'from-blue-500/70 via-indigo-600/50 to-violet-900/70',
    accent: '#8b6fff',
    ...overrides,
  }
}

export function createBoardCell(overrides: Partial<BoardCell> = {}): BoardCell {
  return {
    categoryId: 'test-category',
    slotIndex: 0,
    points: 100,
    team1Played: false,
    team2Played: false,
    ...overrides,
  }
}

export function createBoardCells(categoryIds: string[]): BoardCell[][] {
  return categoryIds.map(categoryId =>
    [100, 300, 100, 100, 300, 500].map((points, slotIndex) =>
      createBoardCell({ categoryId, slotIndex, points: points as PointValue })
    )
  )
}

// ---------------------------------------------------------------------------
// Question Fixtures
// ---------------------------------------------------------------------------

export function createActiveQuestion(overrides: Partial<ActiveQuestion> = {}): ActiveQuestion {
  return {
    categoryId: 'test-category',
    slotIndex: 0,
    points: 100,
    team: 1,
    questionText: 'Test question text',
    answerText: 'Test answer text',
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

export function createQuestionItem(overrides: any = {}) {
  return {
    id: 'test-question-1',
    question: 'Test question',
    answer: 'Test answer',
    points: 100,
    media: '',
    image: '',
    mediaType: 'image',
    hint: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Player & Team Fixtures
// ---------------------------------------------------------------------------

export function createLifeline(id: string = 'double', overrides: Partial<Lifeline> = {}): Lifeline {
  const labels: Record<string, string> = {
    double: 'Double Points',
    'two-answers': 'Two Answers',
    block: 'Block',
    call: 'Call Friend',
    wheel: 'Wheel of Fortune',
  }

  const icons: Record<string, string> = {
    double: '✕2',
    'two-answers': 'A+B',
    block: '🚫',
    call: '📞',
    wheel: '🎡',
  }

  return {
    id: id as any,
    label: labels[id] || 'Lifeline',
    description: `${labels[id] || 'Lifeline'} description`,
    icon: icons[id] || '❓',
    used: false,
    ...overrides,
  }
}

export function createFfaPlayer(overrides: Partial<FfaPlayerState> = {}): FfaPlayerState {
  return {
    playerId: 'player-1',
    name: 'Test Player',
    score: 0,
    usedCells: [],
    lifelines: [],
    ...overrides,
  }
}

export function createFfaPlayers(count: number): FfaPlayerState[] {
  return Array.from({ length: count }, (_, i) =>
    createFfaPlayer({ playerId: `player-${i + 1}`, name: `Player ${i + 1}` })
  )
}

// ---------------------------------------------------------------------------
// Online Game Fixtures
// ---------------------------------------------------------------------------

export function createOnlineRoom(overrides: Partial<OnlineRoom> = {}): OnlineRoom {
  return {
    roomId: 'room-1',
    roomCode: 'ABC123',
    hostId: 'host-1',
    players: [
      { id: 'host-1', name: 'Host', isHost: true, connected: true, joinedAt: 1 },
    ],
    status: 'waiting',
    questionDuration: 30,
    maxPlayers: 2,
    categoryIds: [],
    team1LifelineIds: [],
    team2LifelineIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

export function createOnlineEvent(
  type: OnlineGameEvent['type'],
  overrides: Partial<OnlineGameEvent> = {}
): OnlineGameEvent {
  const baseEvent: OnlineGameEvent = {
    type,
    roomId: 'room-1',
    playerId: 'player-1',
    sequence: 1,
    timestamp: 1,
    payload: {} as any,
  }

  // Add type-specific payloads
  switch (type) {
    case 'QUESTION_SELECTED':
      baseEvent.payload = {
        categoryId: 'test-category',
        slotIndex: 0,
        points: 100,
        team: 1,
        questionId: 'q1',
        doubleApplied: false,
      } as any
      break
    case 'ANSWER_REVEALED':
      baseEvent.payload = { revealed: true } as any
      break
    case 'SCORE_UPDATED':
      baseEvent.payload = {
        team1Score: 100,
        team2Score: 50,
        questionClosed: true,
      } as any
      break
    case 'TURN_CHANGED':
      baseEvent.payload = { currentTurn: 2 } as any
      break
    case 'LIFELINE_USED':
      baseEvent.payload = {
        team: 1,
        lifelineId: 'double',
        doubleApplied: true,
      } as any
      break
    case 'GAME_FINISHED':
      baseEvent.payload = {
        winner: 1,
        team1Score: 1000,
        team2Score: 500,
      } as any
      break
    case 'ROOM_STATE':
    case 'GAME_CREATED':
      baseEvent.payload = {
        room: createOnlineRoom(),
      } as any
      break
    case 'PLAYER_JOINED':
      baseEvent.payload = {
        player: { id: 'player-2', name: 'Player 2', isHost: false, connected: true, joinedAt: 1 },
      } as any
      break
    case 'PLAYER_LEFT':
    case 'PLAYER_LEFT_ROOM':
      baseEvent.payload = { playerId: 'player-2' } as any
      break
    case 'GAME_STARTED':
      baseEvent.payload = {
        gameName: 'Test Game',
        questionDuration: 30,
        players: [],
      } as any
      break
    case 'GAME_STATE_SYNC':
      baseEvent.payload = {
        matchId: 'match-1',
        currentTurn: 1,
        team1Score: 100,
        team2Score: 50,
        cells: [],
        answerPoints: 100,
      } as any
      break
    case 'SYNC_REQUEST':
      baseEvent.payload = {} as any
      break
  }

  return { ...baseEvent, ...overrides } as OnlineGameEvent
}

// ---------------------------------------------------------------------------
// Store State Fixtures
// ---------------------------------------------------------------------------

export function createGameBoardState(overrides: any = {}) {
  return {
    isInitialized: false,
    gameMode: 'local' as const,
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
    ...overrides,
  }
}

export function createOnlineStoreState(overrides: any = {}) {
  return {
    room: null,
    self: null,
    connectionStatus: 'disconnected' as const,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Creates a set of used question keys for testing
 */
export function createUsedQuestionKeys(categoryId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `${categoryId}-${100 + (i % 5) * 200}-${i}`
  )
}

/**
 * Creates a minimal but valid question collection
 */
export function createQuestionCollection(categoryId: string, questionCount: number = 10) {
  const questions = Array.from({ length: questionCount }, (_, i) => {
    const points = [100, 300, 500][i % 3] as PointValue
    return createQuestionItem({
      id: `${categoryId}-${points}-${i}`,
      question: `Question ${i}`,
      answer: `Answer ${i}`,
      points,
    })
  })

  return {
    categoryId,
    questions,
    metadata: {
      sectionId: 'test',
      updatedAt: new Date().toISOString(),
      status: 'ready',
    },
  }
}

/**
 * Resets a store to its initial state
 * This is useful for test isolation
 */
export function resetStore(store: any, initialState: any) {
  store.setState(initialState)
}

// ---------------------------------------------------------------------------
// Scenario Fixtures
// ---------------------------------------------------------------------------

/**
 * Creates a complete game scenario for testing
 */
export function createGameScenario(overrides: any = {}) {
  const categoryIds = ['general-knowledge', 'science', 'technology']
  
  return {
    gameName: 'Test Game',
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    team1CategoryIds: categoryIds.slice(0, 3),
    team2CategoryIds: categoryIds.slice(0, 3),
    team1LifelineIds: ['double'] as any[],
    team2LifelineIds: ['block'] as any[],
    activeTeam: 1,
    ...overrides,
  }
}

/**
 * Creates an online game scenario for testing
 */
export function createOnlineGameScenario(overrides: any = {}) {
  return {
    room: createOnlineRoom({
      status: 'playing',
      categoryIds: ['general-knowledge', 'science'],
      team1LifelineIds: ['double'],
      team2LifelineIds: ['block'],
    }),
    self: { id: 'player-1', name: 'Player 1', isHost: true, connected: true, joinedAt: 1 },
    connectionStatus: 'connected' as const,
    ...overrides,
  }
}

/**
 * Creates a finished game scenario
 */
export function createFinishedGameScenario(overrides: any = {}) {
  return {
    isInitialized: true,
    gameMode: 'local' as const,
    isGameFinished: true,
    team1Score: 1000,
    team2Score: 800,
    categoryIds: ['general-knowledge'],
    cells: createBoardCells(['general-knowledge']).map(column =>
      column.map(cell => ({ ...cell, team1Played: true, team2Played: true }))
    ),
    ...overrides,
  }
}
