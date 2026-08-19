import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './authService'

/**
 * M8 — Admin login user enumeration regression tests.
 *
 * All authentication failures must return the same generic message
 * regardless of error type, preventing attackers from distinguishing
 * between non-existent emails, wrong passwords, non-admin users,
 * or unconfirmed emails.
 */

const GENERIC_EN = 'Invalid login credentials. Please try again.'
const GENERIC_AR = 'بيانات تسجيل الدخول غير صحيحة. حاول مرة أخرى.'

describe('M8 — Auth error message enumeration prevention', () => {
  it('returns generic message for invalid login credentials', () => {
    const error = new Error('Invalid login credentials')
    expect(getAuthErrorMessage(error, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(error, false)).toBe(GENERIC_AR)
  })

  it('returns generic message for email not confirmed', () => {
    const error = new Error('Email not confirmed')
    expect(getAuthErrorMessage(error, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(error, false)).toBe(GENERIC_AR)
  })

  it('returns generic message for user already registered', () => {
    const error = new Error('User already registered')
    expect(getAuthErrorMessage(error, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(error, false)).toBe(GENERIC_AR)
  })

  it('returns generic message for password too weak', () => {
    const error = new Error('Password should be at least 6 characters')
    expect(getAuthErrorMessage(error, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(error, false)).toBe(GENERIC_AR)
  })

  it('returns generic message for network/server errors', () => {
    const error = new Error('Network request failed')
    expect(getAuthErrorMessage(error, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(error, false)).toBe(GENERIC_AR)
  })

  it('returns generic message for non-Error values', () => {
    expect(getAuthErrorMessage('raw string', true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(null, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(undefined, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage(42, true)).toBe(GENERIC_EN)
    expect(getAuthErrorMessage('raw string', false)).toBe(GENERIC_AR)
  })

  it('returns identical messages for all error types in same language', () => {
    const errorTypes = [
      new Error('Invalid login credentials'),
      new Error('Email not confirmed'),
      new Error('User already registered'),
      new Error('Password too weak'),
      new Error('Something went wrong'),
      new Error('Account locked'),
      'string error',
      null,
      undefined,
    ]

    const enMessages = errorTypes.map((e) => getAuthErrorMessage(e, true))
    const arMessages = errorTypes.map((e) => getAuthErrorMessage(e, false))

    // All English messages must be identical
    expect(new Set(enMessages).size).toBe(1)
    // All Arabic messages must be identical
    expect(new Set(arMessages).size).toBe(1)
    // English and Arabic must differ (proving i18n works)
    expect(enMessages[0]).not.toBe(arMessages[0])
  })
})
