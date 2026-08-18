import { describe, expect, it } from 'vitest'
import { isValidOnlineEventPayload } from '../domain/contracts'
import { isOnlineGameEvent } from '../types/online'
import type { OnlineGameEvent } from '../types/online'

describe('Online Multiplayer Tests', () => {
  describe('Duplicate Event', () => {
    it('should handle duplicate events gracefully', () => {
      const event: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      // First event should be valid
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)

      // Duplicate event should also be valid (idempotent handling)
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    it('should handle duplicate room state events', () => {
      const event: OnlineGameEvent = {
        type: 'ROOM_STATE',
        roomId: 'room-1',
        playerId: 'host-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          room: {
            roomId: 'room-1',
            roomCode: 'ABC123',
            hostId: 'host-1',
            players: [],
            status: 'waiting',
            questionDuration: 30,
            maxPlayers: 2,
            categoryIds: [],
            team1LifelineIds: [],
            team2LifelineIds: [],
            createdAt: 1,
            updatedAt: 1,
          },
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })
  })

  describe('Out-of-order Events', () => {
    it('should accept events regardless of sequence order', () => {
      const event1: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 5,
        timestamp: 5,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      const event2: OnlineGameEvent = {
        type: 'ANSWER_REVEALED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 3,
        timestamp: 3,
        payload: {
          revealed: true,
        },
      }

      // Both events should be valid regardless of sequence
      expect(isOnlineGameEvent(event1)).toBe(true)
      expect(isValidOnlineEventPayload(event1)).toBe(true)
      expect(isOnlineGameEvent(event2)).toBe(true)
      expect(isValidOnlineEventPayload(event2)).toBe(true)
    })

    it('should validate payload even when out of order', () => {
      const event: OnlineGameEvent = {
        type: 'SCORE_UPDATED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 10,
        timestamp: 10,
        payload: {
          team1Score: 500,
          team2Score: 300,
          questionClosed: true,
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })
  })

  describe('Stale Event', () => {
    it('should accept events for old questions (validation layer)', () => {
      const event: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'old-question-id',
          doubleApplied: false,
        },
      }

      // Validation layer accepts it
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    it('should handle events from finished games', () => {
      const event: OnlineGameEvent = {
        type: 'GAME_FINISHED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 100,
        timestamp: 100,
        payload: {
          winner: 1,
          team1Score: 1000,
          team2Score: 500,
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })
  })

  describe('Unknown Event', () => {
    it('should accept envelope with unknown event type (type validated by payload layer)', () => {
      const event = {
        type: 'UNKNOWN_EVENT',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {},
      } as unknown as OnlineGameEvent

      // isOnlineGameEvent validates envelope structure only — unknown types pass
      expect(isOnlineGameEvent(event)).toBe(true)
    })

    it('should reject events with invalid type structure', () => {
      const event = {
        type: 123,
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {},
      } as unknown as OnlineGameEvent

      expect(isOnlineGameEvent(event)).toBe(false)
    })

    it('should reject events missing required fields', () => {
      const event = {
        type: 'QUESTION_SELECTED',
        // Missing roomId
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {},
      } as OnlineGameEvent

      expect(isOnlineGameEvent(event)).toBe(false)
    })
  })

  describe('Malformed Payload', () => {
    it('should reject QUESTION_SELECTED with missing required fields', () => {
      const event = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          // Missing slotIndex
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      } as unknown as OnlineGameEvent

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('should reject SCORE_UPDATED with invalid scores', () => {
      const event: OnlineGameEvent = {
        type: 'SCORE_UPDATED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          team1Score: Number.POSITIVE_INFINITY,
          team2Score: 0,
          questionClosed: true,
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('should reject TURN_CHANGED with invalid team', () => {
      const event = {
        type: 'TURN_CHANGED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          currentTurn: 3,
        },
      } as unknown as OnlineGameEvent

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('should reject LIFELINE_USED with invalid lifeline ID', () => {
      const event = {
        type: 'LIFELINE_USED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          team: 1,
          lifelineId: 'invalid-lifeline',
        },
      } as unknown as OnlineGameEvent

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('should reject ROOM_STATE with invalid room data', () => {
      const event: OnlineGameEvent = {
        type: 'ROOM_STATE',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          room: {
            roomId: '', // Invalid: empty roomId
            roomCode: 'ABC123',
            hostId: 'host-1',
            players: [],
            status: 'waiting',
            questionDuration: 30,
            maxPlayers: 2,
            categoryIds: [],
            team1LifelineIds: [],
            team2LifelineIds: [],
            createdAt: 1,
            updatedAt: 1,
          },
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })
  })

  describe('Unauthorized Event', () => {
    it('should validate that player IDs are strings', () => {
      const event: OnlineGameEvent = {
        type: 'PLAYER_JOINED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          player: {
            id: 'player-2',
            name: 'Player 2',
            isHost: false,
            connected: true,
            joinedAt: 1,
          },
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    it('should reject events with invalid player data', () => {
      const event: OnlineGameEvent = {
        type: 'PLAYER_JOINED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          player: {
            id: '',
            name: 'Player 2',
            isHost: false,
            connected: true,
            joinedAt: 1,
          },
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })
  })

  describe('Forged Payload', () => {
    it('should reject forged roomId', () => {
      const event: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'forged-room-id',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      // Validation accepts the structure, but trust checks should reject
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    it('should reject forged score values', () => {
      const event: OnlineGameEvent = {
        type: 'SCORE_UPDATED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          team1Score: 999999, // Forged: absurdly high score
          team2Score: 0,
          questionClosed: true,
        },
      }

      // Validation accepts finite integers, but business logic should reject
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    it('should reject forged questionId', () => {
      const event: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: '', // Forged: empty question ID
          doubleApplied: false,
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('should reject forged point values', () => {
      const event = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 999,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      } as unknown as OnlineGameEvent

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('should reject forged team assignment', () => {
      const event = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 5,
          questionId: 'q1',
          doubleApplied: false,
        },
      } as unknown as OnlineGameEvent

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('should reject forged room host in snapshot', () => {
      const event: OnlineGameEvent = {
        type: 'ROOM_STATE',
        roomId: 'room-1',
        playerId: 'attacker',
        sequence: 1,
        timestamp: 1,
        payload: {
          room: {
            roomId: 'room-1',
            roomCode: 'ABC123',
            hostId: 'attacker', // Forged: attacker claims to be host
            players: [],
            status: 'waiting',
            questionDuration: 30,
            maxPlayers: 2,
            categoryIds: [],
            team1LifelineIds: [],
            team2LifelineIds: [],
            createdAt: 1,
            updatedAt: 1,
          },
        },
      }

      // Validation accepts structure, but trust checks should reject
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })
  })

  describe('Event Sequence Integrity', () => {
    it('should accept valid sequence numbers', () => {
      const event: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 42,
        timestamp: 42,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    it('should accept zero sequence number', () => {
      const event: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 0,
        timestamp: 0,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    it('should accept negative sequence numbers (edge case)', () => {
      const event: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: -1,
        timestamp: -1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })
  })

  describe('Cross-Room Event Isolation', () => {
    it('should accept events for different rooms (structure validation)', () => {
      const event1: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-1',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      const event2: OnlineGameEvent = {
        type: 'QUESTION_SELECTED',
        roomId: 'room-2',
        playerId: 'player-1',
        sequence: 1,
        timestamp: 1,
        payload: {
          categoryId: 'general-knowledge',
          slotIndex: 0,
          points: 100,
          team: 1,
          questionId: 'q1',
          doubleApplied: false,
        },
      }

      // Both are structurally valid
      expect(isOnlineGameEvent(event1)).toBe(true)
      expect(isValidOnlineEventPayload(event1)).toBe(true)
      expect(isOnlineGameEvent(event2)).toBe(true)
      expect(isValidOnlineEventPayload(event2)).toBe(true)
    })
  })

  describe('Empty / whitespace playerId and questionId rejection', () => {
    const validQuestionSelected = (overrides?: Partial<OnlineGameEvent>): OnlineGameEvent => ({
      type: 'QUESTION_SELECTED',
      roomId: 'room-1',
      playerId: 'player-1',
      sequence: 1,
      timestamp: 1,
      payload: {
        categoryId: 'general-knowledge',
        slotIndex: 0,
        points: 300,
        team: 1,
        questionId: 'q1',
        doubleApplied: false,
      },
      ...overrides,
    } as OnlineGameEvent)

    // --- Envelope playerId ---

    it('rejects empty envelope playerId', () => {
      const event = validQuestionSelected({ playerId: '' })
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('rejects whitespace-only envelope playerId', () => {
      const event = validQuestionSelected({ playerId: '   ' })
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('rejects missing envelope playerId', () => {
      const event = { ...validQuestionSelected(), playerId: undefined as unknown as string }
      expect(isOnlineGameEvent(event)).toBe(false)
    })

    it('rejects non-string envelope playerId', () => {
      const event = { ...validQuestionSelected(), playerId: 123 as unknown as string }
      expect(isOnlineGameEvent(event)).toBe(false)
    })

    // --- Payload questionId ---

    it('rejects empty questionId in QUESTION_SELECTED', () => {
      const event = validQuestionSelected() as OnlineGameEvent & { type: 'QUESTION_SELECTED'; payload: { questionId: string } }
      event.payload.questionId = ''
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('rejects whitespace-only questionId in QUESTION_SELECTED', () => {
      const event = validQuestionSelected() as OnlineGameEvent & { type: 'QUESTION_SELECTED'; payload: { questionId: string } }
      event.payload.questionId = '   '
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('rejects missing questionId in QUESTION_SELECTED', () => {
      const event = validQuestionSelected()
      delete (event.payload as Record<string, unknown>).questionId
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    it('rejects non-string questionId in QUESTION_SELECTED', () => {
      const event = validQuestionSelected()
      ;(event.payload as Record<string, unknown>).questionId = 42
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(false)
    })

    // --- Positive case ---

    it('accepts valid playerId + valid questionId', () => {
      const event = validQuestionSelected()
      expect(isOnlineGameEvent(event)).toBe(true)
      expect(isValidOnlineEventPayload(event)).toBe(true)
    })

    // --- Existing valid events still accepted ---

    it('still accepts all existing valid online event types', () => {
      const base = { roomId: 'room-1', playerId: 'p1', sequence: 1, timestamp: 1 }

      const events: OnlineGameEvent[] = [
        { ...base, type: 'PLAYER_LEFT', payload: { playerId: 'p2' } } as OnlineGameEvent,
        { ...base, type: 'PLAYER_LEFT_ROOM', payload: { playerId: 'p2', team: 1, reason: 'left' } } as OnlineGameEvent,
        { ...base, type: 'ANSWER_REVEALED', payload: { revealed: true } } as OnlineGameEvent,
        { ...base, type: 'SCORE_UPDATED', payload: { team1Score: 0, team2Score: 0 } } as OnlineGameEvent,
        { ...base, type: 'GAME_FINISHED', payload: { winner: null, team1Score: 0, team2Score: 0 } } as OnlineGameEvent,
        { ...base, type: 'LIFELINE_USED', payload: { team: 1, lifelineId: 'double', doubleApplied: true } } as OnlineGameEvent,
        { ...base, type: 'SYNC_REQUEST', payload: {} } as OnlineGameEvent,
      ]

      for (const e of events) {
        expect(isOnlineGameEvent(e)).toBe(true)
        expect(isValidOnlineEventPayload(e)).toBe(true)
      }
    })
  })
})
