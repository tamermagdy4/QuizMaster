import { getQuestionEntries } from '../../data/questionLoader'
import { useGameBoardStore } from '../../store/gameBoardStore'
import { useOnlineStore } from '../../store/onlineStore'
import type { ActiveQuestion, PointValue } from '../../types/board'
import { cellKey } from '../../types/board'
import type { TeamId } from '../../types/game'
import type {
  OnlineConnectionStatus,
  OnlineEventMap,
  OnlineGameEvent,
  OnlineGameEventType,
} from '../../types/online'
import { broadcastOnlineEvent, subscribeToOnlineEvents, subscribeToOnlineStatus } from './onlineRoomService'

/**
 * True when the current board is an online game with a live room session.
 */
export function isOnlineGameActive(): boolean {
  const board = useGameBoardStore.getState()
  const online = useOnlineStore.getState()
  return board.gameMode === 'online' && online.room !== null && online.self !== null
}

/**
 * The team the local player controls in an online game: the host is always
 * team 1, the joining player is team 2. Returns null when there is no room.
 */
export function getOnlinePlayerTeam(): TeamId | null {
  const online = useOnlineStore.getState()
  if (!online.self || !online.room) return null
  return online.self.id === online.room.hostId ? 1 : 2
}

/**
 * Maps a remote player id to their team (host = team 1, everyone else =
 * team 2). Used to validate the sender of gameplay events: forged events
 * from a player who does not own the action are ignored.
 */
function onlineTeamOf(playerId: string): TeamId | null {
  const online = useOnlineStore.getState()
  if (!online.room) return null
  return playerId === online.room.hostId ? 1 : 2
}

/**
 * Explicit LOCAL vs REMOTE separation. While a remote event is being applied
 * to the local board, any broadcast triggered by store actions is suppressed,
 * so a remote event can never bounce back as a new broadcast (no loops).
 */
let applyingRemote = false

/**
 * Broadcasts a gameplay event for the current online game.
 * No-op for local games or while applying a remote event.
 */
export function notifyOnlineGameEvent<T extends OnlineGameEventType>(
  type: T,
  payload: OnlineEventMap[T],
): void {
  if (applyingRemote) return
  if (!isOnlineGameActive()) return
  void broadcastOnlineEvent(type, payload).catch((error) => {
    // A failed send must never break the game — log and continue locally.
    // The host re-broadcasts a full snapshot whenever the channel reconnects,
    // so a missed event self-heals instead of leaving the other player stuck.
    console.warn('[online] failed to broadcast', type, error)
  })
}

// ---------------------------------------------------------------------------
// STALE / DUPLICATE / OUT-OF-ORDER PROTECTION
//
// Every event carries a monotonic per-sender `sequence`. We track the last
// applied sequence per sender and drop anything that is older than it (a
// duplicate or a late event that lost the race against a newer one). A sender
// whose counter clearly restarted (e.g. re-created the session after a page
// refresh) is accepted again so a fresh session is never blocked by the old
// counter. Tracking is keyed by player id and cleared when a new match starts,
// so nothing leaks between games.
// ---------------------------------------------------------------------------
const lastRemoteSequenceBySender = new Map<string, number>()

/** Drops stale/duplicate events from a sender whose counter is still moving. */
function isStaleRemoteEvent(event: OnlineGameEvent): boolean {
  const previous = lastRemoteSequenceBySender.get(event.playerId)
  if (previous === undefined) return false
  const isOlderOrDuplicate = event.sequence <= previous
  // A counter restart (fresh session) shows a sequence far below the old one.
  const counterRestarted = event.sequence <= previous - 10000
  if (isOlderOrDuplicate && !counterRestarted) {
    console.warn(
      '[online] dropped stale/duplicate event',
      event.type,
      'seq',
      event.sequence,
      'last',
      previous,
      'from',
      event.playerId,
    )
    return true
  }
  return false
}

/**
 * Resets all online-sync bookkeeping. Called when a fresh match starts so no
 * sequence state from a previous game can affect the new one.
 */
export function resetOnlineGameSync(): void {
  lastRemoteSequenceBySender.clear()
  lastSyncStatus = null
}

// ---------------------------------------------------------------------------
// AUTHORITATIVE STATE RESYNC (GAME_STATE_SYNC / SYNC_REQUEST)
//
// Realtime guarantees delivery while the channel is connected, but a dropped
// connection or a failed send can lose a gameplay event, leaving the clients
// permanently out of sync (a turn that never advances, a question that never
// opens). To recover, the HOST is the source of truth: it broadcasts a full
// board snapshot on (re)connect, right after GAME_STARTED, and whenever a
// joiner asks for one. Receivers replace their state wholesale, so any missed
// or duplicated delta event is self-healed.
// ---------------------------------------------------------------------------

interface SyncActiveQuestion {
  categoryId: string
  slotIndex: number
  points: PointValue
  team: TeamId
  playerId?: string
  questionText: string
  answerText: string
  media: string
  mediaType: ActiveQuestion['mediaType']
  careerImage: string
  answerMedia: string
  hint: string
  answerOptions: string[]
  twoAnswersUsed: boolean
  answered: boolean
  lifelineUsed: ActiveQuestion['lifelineUsed']
  doubleApplied: boolean
}

type SyncPayload = OnlineEventMap['GAME_STATE_SYNC']

/** Builds the authoritative board snapshot from the current local state. */
function buildGameStateSyncPayload(): SyncPayload | null {
  const online = useOnlineStore.getState()
  const board = useGameBoardStore.getState()
  if (!online.room || board.gameMode !== 'online' || !board.isInitialized) return null

  const activeQuestion = board.activeQuestion
  let syncQuestion: SyncActiveQuestion | null = null
  if (activeQuestion) {
    syncQuestion = {
      categoryId: activeQuestion.categoryId,
      slotIndex: activeQuestion.slotIndex,
      points: activeQuestion.points,
      team: activeQuestion.team,
      playerId: activeQuestion.playerId,
      questionText: activeQuestion.questionText,
      answerText: activeQuestion.answerText,
      media: activeQuestion.media,
      mediaType: activeQuestion.mediaType,
      careerImage: activeQuestion.careerImage,
      answerMedia: activeQuestion.answerMedia,
      hint: activeQuestion.hint ?? '',
      answerOptions: activeQuestion.answerOptions,
      twoAnswersUsed: activeQuestion.twoAnswersUsed,
      answered: activeQuestion.answered,
      lifelineUsed: activeQuestion.lifelineUsed,
      doubleApplied: activeQuestion.doubleApplied,
    }
  }

  return {
    matchId: online.room.roomId,
    sentAt: Date.now(),
    currentTurn: board.currentTurn,
    ffaTurnPlayerId: board.ffaTurnPlayerId,
    team1Score: board.team1Score,
    team2Score: board.team2Score,
    cells: board.cells,
    team1Lifelines: board.team1Lifelines,
    team2Lifelines: board.team2Lifelines,
    ffaPlayers: board.ffaPlayers,
    usedQuestionKeys: board.usedQuestionKeys,
    isRevealed: board.isRevealed,
    isGameFinished: board.isGameFinished,
    answerSubmitted: board.answerSubmitted,
    selectedAnswer: board.selectedAnswer,
    answerCorrect: board.answerCorrect,
    answerPoints: board.answerPoints,
    pendingDoublePoints: board.pendingDoublePoints,
    blockActive: board.blockActive,
    callFriendActive: board.callFriendActive,
    callFriendTimeLeft: board.callFriendTimeLeft,
    callFriendHint: board.callFriendHint,
    wheelBonus: board.wheelBonus,
    wheelPending: board.wheelPending,
    wheelPendingTeam: board.wheelPendingTeam,
    ffaWheelPendingPlayerId: board.ffaWheelPendingPlayerId,
    ffaPendingDoublePlayerId: board.ffaPendingDoublePlayerId,
    ffaBlockedPlayerId: board.ffaBlockedPlayerId,
    ffaCallFriendPlayerId: board.ffaCallFriendPlayerId,
    activeQuestion: syncQuestion,
  }
}

/**
 * Host-only: broadcast the full authoritative board state to the room.
 * Safe to call any time; no-ops when no online game is active.
 */
export function broadcastOnlineGameSync(): Promise<void> {
  const online = useOnlineStore.getState()
  const board = useGameBoardStore.getState()
  if (!online.room || !online.self || board.gameMode !== 'online') return Promise.resolve()
  if (online.self.id !== online.room.hostId) return Promise.resolve()

  const payload = buildGameStateSyncPayload()
  if (!payload) return Promise.resolve()
  console.info(
    '[online] host broadcasts GAME_STATE_SYNC',
    'turn',
    payload.currentTurn,
    'scores',
    [payload.team1Score, payload.team2Score],
    'question',
    payload.activeQuestion ? `${payload.activeQuestion.categoryId}/${payload.activeQuestion.points}` : 'none',
  )
  return broadcastOnlineEvent('GAME_STATE_SYNC', payload).then(() => undefined)
}

/**
 * Joiner-only: ask the host for the current authoritative board state.
 */
export function requestOnlineGameSync(): Promise<void> {
  if (!isOnlineGameActive()) return Promise.resolve()
  console.info('[online] requesting GAME_STATE_SYNC from host')
  return broadcastOnlineEvent('SYNC_REQUEST', {}).then(() => undefined)
}

/** Applies a host snapshot to the local board state (wholesale replacement). */
function applyRemoteSync(payload: SyncPayload, senderId: string): void {
  const online = useOnlineStore.getState()
  const room = online.room
  if (!room || payload.matchId !== room.roomId) {
    console.warn('[online] ignored GAME_STATE_SYNC for a different room', payload.matchId, room?.roomId)
    return
  }
  // Only the host's snapshot is authoritative — a forged sync is ignored.
  if (senderId !== room.hostId) {
    console.warn('[online] ignored GAME_STATE_SYNC from non-host', senderId)
    return
  }
  // Score integrity: reject a snapshot carrying non-finite scores.
  if (
    !Number.isFinite(payload.team1Score) ||
    !Number.isFinite(payload.team2Score) ||
    !Number.isFinite(payload.answerPoints)
  ) {
    console.warn('[online] ignored GAME_STATE_SYNC with non-finite score')
    return
  }

  const syncQuestion = payload.activeQuestion
  const activeQuestion: ActiveQuestion | null = syncQuestion
    ? {
        categoryId: syncQuestion.categoryId,
        slotIndex: syncQuestion.slotIndex,
        points: syncQuestion.points,
        team: syncQuestion.team,
        playerId: syncQuestion.playerId,
        questionText: syncQuestion.questionText,
        answerText: syncQuestion.answerText,
        media: syncQuestion.media,
        mediaType: syncQuestion.mediaType,
        careerImage: syncQuestion.careerImage,
        answerMedia: syncQuestion.answerMedia,
        hint: syncQuestion.hint,
        answerOptions: syncQuestion.answerOptions,
        twoAnswersUsed: syncQuestion.twoAnswersUsed,
        answered: syncQuestion.answered,
        lifelineUsed: syncQuestion.lifelineUsed,
        doubleApplied: syncQuestion.doubleApplied,
      }
    : null

  useGameBoardStore.setState({
    currentTurn: payload.currentTurn,
    ffaTurnPlayerId: payload.ffaTurnPlayerId,
    team1Score: payload.team1Score,
    team2Score: payload.team2Score,
    cells: payload.cells,
    team1Lifelines: payload.team1Lifelines,
    team2Lifelines: payload.team2Lifelines,
    ffaPlayers: payload.ffaPlayers,
    usedQuestionKeys: payload.usedQuestionKeys,
    activeQuestion,
    isRevealed: payload.isRevealed,
    isGameFinished: payload.isGameFinished,
    answerSubmitted: payload.answerSubmitted,
    selectedAnswer: payload.selectedAnswer,
    answerCorrect: payload.answerCorrect,
    answerPoints: payload.answerPoints,
    pendingDoublePoints: payload.pendingDoublePoints,
    blockActive: payload.blockActive,
    callFriendActive: payload.callFriendActive,
    callFriendTimeLeft: payload.callFriendTimeLeft,
    callFriendHint: payload.callFriendHint,
    wheelBonus: payload.wheelBonus,
    wheelPending: payload.wheelPending,
    wheelPendingTeam: payload.wheelPendingTeam,
    ffaWheelPendingPlayerId: payload.ffaWheelPendingPlayerId,
    ffaPendingDoublePlayerId: payload.ffaPendingDoublePlayerId,
    ffaBlockedPlayerId: payload.ffaBlockedPlayerId,
    ffaCallFriendPlayerId: payload.ffaCallFriendPlayerId,
  })

  console.info(
    '[online] applied GAME_STATE_SYNC',
    'turn',
    payload.currentTurn,
    'scores',
    [payload.team1Score, payload.team2Score],
    'question',
    payload.activeQuestion ? 'open' : 'none',
  )
}

/**
 * Applies a remote gameplay event to the local GameBoard state.
 * This is the only place remote events touch the board store, and it goes
 * through plain `setState` (never through the game actions), so no event is
 * re-broadcast as a result.
 */
export function applyRemoteGameEvent(event: OnlineGameEvent): void {
  if (!isOnlineGameActive()) return

  // The channel broadcasts with `self: true`, so our OWN events echo back.
  // The sender already applied the change locally before broadcasting —
  // re-applying the echo would double-apply relative deltas like the wheel's
  // scoreDelta. Skip any event whose sender is the local player.
  const online = useOnlineStore.getState()
  if (online.self && event.playerId === online.self.id) return

  // Stale/duplicate protection: never let an old event overwrite a newer one.
  if (isStaleRemoteEvent(event)) return
  lastRemoteSequenceBySender.set(event.playerId, event.sequence)

  applyingRemote = true
  try {
    switch (event.type) {
      case 'QUESTION_SELECTED': {
        // Authority: only the current turn's player/team may select a
        // question. In free-for-all the selector must be the payload's own
        // playerId; in team mode the payload team must match the sender's
        // team (host = team 1, joiner = team 2). A forged selection from
        // anyone else is ignored.
        const ffa = useGameBoardStore.getState().ffaPlayers.length >= 3
        if (ffa) {
          if (event.playerId !== event.payload.playerId) break
        } else {
          const senderTeamId = onlineTeamOf(event.playerId)
          if (senderTeamId === null || event.payload.team !== senderTeamId) break
        }
        applyRemoteQuestion(event.payload)
        break
      }
      case 'ANSWER_REVEALED': {
        // Revealing the answer is a HOST-only control: a forged event from a
        // non-host player is ignored so the joiner can never force a reveal.
        const room = useOnlineStore.getState().room
        if (!room || event.playerId !== room.hostId) break
        useGameBoardStore.setState({ isRevealed: event.payload.revealed })
        break
      }
      case 'TURN_CHANGED': {
        // Authority: only the HOST drives turn changes (via resolving or
        // finishing a question). A forged turn event is ignored.
        const room = useOnlineStore.getState().room
        if (!room || event.playerId !== room.hostId) break
        useGameBoardStore.setState((state) =>
          event.payload.playerId && state.ffaPlayers.length >= 3
            ? { ffaTurnPlayerId: event.payload.playerId }
            : { currentTurn: event.payload.currentTurn },
        )
        break
      }
      case 'SCORE_UPDATED': {
        // Authority: the judgment path (closing a question / changing scores /
        // updating cells) is HOST-only. The `answered` record is sent by the
        // answering player — validate the sender is the question's owner.
        const ffa = useGameBoardStore.getState().ffaPlayers.length >= 3
        if (event.payload.questionClosed || event.payload.cells) {
          const room = useOnlineStore.getState().room
          if (!room || event.playerId !== room.hostId) break
          applyRemoteScore(event.payload)
          break
        }
        if (event.payload.answered) {
          const activeQuestion = useGameBoardStore.getState().activeQuestion
          if (ffa) {
            if (!activeQuestion || event.playerId !== activeQuestion.playerId) break
          } else {
            const senderTeamId = onlineTeamOf(event.playerId)
            if (!activeQuestion || senderTeamId === null || activeQuestion.team !== senderTeamId) break
          }
          applyRemoteScore(event.payload)
        }
        break
      }
      case 'LIFELINE_USED': {
        // Authority: a lifeline may only be consumed by its owner — in
        // free-for-all the acting player, in team mode the acting team
        // (host = team 1, joiner = team 2). Prevents one player from
        // consuming another player's lifeline via a forged event.
        const ffa = useGameBoardStore.getState().ffaPlayers.length >= 3
        if (ffa) {
          if (event.payload.playerId && event.playerId !== event.payload.playerId) break
        } else {
          const senderTeamId = onlineTeamOf(event.playerId)
          if (senderTeamId === null || event.payload.team !== senderTeamId) break
        }
        applyRemoteLifeline(event.payload)
        break
      }
      case 'GAME_FINISHED': {
        // Authority: only the HOST declares the game finished (the host is
        // the only one who resolves the final question).
        const room = useOnlineStore.getState().room
        if (!room || event.playerId !== room.hostId) break
        // Free-for-all: the final per-player standings are authoritative.
        if (event.payload.ffaPlayers) {
          useGameBoardStore.setState({ ffaPlayers: event.payload.ffaPlayers, isGameFinished: true })
          break
        }
        const { team1Score, team2Score } = event.payload
        useGameBoardStore.setState({ team1Score, team2Score, isGameFinished: true })
        break
      }
      case 'GAME_STATE_SYNC':
        applyRemoteSync(event.payload, event.playerId)
        break
      case 'SYNC_REQUEST': {
        // Only the host answers with the authoritative snapshot.
        const self = useOnlineStore.getState().self
        const room = useOnlineStore.getState().room
        if (self && room && self.id === room.hostId) {
          void broadcastOnlineGameSync().catch((error) => {
            console.warn('[online] sync reply failed', error)
          })
        }
        break
      }
      default:
        break
    }
  } finally {
    applyingRemote = false
  }
}

function applyRemoteQuestion(payload: OnlineEventMap['QUESTION_SELECTED']): void {
  const { categoryId, slotIndex, points, team, questionId, doubleApplied, playerId } = payload
  const item = getQuestionEntries(categoryId).find((entry) => entry.id === questionId)

  let activeQuestion: ActiveQuestion
  if (item) {
    activeQuestion = {
      categoryId,
      slotIndex,
      points: points as PointValue,
      team,
      playerId,
      questionText: item.question,
      answerText: item.answer,
      media: item.media || '',
      mediaType: (item.mediaType as ActiveQuestion['mediaType']) || 'image',
      careerImage: item.careerImage || '',
      answerMedia: item.answerMedia || '',
      hint: item.hint || '',
      answerOptions: [],
      twoAnswersUsed: false,
      answered: false,
      lifelineUsed: null,
      doubleApplied,
    }
  } else {
    // Data mismatch between clients — degrade to the same fallback the
    // local store uses when no question is available.
    activeQuestion = {
      categoryId,
      slotIndex,
      points: points as PointValue,
      team,
      playerId,
      questionText: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      answerText: 'لا توجد أسئلة متاحة لهذه الفئة حالياً.',
      media: '',
      mediaType: 'image',
      careerImage: '',
      answerMedia: '',
      hint: '',
      answerOptions: [],
      twoAnswersUsed: false,
      answered: false,
      lifelineUsed: null,
      doubleApplied,
    }
  }

  useGameBoardStore.setState((state) => ({
    activeQuestion,
    // Idempotent: the sender's own broadcast echoes back (self: true), so the
    // key may already be present — never add a duplicate. Applying the same
    // QUESTION_SELECTED multiple times keeps exactly one key.
    usedQuestionKeys:
      item && !state.usedQuestionKeys.includes(questionId)
        ? [...state.usedQuestionKeys, questionId]
        : state.usedQuestionKeys,
    // Free-for-all: mark the cell used for the SELECTING player only.
    ...(state.ffaPlayers.length >= 3 && playerId
      ? {
          ffaPlayers: state.ffaPlayers.map((player) =>
            player.playerId === playerId &&
            !player.usedCells.includes(cellKey(categoryId, slotIndex))
              ? { ...player, usedCells: [...player.usedCells, cellKey(categoryId, slotIndex)] }
              : player,
          ),
          ffaTurnPlayerId: playerId,
          ffaPendingDoublePlayerId: null,
        }
      : {}),
    pendingDoublePoints: null,
    blockActive: null,
    callFriendActive: null,
    callFriendTimeLeft: 0,
    callFriendHint: null,
    wheelBonus: null,
    answerSubmitted: false,
    selectedAnswer: null,
    answerCorrect: null,
    answerPoints: 0,
    isRevealed: false,
  }))
}

function applyRemoteScore(payload: OnlineEventMap['SCORE_UPDATED']): void {
  // Score integrity: a remote client must never inject a non-finite score
  // (JSON can smuggle Infinity via `1e999`). Finite negative scores are legal
  // (wheel deductions), so only non-finite values are rejected here.
  if (!Number.isFinite(payload.team1Score) || !Number.isFinite(payload.team2Score)) {
    console.warn('[online] dropped SCORE_UPDATED with non-finite score')
    return
  }
  if (payload.answered && !Number.isFinite(payload.answered.answerPoints)) {
    console.warn('[online] dropped SCORE_UPDATED with non-finite answerPoints')
    return
  }
  useGameBoardStore.setState((state) => {
    const patch: Partial<ReturnType<typeof useGameBoardStore.getState>> = {
      team1Score: payload.team1Score,
      team2Score: payload.team2Score,
    }

    // Free-for-all: the full per-player state is authoritative.
    if (payload.ffaPlayers) {
      patch.ffaPlayers = payload.ffaPlayers
    }

    if (payload.cells) {
      patch.cells = payload.cells
    }

    if (payload.questionClosed) {
      patch.activeQuestion = null
      patch.pendingDoublePoints = null
      patch.blockActive = null
      patch.callFriendActive = null
      patch.callFriendTimeLeft = 0
      patch.callFriendHint = null
      patch.answerSubmitted = false
      patch.selectedAnswer = null
      patch.answerCorrect = null
      patch.answerPoints = 0
      patch.isRevealed = false
    }

    if (payload.answered) {
      patch.activeQuestion = state.activeQuestion
        ? { ...state.activeQuestion, answered: true }
        : null
      patch.answerSubmitted = true
      patch.selectedAnswer = payload.answered.selectedAnswer
      patch.answerCorrect = payload.answered.answerCorrect
      patch.answerPoints = payload.answered.answerPoints
    }

    return patch
  })
}

function applyRemoteLifeline(payload: OnlineEventMap['LIFELINE_USED']): void {
  // Score integrity: the lifeline's scoreDelta must be a finite integer — a
  // hostile client could otherwise inject Infinity / NaN into a player's
  // score through a forged wheel event.
  if (payload.scoreDelta !== undefined && !Number.isFinite(payload.scoreDelta)) {
    console.warn('[online] dropped LIFELINE_USED with non-finite scoreDelta')
    return
  }
  const state = useGameBoardStore.getState()

  // Free-for-all: lifelines belong to the acting player.
  if (payload.playerId && state.ffaPlayers.length >= 3) {
    const nextFfaPlayers = state.ffaPlayers.map((player) =>
      player.playerId === payload.playerId
        ? {
            ...player,
            score: player.score + (payload.scoreDelta ?? 0),
            lifelines: player.lifelines.map((lifeline) =>
              lifeline.id === payload.lifelineId ? { ...lifeline, used: true } : lifeline,
            ),
          }
        : player,
    )

    const activeQuestionPatch: Partial<ActiveQuestion> = {}
    if (payload.doubleApplied !== undefined) activeQuestionPatch.doubleApplied = payload.doubleApplied
    if (payload.twoAnswersUsed !== undefined) {
      activeQuestionPatch.twoAnswersUsed = payload.twoAnswersUsed
      if (payload.answerOptions !== undefined) activeQuestionPatch.answerOptions = payload.answerOptions
    }
    if (Object.keys(activeQuestionPatch).length > 0) {
      activeQuestionPatch.lifelineUsed = payload.lifelineId
    }

    useGameBoardStore.setState({
      ffaPlayers: nextFfaPlayers,
      ...(payload.pendingDoublePlayerId !== undefined
        ? { ffaPendingDoublePlayerId: payload.pendingDoublePlayerId }
        : {}),
      ...(payload.blockedPlayerId !== undefined
        ? { ffaBlockedPlayerId: payload.blockedPlayerId }
        : {}),
      ...(payload.callFriendPlayerId !== undefined
        ? { ffaCallFriendPlayerId: payload.callFriendPlayerId }
        : {}),
      ...(payload.callFriendTimeLeft !== undefined ? { callFriendTimeLeft: payload.callFriendTimeLeft } : {}),
      ...(payload.callFriendHint !== undefined ? { callFriendHint: payload.callFriendHint } : {}),
      ...(payload.wheelBonus !== undefined ? { wheelBonus: payload.wheelBonus } : {}),
      ...(Object.keys(activeQuestionPatch).length > 0 && state.activeQuestion
        ? { activeQuestion: { ...state.activeQuestion, ...activeQuestionPatch } }
        : {}),
    })
    return
  }

  const isTeam1 = payload.team === 1
  const nextLifelines = (isTeam1 ? state.team1Lifelines : state.team2Lifelines).map((lifeline) =>
    lifeline.id === payload.lifelineId ? { ...lifeline, used: true } : lifeline,
  )

  const activeQuestionPatch: Partial<ActiveQuestion> = {}
  if (payload.doubleApplied !== undefined) activeQuestionPatch.doubleApplied = payload.doubleApplied
  if (payload.twoAnswersUsed !== undefined) {
    activeQuestionPatch.twoAnswersUsed = payload.twoAnswersUsed
    if (payload.answerOptions !== undefined) activeQuestionPatch.answerOptions = payload.answerOptions
  }
  if (Object.keys(activeQuestionPatch).length > 0) {
    activeQuestionPatch.lifelineUsed = payload.lifelineId
  }

  useGameBoardStore.setState({
    ...(isTeam1 ? { team1Lifelines: nextLifelines } : { team2Lifelines: nextLifelines }),
    ...(payload.pendingDoublePoints !== undefined ? { pendingDoublePoints: payload.pendingDoublePoints } : {}),
    ...(payload.blockActive !== undefined ? { blockActive: payload.blockActive } : {}),
    ...(payload.callFriendActive !== undefined ? { callFriendActive: payload.callFriendActive } : {}),
    ...(payload.callFriendTimeLeft !== undefined ? { callFriendTimeLeft: payload.callFriendTimeLeft } : {}),
    ...(payload.callFriendHint !== undefined ? { callFriendHint: payload.callFriendHint } : {}),
    ...(payload.wheelBonus !== undefined ? { wheelBonus: payload.wheelBonus } : {}),
    ...(payload.scoreDelta && isTeam1 ? { team1Score: state.team1Score + payload.scoreDelta } : {}),
    ...(payload.scoreDelta && !isTeam1 ? { team2Score: state.team2Score + payload.scoreDelta } : {}),
    ...(Object.keys(activeQuestionPatch).length > 0 && state.activeQuestion
      ? { activeQuestion: { ...state.activeQuestion, ...activeQuestionPatch } }
      : {}),
  })
}

let syncStarted = false

/**
 * Tracks the last Realtime status so we can detect a (re)connect and trigger
 * a board resync. Only the transition INTO 'connected' matters: on the very
 * first connect the game has not started yet (gated out), and every later
 * reconnect self-heals any gameplay event lost during the drop.
 */
let lastSyncStatus: OnlineConnectionStatus | null = null

function handleReconnectResync(): void {
  if (!isOnlineGameActive()) return
  const online = useOnlineStore.getState()
  const board = useGameBoardStore.getState()
  if (!online.self || !online.room || board.gameMode !== 'online') return
  if (online.self.id === online.room.hostId) {
    void broadcastOnlineGameSync().catch((error) => {
      console.warn('[online] reconnect sync failed', error)
    })
  } else {
    void requestOnlineGameSync().catch((error) => {
      console.warn('[online] reconnect sync request failed', error)
    })
  }
}

/**
 * Starts listening for online gameplay events and applying them to the local
 * board. Called once by `applyOnlineBoardSnapshot` (both host and joiner run
 * it right before entering the GameBoard).
 */
export function startOnlineGameSync(): void {
  if (syncStarted) return
  syncStarted = true

  subscribeToOnlineEvents((event) => {
    applyRemoteGameEvent(event)
  })

  // Reconnect recovery: when the channel comes back while a game is live,
  // the host pushes the authoritative snapshot (or the joiner asks for one)
  // so both clients reconverge instead of staying stuck on lost events.
  subscribeToOnlineStatus((status) => {
    const previous = lastSyncStatus
    lastSyncStatus = status
    if (status !== 'connected' || previous === 'connected') return
    handleReconnectResync()
  })
}
