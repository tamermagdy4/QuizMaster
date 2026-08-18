import type {
  RealtimeChannel,
  RealtimeChannelSendResponse,
  RealtimePresenceState,
} from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isValidOnlineEventPayload } from '../../domain/contracts'
import {
  isOnlineGameEvent,
  type OnlineConnectionStatus,
  type OnlineGameEvent,
  type OnlinePresenceState,
} from '../../types/online'
import { normalizeRoomCode } from './roomCode'

/**
 * Single broadcast event name. Every typed `OnlineGameEvent` travels inside
 * the payload of this broadcast event, so clients subscribe to one name and
 * dispatch on `event.type`.
 */
const BROADCAST_EVENT = 'online-game-event'

export interface OnlineChannelCallbacks {
  onStatusChange?: (status: OnlineConnectionStatus) => void
  onEvent?: (event: OnlineGameEvent) => void
  onPresence?: (presence: OnlinePresenceState[]) => void
}

export interface ConnectChannelInput {
  roomCode: string
  selfPlayerId: string
  presence: OnlinePresenceState
}

let roomChannel: RealtimeChannel | null = null
let connectedRoomCode: string | null = null
let callbacks: OnlineChannelCallbacks = {}

export function setOnlineChannelCallbacks(next: OnlineChannelCallbacks): void {
  callbacks = next
}

export function getConnectedRoomCode(): string | null {
  return connectedRoomCode
}

function presenceList(state: RealtimePresenceState<OnlinePresenceState>): OnlinePresenceState[] {
  const list: OnlinePresenceState[] = []
  for (const key of Object.keys(state)) {
    const entry = state[key]?.[0]
    if (entry) list.push(entry)
  }
  return list.sort((a, b) => a.onlineAt - b.onlineAt)
}

/**
 * Connects to the Realtime channel of the given room code and tracks the
 * local client's presence. Resolves with the first channel status; later
 * status changes are delivered through `onStatusChange`.
 */
export async function connectToRoomChannel(input: ConnectChannelInput): Promise<OnlineConnectionStatus> {
  await disconnectFromRoomChannel()
  const supabase = getSupabaseClient()
  const roomCode = normalizeRoomCode(input.roomCode)
  connectedRoomCode = roomCode

  const channel = supabase.channel(`online-game:${roomCode}`, {
    config: {
      broadcast: { self: true },
      presence: { key: input.selfPlayerId },
    },
  })

  channel
    .on('broadcast', { event: BROADCAST_EVENT }, (payload) => {
      const event = payload.payload
      // Untrusted boundary: the broadcast envelope is client-supplied, so
      // every event must pass BOTH the envelope guard and the payload
      // contract (allowed enum values, finite scores, well-formed rooms)
      // before it reaches the store or the gameplay sync.
      if (!isOnlineGameEvent(event)) return
      if (!isValidOnlineEventPayload(event)) {
        console.warn('[online] dropped event with invalid payload', event.type, 'from', event.playerId)
        return
      }
      callbacks.onEvent?.(event)
    })
    .on('presence', { event: 'sync' }, () => {
      callbacks.onPresence?.(presenceList(channel.presenceState<OnlinePresenceState>()))
    })

  roomChannel = channel

  return new Promise<OnlineConnectionStatus>((resolve) => {
    channel.subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          callbacks.onStatusChange?.('connected')
          resolve('connected')
          break
        case 'CHANNEL_ERROR':
          callbacks.onStatusChange?.('error')
          resolve('error')
          break
        case 'TIMED_OUT':
          // The Realtime client keeps retrying in the background.
          callbacks.onStatusChange?.('reconnecting')
          resolve('reconnecting')
          break
        case 'CLOSED':
          callbacks.onStatusChange?.('disconnected')
          resolve('disconnected')
          break
      }
    })
  })
}

export async function trackOnlinePresence(presence: OnlinePresenceState): Promise<RealtimeChannelSendResponse> {
  if (!roomChannel) throw new Error('No online room channel is connected.')
  return roomChannel.track(presence)
}

export async function sendOnlineBroadcast(event: OnlineGameEvent): Promise<RealtimeChannelSendResponse> {
  if (!roomChannel) throw new Error('No online room channel is connected.')
  return roomChannel.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: event })
}

export async function disconnectFromRoomChannel(): Promise<void> {
  if (roomChannel) {
    try {
      await roomChannel.untrack()
    } catch {
      // The channel may already be closed.
    }
    try {
      await roomChannel.unsubscribe()
    } catch {
      // Ignore teardown errors.
    }
    roomChannel = null
  }
  connectedRoomCode = null
}
