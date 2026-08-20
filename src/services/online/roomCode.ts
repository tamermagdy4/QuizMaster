/**
 * Short, numeric-only room codes.
 *
 * 6-digit codes provide 1,000,000 possible values — more than enough to
 * avoid collisions in a room-based system with short-lived sessions.
 * Using digits only makes codes easy to type and read on any device.
 * Codes are zero-padded (e.g. 040938) for mobile friendliness.
 */

const ROOM_CODE_LENGTH = 6
const ROOM_CODE_PATTERN = /^\d{6}$/

export function normalizeRoomCode(code: string): string {
  // Strip spaces and non-numeric characters
  return code.replace(/[^0-9]/g, '').trim()
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(code))
}

/**
 * Generates a random 6-digit numeric room code.
 * Codes are zero-padded (e.g. 040938) — leading zeros are valid.
 * This matches the Sporcle-style numeric codes (963348, 040938, etc.).
 */
export function generateRoomCode(_length: number = ROOM_CODE_LENGTH): string {
  const num = Math.floor(Math.random() * 1_000_000)
  return String(num).padStart(ROOM_CODE_LENGTH, '0')
}
