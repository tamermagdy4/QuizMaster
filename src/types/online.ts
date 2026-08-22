import type { BoardCell, FfaPlayerState, Lifeline, LifelineId, PointValue } from './board'
import type { TeamId } from './game'

/**
 * Lifecycle status of an online game room.
 * `cancelled` is set when a player intentionally leaves the room — the
 * whole match is void and the other player is sent back to the online hub.
 */
export type OnlineRoomStatus = 'waiting' | 'playing' | 'finished' | 'cancelled'

/**
 * Per-question countdown chosen by the HOST when creating the room
 * (15 / 30 / 60 seconds). The host is the sole authority for this value.
 */
export type OnlineQuestionDuration = 15 | 30 | 60

/**
 * How many players the HOST allows in the room when creating it (2-6).
 * The joiner cannot change this value; the host is the authority.
 */
export type OnlineMaxPlayers = 2 | 3 | 4 | 5 | 6

/**
 * Connection status of the Realtime channel, surfaced to the UI.
 */
export type OnlineConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

/**
 * A player participating in an online room.
 *
 * `connected` is derived from Supabase Presence: a player who drops the
 * connection (or closes the tab) disappears from presence and is marked
 * as disconnected locally without leaving the room.
 */
export interface OnlinePlayer {
  id: string
  name: string
  isHost: boolean
  connected: boolean
  joinedAt: number
}

/**
 * Authoritative room state. Owned by the host and shared with the rest of
 * the room through `ROOM_STATE` broadcasts so every client converges.
 */
export interface OnlineRoom {
  roomId: string
  roomCode: string
  hostId: string
  gameName?: string
  players: OnlinePlayer[]
  status: OnlineRoomStatus
  /** Question countdown in seconds, set by the host at room creation. */
  questionDuration: OnlineQuestionDuration
  /**
   * Maximum players the host allows in this room (2-6). A room never
   * accepts more joiners than this value.
   */
  maxPlayers: OnlineMaxPlayers
  /**
   * The 6 categories the HOST chose for the match. Shared by everyone in
   * the room; a fresh room always starts with an empty list so no previous
   * match's categories can leak into a new room.
   */
  categoryIds: string[]
  /**
   * The 3 lifelines the HOST chose for each team in the lobby before the
   * match starts. Selected ≠ used: these are the configured lifelines; the
   * in-game `used` state lives on the board store per team/player.
   */
  team1LifelineIds: LifelineId[]
  team2LifelineIds: LifelineId[]
  createdAt: number
  updatedAt: number
}

/**
 * Payload tracked via Supabase Presence for each connected client in the
 * room channel. Presence is the source of truth for "who is online now".
 */
export interface OnlinePresenceState {
  playerId: string
  name: string
  isHost: boolean
  onlineAt: number
}

/**
 * The board configuration shared by both online clients so their GameBoards
 * are identical. Built by the host at game start and applied locally on both
 * sides through the existing `gameSetupStore` / `gameBoardStore`.
 */
export interface OnlineBoardSnapshot {
  gameName: string
  team1Name: string
  team2Name: string
  team1CategoryIds: string[]
  team2CategoryIds: string[]
  team1LifelineIds: LifelineId[]
  team2LifelineIds: LifelineId[]
  /** Question countdown chosen by the host; applied on both clients. */
  questionDuration: OnlineQuestionDuration
  /**
   * All players in the room (2-6). Free-for-all (3+ players) uses this list;
   * the 2-player path keeps using the team1/team2 fields above.
   * `lifelineIds` are the per-player lifelines for free-for-all games.
   */
  players: { id: string; name: string; lifelineIds?: LifelineId[] }[]
}

/**
 * Catalogue of every online game event.
 *
 * `GAME_CREATED`, `PLAYER_JOINED`, `PLAYER_LEFT`, `GAME_STARTED` and
 * `GAME_FINISHED` are room-lifecycle events. The remaining events
 * (`TURN_CHANGED`, `QUESTION_SELECTED`, `ANSWER_REVEALED`, `SCORE_UPDATED`,
 * `LIFELINE_USED`) are gameplay events prepared for the next phase — they
 * are typed now so the wire protocol is stable, but nothing dispatches or
 * consumes them yet. `ROOM_STATE` is an internal reconciliation event sent
 * by the host to sync late joiners.
 */
export interface OnlineEventMap {
  GAME_CREATED: { room: OnlineRoom }
  PLAYER_JOINED: { player: OnlinePlayer }
  PLAYER_LEFT: { playerId: string }
  /** Intentional leave: the whole room is cancelled and the other player is ejected. */
  PLAYER_LEFT_ROOM: { playerId: string; team: TeamId; reason: 'left' }
  GAME_STARTED: { startedAt: number; board: OnlineBoardSnapshot }
  TURN_CHANGED: { currentTurn: TeamId; playerId?: string }
  QUESTION_SELECTED: {
    categoryId: string
    slotIndex: number
    points: PointValue
    team: TeamId
    /** QuestionItem id — the receiver resolves the same question locally. */
    questionId: string
    doubleApplied: boolean
    /** Free-for-all: the player who picked this question. */
    playerId?: string
  }
  ANSWER_REVEALED: { revealed: boolean }
  TEAM_ANSWER_SUBMITTED: {
    team: TeamId
    answer: string
    playerId?: string
  }
  SCORE_UPDATED: {
    team1Score: number
    team2Score: number
    /** Sent after resolving/finishing a question so the board stays identical. */
    cells?: BoardCell[][]
    /** Sent when the active question closes (resolve / finish). */
    questionClosed?: boolean
    /** Sent after submitting a multiple-choice answer. */
    answered?: { selectedAnswer: string | null; answerCorrect: boolean | null; answerPoints: number }
    /** Free-for-all (3+ players): full per-player state after any change. */
    ffaPlayers?: FfaPlayerState[]
  }
  LIFELINE_USED: {
    team: TeamId
    lifelineId: LifelineId
    pendingDoublePoints?: TeamId | null
    blockActive?: TeamId | null
    callFriendActive?: TeamId | null
    callFriendTimeLeft?: number
    callFriendHint?: string | null
    wheelBonus?: { teamId: TeamId; points: number } | null
    /** Wheel lifeline adds points directly to a team score. */
    scoreDelta?: number
    doubleApplied?: boolean
    twoAnswersUsed?: boolean
    answerOptions?: string[]
    /** Free-for-all: the player who used the lifeline. */
    playerId?: string
    /** Free-for-all: which player the double-points pre-pick belongs to. */
    pendingDoublePlayerId?: string | null
    /** Free-for-all: which player is blocked from gaining points. */
    blockedPlayerId?: string | null
    /** Free-for-all: which player asked a friend (call lifeline). */
    callFriendPlayerId?: string | null
  }
  GAME_FINISHED: {
    winner: TeamId | null
    team1Score: number
    team2Score: number
    /** Free-for-all (3+ players): final per-player standings. */
    ffaPlayers?: FfaPlayerState[]
  }
  /** Internal: full room snapshot broadcast by the host to reconcile clients. */
  ROOM_STATE: { room: OnlineRoom }
  /**
   * Host → everyone: an authoritative snapshot of the whole board state.
   * Broadcast when the channel (re)connects mid-game, right after the game
   * starts, and in reply to `SYNC_REQUEST`, so a client that missed any
   * gameplay event (temporary connection loss, a dropped broadcast, a race
   * with GAME_STARTED) converges back to the host's state instead of
   * staying stuck on divergent state.
   */
  GAME_STATE_SYNC: {
    /** Identifies the match this snapshot belongs to (the room id). */
    matchId: string
    sentAt: number
    currentTurn: TeamId
    ffaTurnPlayerId: string | null
    team1Score: number
    team2Score: number
    cells: BoardCell[][]
    team1Lifelines: Lifeline[]
    team2Lifelines: Lifeline[]
    ffaPlayers: FfaPlayerState[]
    usedQuestionKeys: string[]
    isRevealed: boolean
    isGameFinished: boolean
    answerSubmitted: boolean
    selectedAnswer: string | null
    answerCorrect: boolean | null
    answerPoints: number
    pendingDoublePoints: TeamId | null
    blockActive: TeamId | null
    callFriendActive: TeamId | null
    callFriendTimeLeft: number
    callFriendHint: string | null
    wheelBonus: { teamId: TeamId; points: number } | null
    wheelPending: boolean
    wheelPendingTeam: TeamId | null
    ffaWheelPendingPlayerId: string | null
    ffaPendingDoublePlayerId: string | null
    ffaBlockedPlayerId: string | null
    ffaCallFriendPlayerId: string | null
    teamAnswers?: { 1: string; 2: string }
    teamSubmitted?: { 1: boolean; 2: boolean }
    /** Full active-question text so the receiver never needs to resolve it. */
    activeQuestion: {
      categoryId: string
      slotIndex: number
      points: PointValue
      team: TeamId
      playerId?: string
      questionText: string
      answerText: string
      media: string
      mediaType: 'image' | 'video' | 'career'
      careerImage: string
      answerMedia: string
      hint: string
      answerOptions: string[]
      twoAnswersUsed: boolean
      answered: boolean
      lifelineUsed: LifelineId | null
      doubleApplied: boolean
    } | null
  }
  /** Joiner → host: "send me the current authoritative board state." */
  SYNC_REQUEST: Record<string, never>
}

export type OnlineGameEventType = keyof OnlineEventMap

/**
 * Envelope every online event travels in over the Realtime broadcast channel.
 *
 * Defined as a mapped discriminated union so that narrowing on `type`
 * (e.g. in a `switch`) narrows `payload` to the exact event payload.
 */
export type OnlineGameEvent = {
  [K in OnlineGameEventType]: {
    type: K
    roomId: string
    playerId: string
    /** Monotonic per-sender counter, for stale/duplicate-event protection. */
    sequence: number
    timestamp: number
    payload: OnlineEventMap[K]
  }
}[OnlineGameEventType]

/**
 * The session a local client participates in.
 */
export interface OnlineRoomSession {
  room: OnlineRoom
  self: OnlinePlayer
}

/**
 * Runtime guard for events coming from the Realtime channel.
 */
export function isOnlineGameEvent(value: unknown): value is OnlineGameEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<OnlineGameEvent>
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.roomId === 'string' &&
    typeof candidate.playerId === 'string' &&
    typeof candidate.sequence === 'number' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.payload === 'object' &&
    candidate.payload !== null
  )
}
