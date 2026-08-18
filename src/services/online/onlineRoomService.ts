import type { RealtimeChannelSendResponse } from '@supabase/supabase-js'
import type {
  OnlineConnectionStatus,
  OnlineEventMap,
  OnlineGameEvent,
  OnlineGameEventType,
  OnlineMaxPlayers,
  OnlinePlayer,
  OnlinePresenceState,
  OnlineQuestionDuration,
  OnlineRoom,
  OnlineRoomSession,
} from '../../types/online'
import type { TeamId } from '../../types/game'
import {
  connectToRoomChannel,
  disconnectFromRoomChannel,
  sendOnlineBroadcast,
  setOnlineChannelCallbacks,
  trackOnlinePresence,
} from './onlineChannel'
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode'

export interface CreateRoomInput {
  playerName: string
  gameName?: string
  /** Question countdown in seconds; the host alone picks it before creating. */
  questionDuration?: OnlineQuestionDuration
  /**
   * Maximum players the room accepts (2-6). Defaults to 2. The host is the
   * sole authority; the joiner can never change it.
   */
  maxPlayers?: OnlineMaxPlayers
}

export interface JoinRoomInput {
  roomCode: string
  playerName: string
}

type OnlineEventListener = (event: OnlineGameEvent) => void
type OnlineStatusListener = (status: OnlineConnectionStatus) => void
type OnlinePlayersListener = (players: OnlinePlayer[]) => void

/** Timeout for a joiner waiting for the host's authoritative room snapshot. */
const ROOM_STATE_TIMEOUT_MS = 8000

/** Absolute ceiling for any online room (2-6). */
const MAX_ROOM_PLAYERS = 6

/** Normalizes a host-provided maxPlayers value to the valid 2-6 range. */
function normalizeMaxPlayers(value: OnlineMaxPlayers | undefined): OnlineMaxPlayers {
  if (typeof value !== 'number' || Number.isNaN(value)) return 2
  const clamped = Math.min(MAX_ROOM_PLAYERS, Math.max(2, Math.round(value)))
  return clamped as OnlineMaxPlayers
}

const eventListeners = new Set<OnlineEventListener>()
const statusListeners = new Set<OnlineStatusListener>()
const playersListeners = new Set<OnlinePlayersListener>()

let session: OnlineRoomSession | null = null
let wiredCallbacks = false
let sequence = 0

/** Monotonic per-sender counter so receivers can detect stale/duplicate events. */
function nextSequence(): number {
  sequence += 1
  return sequence
}

/**
 * Client-side authority check for host-owned room snapshots
 * (`ROOM_STATE` / `GAME_CREATED`).
 *
 * A snapshot is only trusted when:
 *  1. the envelope's sender claims to BE the snapshot's host
 *     (`event.playerId === payload.room.hostId`), and
 *  2. when the receiver already knows this room, the sender is exactly the
 *     host it already trusts, and the host identity has not changed
 *     (this codebase has no host-promotion mechanism).
 *
 * IMPORTANT: this is a CLIENT-SIDE MITIGATION. The Realtime broadcast
 * envelope carries no server-verified sender identity (`event.playerId` is
 * client-supplied and forgeable), so it cannot stop a determined attacker
 * who forges the whole envelope — it only filters out naive/accidental
 * forgeries and raises the bar. Real authority needs a server-backed
 * mechanism (see the architecture audit).
 */
export function isHostRoomSnapshotTrusted(
  knownRoom: Pick<OnlineRoom, 'roomId' | 'hostId'> | null,
  event: OnlineGameEvent,
): boolean {
  if (event.type !== 'ROOM_STATE' && event.type !== 'GAME_CREATED') return true
  const claimedRoom = event.payload.room

  // The envelope's room must match the room inside the snapshot.
  if (event.roomId !== claimedRoom.roomId) return false
  // The sender must be the snapshot's own host — otherwise any player could
  // re-broadcast a snapshot and claim to be the host inside its payload.
  if (event.playerId !== claimedRoom.hostId) return false

  // If we already know this room, only the host we already trust may update
  // it, and the host identity must never change through a snapshot.
  if (knownRoom && knownRoom.roomId === claimedRoom.roomId) {
    if (event.playerId !== knownRoom.hostId) return false
    if (claimedRoom.hostId !== knownRoom.hostId) return false
  }
  // A snapshot for a DIFFERENT room id than the one we know is not ours —
  // the channel is room-scoped, so this is either garbage or a forgery.
  if (knownRoom && knownRoom.roomId !== claimedRoom.roomId) return false

  return true
}

/**
 * Subscribe to every online event that arrives on the connected room
 * channel. Returns an unsubscribe function.
 */
export function subscribeToOnlineEvents(listener: OnlineEventListener): () => void {
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

/**
 * Subscribe to Realtime connection status changes.
 */
export function subscribeToOnlineStatus(listener: OnlineStatusListener): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

/**
 * Subscribe to the connected player list (derived from Realtime presence).
 */
export function subscribeToOnlinePlayers(listener: OnlinePlayersListener): () => void {
  playersListeners.add(listener)
  return () => playersListeners.delete(listener)
}

/**
 * Wires the module-level channel callbacks exactly once per session.
 * Listener sets above survive reconnects; the flag is reset on leave.
 */
function ensureChannelCallbacks(): void {
  if (wiredCallbacks) return
  wiredCallbacks = true

  setOnlineChannelCallbacks({
    onStatusChange: (status) => {
      for (const listener of statusListeners) listener(status)
    },
    onEvent: (event) => {
      if (event.type === 'ROOM_STATE' && session) {
        if (isHostRoomSnapshotTrusted(session.room, event)) {
          session = { room: event.payload.room, self: session.self }
        } else {
          console.warn('[online] dropped untrusted ROOM_STATE from', event.playerId)
        }
      }
      for (const listener of eventListeners) listener(event)

      // A player intentionally left → the whole room is cancelled. Both the
      // remote player AND our own self-echo reach this handler; the first one
      // to see it tears our channel down. Subsequent duplicates are no-ops
      // because the session is already gone.
      if (event.type === 'PLAYER_LEFT_ROOM' && session && event.roomId === session.room.roomId) {
        void leaveOnlineRoom()
      }
    },
    onPresence: (presence) => {
      const players = playersFromPresence(presence)
      for (const listener of playersListeners) listener(players)

      // The host re-broadcasts the authoritative room snapshot whenever the
      // connected player set changes, so joiners and rejoiners converge.
      if (session && session.self.isHost) {
        const room: OnlineRoom = { ...session.room, players, updatedAt: Date.now() }
        session = { ...session, room }
        void sendOnlineBroadcast({
          type: 'ROOM_STATE',
          roomId: room.roomId,
          playerId: session.self.id,
          sequence: nextSequence(),
          timestamp: Date.now(),
          payload: { room },
        })
      }
    },
  })
}

function createPlayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function buildPlayer(name: string, isHost: boolean): OnlinePlayer {
  const trimmed = name.trim()
  return {
    id: createPlayerId(),
    name: trimmed || (isHost ? 'Host' : 'Player'),
    isHost,
    connected: true,
    joinedAt: Date.now(),
  }
}

function presenceOf(player: OnlinePlayer): OnlinePresenceState {
  return {
    playerId: player.id,
    name: player.name,
    isHost: player.isHost,
    onlineAt: player.joinedAt,
  }
}

function playersFromPresence(presence: OnlinePresenceState[]): OnlinePlayer[] {
  return presence.map((entry) => ({
    id: entry.playerId,
    name: entry.name,
    isHost: entry.isHost,
    connected: true,
    joinedAt: entry.onlineAt,
  }))
}

function broadcastEvent<T extends OnlineGameEventType>(
  type: T,
  payload: OnlineEventMap[T],
): Promise<RealtimeChannelSendResponse> {
  if (!session) return Promise.reject(new Error('Not connected to an online room.'))
  return sendOnlineBroadcast({
    type,
    roomId: session.room.roomId,
    playerId: session.self.id,
    sequence: nextSequence(),
    timestamp: Date.now(),
    payload,
  } as OnlineGameEvent)
}

/**
 * Broadcast a typed online event to everyone in the room (including self,
 * because the channel is configured with `broadcast.self = true`).
 */
export function broadcastOnlineEvent<T extends OnlineGameEventType>(
  type: T,
  payload: OnlineEventMap[T],
): Promise<RealtimeChannelSendResponse> {
  return broadcastEvent(type, payload)
}

interface RoomStateWaiter {
  promise: Promise<OnlineRoom>
  cancel: () => void
}

/**
 * Resolves with the first `ROOM_STATE` event, or rejects after `timeoutMs`.
 * Used by joiners, who learn the room id / host from the host's snapshot.
 */
function waitForRoomState(timeoutMs: number): RoomStateWaiter {
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined

  const promise = new Promise<OnlineRoom>((resolve, reject) => {
    unsubscribe = subscribeToOnlineEvents((event) => {
      if (event.type !== 'ROOM_STATE' || settled) return
      // Bootstrap: the joiner has no known host yet, so the strongest
      // client-side check available is that the sender claims to be the
      // snapshot's host (any player re-broadcasting with a different sender
      // id is rejected).
      if (!isHostRoomSnapshotTrusted(null, event)) return
      settled = true
      if (timer) clearTimeout(timer)
      unsubscribe?.()
      resolve(event.payload.room)
    })

    timer = setTimeout(() => {
      if (settled) return
      settled = true
      unsubscribe?.()
      reject(new Error('Timed out waiting for the host room state.'))
    }, timeoutMs)
  })

  return {
    promise,
    cancel: () => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      unsubscribe?.()
    },
  }
}

/**
 * Creates a new room and connects the local client as its host.
 * The room code is generated locally; a future `online_rooms` table can
 * enforce global uniqueness.
 */
export async function createOnlineRoom(input: CreateRoomInput): Promise<OnlineRoomSession> {
  const host = buildPlayer(input.playerName, true)
  const room: OnlineRoom = {
    roomId: createPlayerId(),
    roomCode: generateRoomCode(),
    hostId: host.id,
    gameName: input.gameName?.trim() || undefined,
    players: [host],
    status: 'waiting',
    questionDuration: input.questionDuration ?? 30,
    maxPlayers: normalizeMaxPlayers(input.maxPlayers),
    // A brand-new room ALWAYS starts with no categories and no lifeline
    // selections — the host picks all of them fresh in the lobby, so no
    // previous match can leak categories or lifelines into a new room.
    categoryIds: [],
    team1LifelineIds: [],
    team2LifelineIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  ensureChannelCallbacks()
  const status = await connectToRoomChannel({
    roomCode: room.roomCode,
    selfPlayerId: host.id,
    presence: presenceOf(host),
  })
  if (status !== 'connected') {
    throw new Error('Could not connect to the online room. Check your connection and try again.')
  }

  session = { room, self: host }
  await trackOnlinePresence(presenceOf(host))
  await broadcastEvent('GAME_CREATED', { room })
  return { room, self: host }
}

/**
 * Joins an existing room by its short code and waits for the host to send
 * the authoritative room snapshot before resolving.
 */
export async function joinOnlineRoom(input: JoinRoomInput): Promise<OnlineRoomSession> {
  const roomCode = normalizeRoomCode(input.roomCode)
  if (!isValidRoomCode(roomCode)) {
    throw new Error('Invalid room code. Codes look like ABC123.')
  }

  const player = buildPlayer(input.playerName, false)
  const roomState = waitForRoomState(ROOM_STATE_TIMEOUT_MS)

  try {
    ensureChannelCallbacks()
    const status = await connectToRoomChannel({
      roomCode,
      selfPlayerId: player.id,
      presence: presenceOf(player),
    })
    if (status !== 'connected') {
      throw new Error('Could not connect to the online room. Check the room code and your connection.')
    }

    await trackOnlinePresence(presenceOf(player))
    const room = await roomState.promise
    // The joiner may appear in the players list already (their own presence
    // was tracked), so count the room excluding the joining player: if the
    // room is already at its host-chosen capacity, reject the join.
    const occupied = room.players.filter((entry) => entry.id !== player.id).length
    if (occupied >= room.maxPlayers) {
      // The joiner's presence was already tracked — leave the channel so the
      // host's next ROOM_STATE no longer lists them.
      await disconnectFromRoomChannel()
      throw new Error(`الغرفة ممتلئة — الحد الأقصى ${room.maxPlayers} لاعبين.`)
    }
    session = { room, self: player }
    return { room, self: player }
  } catch (error) {
    roomState.cancel()
    throw error
  }
}

/**
 * Leaves the current room: untracks presence, unsubscribes from the
 * channel, and clears the session.
 *
 * With `cancelRoom: true` the WHOLE room is cancelled: the other player is
 * notified BEFORE the channel is torn down, and the local room status is
 * marked `cancelled`. With `cancelRoom: false` (default — used by the
 * Results cleanup) the room is simply left silently.
 */
export async function leaveOnlineRoom(options?: { cancelRoom?: boolean }): Promise<void> {
  const current = session

  if (options?.cancelRoom && current) {
    // 1. Notify the other player FIRST, while the channel is still live.
    const team: TeamId = current.self.isHost ? 1 : 2
    await broadcastEvent('PLAYER_LEFT_ROOM', {
      playerId: current.self.id,
      team,
      reason: 'left',
    }).catch(() => {
      // A failed send must never block the local cleanup.
    })
    // 2. Mark the room cancelled locally; the store clears it afterwards.
    session = {
      room: { ...current.room, status: 'cancelled', updatedAt: Date.now() },
      self: current.self,
    }
  }

  // 3. Stop listeners, untrack presence, leave the channel, clear session.
  await disconnectFromRoomChannel()
  session = null
  wiredCallbacks = false
  setOnlineChannelCallbacks({})
}

/**
 * Host-only helper: updates the shared room and re-broadcasts `ROOM_STATE`
 * so every connected player converges on the new value (used for the host's
 * category selection in the lobby). Non-hosts are rejected.
 */
export async function updateHostRoom(patch: Partial<OnlineRoom>): Promise<OnlineRoom> {
  if (!session || !session.self.isHost) {
    throw new Error('Only the host can change the room setup.')
  }
  const room: OnlineRoom = {
    ...session.room,
    ...patch,
    players: session.room.players,
    roomId: session.room.roomId,
    roomCode: session.room.roomCode,
    hostId: session.room.hostId,
    updatedAt: Date.now(),
  }
  session = { ...session, room }
  await broadcastEvent('ROOM_STATE', { room })
  return room
}

export function getOnlineSession(): OnlineRoomSession | null {
  return session
}

export function isOnlineRoomHost(): boolean {
  return session !== null && session.self.isHost
}
