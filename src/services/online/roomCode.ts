/**
 * Short, human-friendly room codes.
 *
 * The alphabet deliberately excludes ambiguous characters (0/O, 1/I/L)
 * so codes can be read out loud and typed reliably on any keyboard.
 */

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6
const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`)

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase()
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(code))
}

export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}
