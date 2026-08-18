import { describe, expect, it } from 'vitest'
import { isHostRoomSnapshotTrusted } from './onlineRoomService'
import type { OnlineGameEvent, OnlineRoom } from '../../types/online'

/**
 * Builds a minimal but fully-typed ROOM_STATE event. `roomId` / `hostId`
 * control the room inside the payload; `senderId` controls the envelope's
 * playerId (the client-supplied sender field).
 */
function roomStateEvent(
  roomId: string,
  hostId: string,
  senderId: string,
  type: 'ROOM_STATE' | 'GAME_CREATED' = 'ROOM_STATE',
): OnlineGameEvent {
  const room: OnlineRoom = {
    roomId,
    roomCode: 'ABC123',
    hostId,
    players: [],
    status: 'waiting',
    questionDuration: 30,
    maxPlayers: 2,
    categoryIds: [],
    team1LifelineIds: [],
    team2LifelineIds: [],
    createdAt: 1,
    updatedAt: 1,
  }
  return {
    type,
    roomId,
    playerId: senderId,
    sequence: 1,
    timestamp: 1,
    payload: { room },
  }
}

describe('isHostRoomSnapshotTrusted', () => {
  it('TEST 1 — accepts a ROOM_STATE from the known host', () => {
    const known = { roomId: 'room-1', hostId: 'host-1' }
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'host-1', 'host-1'))).toBe(true)
  })

  it('TEST 2 — rejects a ROOM_STATE from a normal (non-host) player', () => {
    const known = { roomId: 'room-1', hostId: 'host-1' }
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'host-1', 'player-2'))).toBe(false)
  })

  it('TEST 3 — rejects a forged ROOM_STATE embedding the attacker as hostId', () => {
    // Player-2 sends the room with hostId = player-2, hoping to hijack the host.
    const known = { roomId: 'room-1', hostId: 'host-1' }
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'player-2', 'player-2'))).toBe(false)
  })

  it('TEST 4 — rejects a snapshot for a different room, even from the known host', () => {
    const known = { roomId: 'room-1', hostId: 'host-1' }
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-2', 'host-1', 'host-1'))).toBe(false)
  })

  it('TEST 5 — rejects a snapshot whose internal hostId differs from the sender', () => {
    const known = { roomId: 'room-1', hostId: 'host-1' }
    // Sender claims to be the host in the envelope but the payload names
    // someone else as the host — inconsistent, never trusted.
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'player-2', 'host-1'))).toBe(false)
  })

  it('TEST 6 — rejects a sender who is NOT the host we already know', () => {
    const known = { roomId: 'room-1', hostId: 'host-1' }
    // A different (legit-looking) host id can never replace the pinned one.
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'host-2', 'host-2'))).toBe(false)
  })

  it('TEST 7a — bootstrap: accepts the first self-consistent snapshot when nothing is known yet', () => {
    // Joiner has no known room/host: the strongest client-side check is that
    // the sender claims to be the snapshot host — that is exactly what the
    // current bootstrap logic (waitForRoomState) relies on.
    expect(isHostRoomSnapshotTrusted(null, roomStateEvent('room-1', 'host-1', 'host-1'))).toBe(true)
  })

  it('TEST 7b — bootstrap: rejects a snapshot whose sender is not its claimed host', () => {
    // Naive forgery at bootstrap: sender != payload host -> filtered even
    // with no prior knowledge.
    expect(isHostRoomSnapshotTrusted(null, roomStateEvent('room-1', 'host-1', 'player-2'))).toBe(false)
  })

  it('TEST 7c — bootstrap: a fully forged envelope (sender = payload host) still passes — documented residual', () => {
    // No server authority exists in classic online: an attacker that forges
    // the WHOLE envelope (playerId === hostId) cannot be distinguished at
    // bootstrap. This test pins the current behavior so it stays explicit.
    expect(isHostRoomSnapshotTrusted(null, roomStateEvent('room-1', 'attacker-9', 'attacker-9'))).toBe(true)
  })

  it('accepts duplicate ROOM_STATE re-broadcasts from the known host (idempotent, not sequence-blocked)', () => {
    const known = { roomId: 'room-1', hostId: 'host-1' }
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'host-1', 'host-1'))).toBe(true)
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'host-1', 'host-1'))).toBe(true)
  })

  it('guards GAME_CREATED with the same rules as ROOM_STATE', () => {
    const known = { roomId: 'room-1', hostId: 'host-1' }
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'host-1', 'host-1', 'GAME_CREATED'))).toBe(true)
    expect(isHostRoomSnapshotTrusted(known, roomStateEvent('room-1', 'host-1', 'player-2', 'GAME_CREATED'))).toBe(false)
  })

  it('lets non-snapshot events pass through untouched', () => {
    const event = {
      type: 'GAME_FINISHED',
      roomId: 'room-1',
      playerId: 'host-1',
      sequence: 2,
      timestamp: 2,
      payload: { winner: null, team1Score: 0, team2Score: 0 },
    } as OnlineGameEvent
    expect(isHostRoomSnapshotTrusted({ roomId: 'room-1', hostId: 'host-1' }, event)).toBe(true)
  })
})
