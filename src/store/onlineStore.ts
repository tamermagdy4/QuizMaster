import { create } from 'zustand'
import {
  broadcastOnlineEvent,
  createOnlineRoom,
  isHostRoomSnapshotTrusted,
  joinOnlineRoom,
  leaveOnlineRoom,
  subscribeToOnlineEvents,
  subscribeToOnlinePlayers,
  subscribeToOnlineStatus,
  updateHostRoom,
  type CreateRoomInput,
  type JoinRoomInput,
} from '../services/online/onlineRoomService'
import { resetOnlineMatchState } from './gameBoardStore'
import type { LifelineId } from '../types/board'
import type {
  OnlineBoardSnapshot,
  OnlineConnectionStatus,
  OnlineGameEvent,
  OnlinePlayer,
  OnlineRoom,
} from '../types/online'

interface OnlineState {
  room: OnlineRoom | null
  self: OnlinePlayer | null
  players: OnlinePlayer[]
  roomCode: string | null
  connectionStatus: OnlineConnectionStatus
  lastEvent: OnlineGameEvent | null
  error: string | null

  createRoom: (input: CreateRoomInput) => Promise<boolean>
  joinRoom: (input: JoinRoomInput) => Promise<boolean>
  /** `cancelRoom: true` cancels the whole match for the other player too. */
  leaveRoom: (options?: { cancelRoom?: boolean }) => Promise<void>
  startGame: (snapshot: OnlineBoardSnapshot) => Promise<void>
  /** Host-only: update the room's shared category list (synced via ROOM_STATE). */
  setRoomCategories: (categoryIds: string[]) => Promise<boolean>
  /**
   * Host-only: update the 3 lifelines chosen per team in the lobby. The
   * joiner can never change them — the host is the authority.
   */
  setRoomLifelines: (team1LifelineIds: LifelineId[], team2LifelineIds: LifelineId[]) => Promise<boolean>
  isHost: () => boolean
  reset: () => void
}

let wired = false

/**
 * Room ids that were cancelled by a player leaving. Once a room is cancelled,
 * late `ROOM_STATE` re-broadcasts (triggered by the departing player's
 * presence drop) must NOT re-establish it — the room stays gone.
 */
let cancelledRoomId: string | null = null

/**
 * Idempotent wiring of the online service into the store. Called lazily by
 * the store actions and by `useOnlineRoom` on mount.
 */
function ensureWired(): void {
  if (wired) return
  wired = true

  subscribeToOnlineEvents((event) => {
    useOnlineStore.setState((state) => ({
      ...reduceEvent(state, event),
      lastEvent: event,
    }))
  })

  subscribeToOnlineStatus((connectionStatus) => {
    useOnlineStore.setState({ connectionStatus })
  })

  subscribeToOnlinePlayers((players) => {
    useOnlineStore.setState((state) => {
      const next: Partial<OnlineState> = { players }

      // In the lobby a missing host voids the room (there is nothing to play).
      // During an active game the room stays alive so a host disconnect does
      // NOT kill the match — the GameBoard surfaces the host as offline and
      // play can resume when they return.
      if (state.room && state.self && !state.self.isHost && state.room.status === 'waiting') {
        const hostStillConnected = players.some((player) => player.id === state.room?.hostId)
        if (!hostStillConnected) {
          next.error = 'The host left the room.'
          next.room = null
        }
      }

      return next
    })
  })
}

function upsertPlayer(players: OnlinePlayer[], player: OnlinePlayer): OnlinePlayer[] {
  const index = players.findIndex((entry) => entry.id === player.id)
  if (index === -1) return [...players, player]
  const next = [...players]
  next[index] = player
  return next
}

function reduceEvent(state: OnlineState, event: OnlineGameEvent): Partial<OnlineState> {
  switch (event.type) {
    case 'GAME_CREATED':
    case 'ROOM_STATE': {
      const room = event.payload.room
      // A room that was cancelled by a leave must never come back, even if a
      // late ROOM_STATE re-broadcast arrives after the cancellation.
      if (cancelledRoomId && room.roomId === cancelledRoomId) return {}
      // Host-authority: a room snapshot must come from the host we already
      // know (or, at bootstrap, from someone claiming to be its host). A
      // forged snapshot from another player — even one that embeds its own
      // id as hostId — is rejected here so `hostId` can never be hijacked.
      if (!isHostRoomSnapshotTrusted(state.room, event)) {
        console.warn('[online] dropped untrusted room snapshot from', event.playerId)
        return {}
      }
      return { room, roomCode: room.roomCode, players: room.players }
    }
    case 'PLAYER_JOINED': {
      const player = event.payload.player
      return { players: upsertPlayer(state.players, player) }
    }
    case 'PLAYER_LEFT': {
      return { players: state.players.filter((player) => player.id !== event.payload.playerId) }
    }
    case 'PLAYER_LEFT_ROOM': {
      // Our own broadcast echoes back (broadcast.self). The sender already
      // cleaned up locally, so ignore the echo to keep the state consistent.
      if (state.self && event.playerId === state.self.id) return {}
      cancelledRoomId = event.roomId
      const hostLeft = state.room?.hostId === event.playerId
      return {
        room: null,
        self: null,
        players: [],
        roomCode: null,
        error: hostLeft
          ? 'تم إلغاء الروم لأن المضيف غادر.'
          : 'تم إلغاء الروم لأن اللاعب الآخر غادر.',
      }
    }
    case 'GAME_STARTED':
      return state.room
        ? { room: { ...state.room, status: 'playing', updatedAt: Date.now() } }
        : {}
    case 'GAME_FINISHED':
      return state.room
        ? { room: { ...state.room, status: 'finished', updatedAt: Date.now() } }
        : {}
    default:
      // Gameplay events (TURN_CHANGED, QUESTION_SELECTED, ANSWER_REVEALED,
      // SCORE_UPDATED, LIFELINE_USED) are consumed in the gameplay phase.
      return {}
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected online error.'
}

export const useOnlineStore = create<OnlineState>()((set, get) => ({
  room: null,
  self: null,
  players: [],
  roomCode: null,
  connectionStatus: 'idle',
  lastEvent: null,
  error: null,

  createRoom: async (input) => {
    ensureWired()
    if (!input.playerName.trim()) {
      set({ error: 'Player name is required.' })
      return false
    }
    set({ error: null, connectionStatus: 'connecting' })
    try {
      // A brand-new room must never inherit the previous match's categories,
      // lifelines, scores, used cells or turn state — wipe them all first.
      // This is a NEW session, not a reconnect, so resetting is correct here.
      resetOnlineMatchState()
      const session = await createOnlineRoom(input)
      cancelledRoomId = null
      set({
        room: session.room,
        self: session.self,
        players: session.room.players,
        roomCode: session.room.roomCode,
        connectionStatus: 'connected',
      })
      return true
    } catch (error) {
      set({ error: errorMessage(error), connectionStatus: 'error' })
      return false
    }
  },

  joinRoom: async (input) => {
    ensureWired()
    if (!input.playerName.trim()) {
      set({ error: 'Player name is required.' })
      return false
    }
    set({ error: null, connectionStatus: 'connecting' })
    try {
      const session = await joinOnlineRoom(input)
      cancelledRoomId = null
      set({
        room: session.room,
        self: session.self,
        players: session.room.players,
        roomCode: session.room.roomCode,
        connectionStatus: 'connected',
      })
      return true
    } catch (error) {
      set({ error: errorMessage(error), connectionStatus: 'error' })
      return false
    }
  },

  leaveRoom: async (options) => {
    try {
      await leaveOnlineRoom(options)
    } finally {
      cancelledRoomId = null
      set({
        room: null,
        self: null,
        players: [],
        roomCode: null,
        connectionStatus: 'idle',
        lastEvent: null,
        // The leaver lands on the online hub with a confirmation message.
        error: options?.cancelRoom ? 'تم مغادرة الروم.' : null,
      })
    }
  },

  startGame: async (snapshot) => {
    const { room, self } = get()
    if (!room || !self || !self.isHost) return
    set({ error: null })
    try {
      await broadcastOnlineEvent('GAME_STARTED', {
        startedAt: Date.now(),
        board: snapshot,
      })
      // Optimistic local update; the self-broadcast keeps everyone in sync.
      set({ room: { ...room, status: 'playing', updatedAt: Date.now() } })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  setRoomCategories: async (categoryIds) => {
    ensureWired()
    const { room, self } = get()
    // Only the HOST may change the match categories; the joiner can never
    // override them (enforced in the service AND here).
    if (!room || !self || !self.isHost) return false
    set({ error: null })
    // Optimistic local update (same rationale as setRoomLifelines).
    set({ room: { ...room, categoryIds, updatedAt: Date.now() } })
    try {
      const updated = await updateHostRoom({ categoryIds })
      set({ room: updated, players: updated.players, roomCode: updated.roomCode })
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    }
  },

  setRoomLifelines: async (team1LifelineIds, team2LifelineIds) => {
    ensureWired()
    const { room, self } = get()
    // Only the HOST may configure the per-team lifelines; the joiner can
    // never override them (enforced in the service AND here).
    if (!room || !self || !self.isHost) return false
    set({ error: null })
    // Optimistic local update: rapid host toggles must read the freshest
    // selection before the ROOM_STATE broadcast echo returns, otherwise a
    // fast 3rd click reads stale state and the 3rd lifeline is lost.
    set({ room: { ...room, team1LifelineIds, team2LifelineIds, updatedAt: Date.now() } })
    try {
      const updated = await updateHostRoom({ team1LifelineIds, team2LifelineIds })
      set({ room: updated, players: updated.players, roomCode: updated.roomCode })
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    }
  },

  isHost: () => {
    const { room, self } = get()
    return self !== null && room !== null && self.id === room.hostId
  },

  reset: () => {
    void leaveOnlineRoom()
    set({
      room: null,
      self: null,
      players: [],
      roomCode: null,
      connectionStatus: 'idle',
      lastEvent: null,
      error: null,
    })
  },
}))

/** Re-exposed for the `useOnlineRoom` hook and future lobby screens. */
export { ensureWired as ensureOnlineWiring }
