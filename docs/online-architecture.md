# Online Multiplayer — Architecture

This document describes the **foundation** for Online Multiplayer mode in فهلوي.
It does **not** touch the Local Game: `GameBoard`, scoring, turns, lifelines,
question loading, Zustand game stores, Supabase question system, or navigation
are unchanged.

## Goal

```text
فهلوي
│
├── Local Game   (unchanged)
│
└── Online Game  (new, layered on top of the existing system)
```

## Layering

```text
UI (future Online screens)
    ↓
useOnlineRoom (hook) ───────────┐
    ↓                           │
onlineStore (Zustand session) ──┤  Online Sync Layer
    ↓                           │
onlineRoomService ──────────────┤
    ↓                           │
onlineChannel ──────────────────┘
    ↓
supabaseClient (existing) → Supabase Realtime (Broadcast + Presence)
```

The Online Sync Layer sits **between** the existing Zustand stores and
Supabase. In the next phase, `gameBoardStore` will be wired to
`onlineStore`'s event stream: local state changes → broadcast events →
remote clients apply them to their own `gameBoardStore`.

## Files

| File | Responsibility |
| --- | --- |
| `src/types/online.ts` | Rooms, players, presence, the full event catalogue, envelope + runtime guard |
| `src/services/online/roomCode.ts` | Short room-code generation / validation (unambiguous alphabet, e.g. `ABC123`) |
| `src/services/online/onlineChannel.ts` | Low-level Realtime channel: connect, presence tracking, broadcast send, disconnect, status callbacks |
| `src/services/online/onlineRoomService.ts` | Room lifecycle: create / join / leave / start, listener subscriptions, typed event broadcast, host state reconciliation |
| `src/store/onlineStore.ts` | Zustand session state: room, self, players, connection status, last event, error, actions |
| `src/hooks/useOnlineRoom.ts` | React entry point for Online screens |

## Room model

```text
OnlineRoom { roomId, roomCode, hostId, gameName?, players[], status, createdAt, updatedAt }
status: 'waiting' | 'playing' | 'finished'
```

- **roomId** — internal UUID, generated client-side.
- **roomCode** — short shareable code (`ABC123`); also the Realtime channel
  topic (`online-game:ABC123`), so joining by code needs no database lookup.
- **players** — membership list; the **host** owns the authoritative snapshot
  and broadcasts it as `ROOM_STATE` whenever presence changes.
- **presence** — Supabase Presence is the source of truth for *who is online
  right now*; disconnected players drop out of presence without leaving the room.

No authentication is required: players join with just a **name** + **room code**.
No sensitive data is stored.

## Events

All events travel in a single broadcast event with a typed envelope:

```ts
{ type, roomId, playerId, timestamp, payload }
```

Catalogue (from `OnlineEventMap`):

| Event | Status |
| --- | --- |
| `GAME_CREATED` | dispatched by host on room creation |
| `PLAYER_JOINED` / `PLAYER_LEFT` | typed; presence is the primary signal, these are convenience events |
| `GAME_STARTED` / `GAME_FINISHED` | room lifecycle, dispatched by host (`startGame` stub exists) |
| `TURN_CHANGED` / `QUESTION_SELECTED` / `ANSWER_REVEALED` / `SCORE_UPDATED` / `LIFELINE_USED` | **typed now, consumed in the gameplay phase** |
| `ROOM_STATE` | internal: full-room snapshot the host broadcasts to reconcile joiners/rejoiners |

## Flows

### Host creates a room
1. Generate `roomId` + `roomCode`, build host player.
2. Connect to channel `online-game:<code>` (`broadcast.self = true`).
3. Track presence → host's own presence sync re-broadcasts `ROOM_STATE`.
4. Broadcast `GAME_CREATED`.
5. Store converges on the same state through both the direct return value and the self-received events.

### Player joins by code
1. Validate code, build player.
2. Subscribe a one-shot `ROOM_STATE` waiter (8s timeout) *before* connecting.
3. Connect + track presence → host sees the new presence → broadcasts `ROOM_STATE`.
4. Resolve with the authoritative room.

### Leave
Untrack presence, unsubscribe from the channel, clear the session and callbacks.

### Host disconnects
Other clients detect the host's absence through presence and surface an error
(`The host left the room.`).

## Notes / future work

- **Room persistence** — rooms are ephemeral (Realtime only). A future
  `online_rooms` migration can persist rooms, enforce code uniqueness, and
  allow reconnecting by `roomId`.
- **Gameplay wiring** — next phase: subscribe `gameBoardStore` mutations,
  map them to events, apply remote events to the local store. No store is
  replaced; the Online Sync Layer is additive.
- **Auth** — currently anonymous. Supabase Auth can be layered on later; the
  channel/presence/broadcast code is auth-agnostic.
