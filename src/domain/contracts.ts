/**
 * Domain contracts — runtime validation for the core Fahloy game data.
 *
 * TypeScript types alone are NOT runtime validation. Every piece of data that
 * crosses a trust boundary (Supabase responses, Realtime broadcast events,
 * localStorage, URL input) must pass these guards before it is allowed to
 * reach game state. These functions are pure and reusable from the local
 * game, the online game, the question loader and the online event pipeline.
 */
import type {
  ActiveQuestion,
  BoardCell,
  FfaPlayerState,
  GameMode,
  Lifeline,
  LifelineId,
  PointValue,
} from '../types/board'
import type { TeamId } from '../types/game'
import type { OnlineGameEvent, OnlineRoom, OnlineRoomStatus } from '../types/online'

// ---------------------------------------------------------------------------
// Allowed-value sets (single source of truth)
// ---------------------------------------------------------------------------

/** The ONLY valid question point values in the game. Never change without a design decision. */
export const POINT_VALUES: readonly PointValue[] = [100, 300, 500]

/** The only two teams in team mode. */
export const TEAM_IDS: readonly TeamId[] = [1, 2]

/** The only lifelines that exist. */
export const LIFELINE_IDS: readonly LifelineId[] = ['double', 'two-answers', 'block', 'call', 'wheel']

/** The only game modes. */
export const GAME_MODES: readonly GameMode[] = ['local', 'online']

/** The only question media types. */
export const MEDIA_TYPES = ['image', 'video', 'career'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

/** The only room statuses. */
export const ROOM_STATUSES: readonly OnlineRoomStatus[] = ['waiting', 'playing', 'finished', 'cancelled']

/** A category column always has exactly this many point slots (POINT_SLOTS). */
export const SLOTS_PER_CATEGORY = 6

// ---------------------------------------------------------------------------
// Narrow guards
// ---------------------------------------------------------------------------

export function isPointValue(value: unknown): value is PointValue {
  return value === 100 || value === 300 || value === 500
}

export function isTeamId(value: unknown): value is TeamId {
  return value === 1 || value === 2
}

export function isLifelineId(value: unknown): value is LifelineId {
  return typeof value === 'string' && (LIFELINE_IDS as readonly string[]).includes(value)
}

export function isGameMode(value: unknown): value is GameMode {
  return value === 'local' || value === 'online'
}

export function isMediaType(value: unknown): value is MediaType {
  return value === 'image' || value === 'video' || value === 'career'
}

/** A slot index is an integer in [0, SLOTS_PER_CATEGORY). */
export function isSlotIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < SLOTS_PER_CATEGORY
}

/**
 * A valid score: a finite integer. Negative scores are LEGAL — the Wheel of
 * Fortune can deduct points (e.g. -150), so a score of -150 must validate.
 */
export function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

// ---------------------------------------------------------------------------
// Entity shape validators (for untrusted input)
// ---------------------------------------------------------------------------

export function isValidBoardCell(value: unknown): value is BoardCell {
  if (typeof value !== 'object' || value === null) return false
  const cell = value as Partial<BoardCell>
  return (
    isNonEmptyString(cell.categoryId) &&
    isSlotIndex(cell.slotIndex) &&
    isPointValue(cell.points) &&
    typeof cell.team1Played === 'boolean' &&
    typeof cell.team2Played === 'boolean'
  )
}

export function isValidLifeline(value: unknown): value is Lifeline {
  if (typeof value !== 'object' || value === null) return false
  const lifeline = value as Partial<Lifeline>
  return (
    isLifelineId(lifeline.id) &&
    typeof lifeline.label === 'string' &&
    typeof lifeline.icon === 'string' &&
    typeof lifeline.used === 'boolean'
  )
}

export function isValidActiveQuestion(value: unknown): value is ActiveQuestion {
  if (typeof value !== 'object' || value === null) return false
  const question = value as Partial<ActiveQuestion>
  return (
    isNonEmptyString(question.categoryId) &&
    isSlotIndex(question.slotIndex) &&
    isPointValue(question.points) &&
    isTeamId(question.team) &&
    isNonEmptyString(question.questionText) &&
    isNonEmptyString(question.answerText) &&
    (question.mediaType === undefined || isMediaType(question.mediaType)) &&
    Array.isArray(question.answerOptions) &&
    typeof question.answered === 'boolean' &&
    (question.lifelineUsed === null || isLifelineId(question.lifelineUsed)) &&
    typeof question.doubleApplied === 'boolean'
  )
}

export function isValidFfaPlayer(value: unknown): value is FfaPlayerState {
  if (typeof value !== 'object' || value === null) return false
  const player = value as Partial<FfaPlayerState>
  return (
    isNonEmptyString(player.playerId) &&
    typeof player.name === 'string' &&
    isScore(player.score) &&
    Array.isArray(player.usedCells) &&
    player.usedCells.every((cell) => typeof cell === 'string') &&
    Array.isArray(player.lifelines) &&
    player.lifelines.every((lifeline) => isValidLifeline(lifeline))
  )
}

/**
 * A question is only usable by the board when it has a stable id, belongs to
 * a real category and carries a valid point value. The loader guarantees this
 * for resolved entries; this guard exists for anything that crosses a
 * boundary (e.g. a remote snapshot embedding question data).
 */
export function isValidResolvedQuestion(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const question = value as Record<string, unknown>
  return (
    isNonEmptyString(question.id) &&
    isNonEmptyString(question.categoryId) &&
    (question.points === undefined || isPointValue(question.points)) &&
    typeof question.question === 'string' &&
    typeof question.answer === 'string' &&
    (question.mediaType === undefined || isMediaType(question.mediaType))
  )
}

/** Validates the shape of a room snapshot carried by ROOM_STATE / GAME_CREATED. */
export function isValidRoomSnapshot(value: unknown): value is OnlineRoom {
  if (typeof value !== 'object' || value === null) return false
  const room = value as Partial<OnlineRoom>
  return (
    isNonEmptyString(room.roomId) &&
    isNonEmptyString(room.roomCode) &&
    isNonEmptyString(room.hostId) &&
    typeof room.status === 'string' &&
    (ROOM_STATUSES as readonly string[]).includes(room.status) &&
    (room.questionDuration === 15 || room.questionDuration === 30 || room.questionDuration === 60) &&
    typeof room.maxPlayers === 'number' &&
    Number.isInteger(room.maxPlayers) &&
    room.maxPlayers >= 2 &&
    room.maxPlayers <= 6 &&
    Array.isArray(room.categoryIds) &&
    room.categoryIds.every((id) => typeof id === 'string') &&
    Array.isArray(room.players) &&
    room.players.every(
      (player) =>
        typeof player === 'object' &&
        player !== null &&
        typeof (player as { id?: unknown }).id === 'string' &&
        typeof (player as { name?: unknown }).name === 'string' &&
        typeof (player as { isHost?: unknown }).isHost === 'boolean',
    )
  )
}

// ---------------------------------------------------------------------------
// Online event payload validation
//
// Lenient by design: only the fields that matter for data integrity are
// checked (allowed enum values, finite scores, well-formed rooms). Unknown or
// future fields never fail validation, so adding a field to an event cannot
// break older clients. This runs at the single Realtime chokepoint, before an
// event is dispatched to the store or the gameplay sync.
// ---------------------------------------------------------------------------

export function isValidOnlineEventPayload(event: OnlineGameEvent): boolean {
  // Envelope-level playerId is required on every event and must be non-empty.
  if (!isNonEmptyString(event.playerId)) return false

  // NOTE: switch directly on `event.payload.*` inside each case — extracting
  // the payload into a local first would lose the discriminated-union
  // narrowing and force unsafe casts.
  switch (event.type) {
    case 'GAME_CREATED':
    case 'ROOM_STATE':
      return isValidRoomSnapshot(event.payload.room)

    case 'PLAYER_JOINED': {
      const player = event.payload.player
      return (
        isNonEmptyString(player.id) &&
        typeof player.name === 'string' &&
        typeof player.isHost === 'boolean'
      )
    }

    case 'PLAYER_LEFT':
    case 'PLAYER_LEFT_ROOM':
      return isNonEmptyString(event.payload.playerId)

    case 'GAME_STARTED': {
      const board = event.payload.board
      return (
        typeof event.payload.startedAt === 'number' &&
        typeof board.gameName === 'string' &&
        (board.questionDuration === 15 || board.questionDuration === 30 || board.questionDuration === 60) &&
        Array.isArray(board.players)
      )
    }

    case 'TURN_CHANGED':
      return (
        isTeamId(event.payload.currentTurn) &&
        (event.payload.playerId === undefined || isNonEmptyString(event.payload.playerId))
      )

    case 'QUESTION_SELECTED': {
      const payload = event.payload
      return (
        isNonEmptyString(payload.categoryId) &&
        isSlotIndex(payload.slotIndex) &&
        isPointValue(payload.points) &&
        isTeamId(payload.team) &&
        isNonEmptyString(payload.questionId)
      )
    }

    case 'ANSWER_REVEALED':
      return typeof event.payload.revealed === 'boolean'

    case 'TEAM_ANSWER_SUBMITTED': {
      const payload = event.payload
      return (
        isTeamId(payload.team) &&
        typeof payload.answer === 'string' &&
        (payload.playerId === undefined || isNonEmptyString(payload.playerId))
      )
    }

    case 'SCORE_UPDATED': {
      const payload = event.payload
      if (!isScore(payload.team1Score) || !isScore(payload.team2Score)) return false
      if (payload.currentTurn !== undefined && !isTeamId(payload.currentTurn)) return false
      if (payload.turnPlayerId !== undefined && !isNonEmptyString(payload.turnPlayerId)) return false
      if (payload.answered !== undefined) {
        if (!isScore(payload.answered.answerPoints)) return false
        if (payload.answered.selectedAnswer !== null && typeof payload.answered.selectedAnswer !== 'string') return false
        if (payload.answered.answerCorrect !== null && typeof payload.answered.answerCorrect !== 'boolean') return false
      }
      return true
    }

    case 'LIFELINE_USED': {
      const payload = event.payload
      if (!isLifelineId(payload.lifelineId) || !isTeamId(payload.team)) return false
      if (payload.scoreDelta !== undefined && !isScore(payload.scoreDelta)) return false
      return true
    }

    case 'GAME_FINISHED':
      return isScore(event.payload.team1Score) && isScore(event.payload.team2Score)

    case 'GAME_STATE_SYNC': {
      const payload = event.payload
      return (
        isNonEmptyString(payload.matchId) &&
        isTeamId(payload.currentTurn) &&
        isScore(payload.team1Score) &&
        isScore(payload.team2Score) &&
        Array.isArray(payload.cells) &&
        isScore(payload.answerPoints)
      )
    }

    case 'SYNC_REQUEST':
      return true

    default:
      // Unknown event types are rejected earlier by `isOnlineGameEvent`.
      return false
  }
}
