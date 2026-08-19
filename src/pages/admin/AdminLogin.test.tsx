import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * M8 — Admin login user enumeration regression tests (component logic).
 *
 * Verifies that the AdminLogin error handling logic never exposes
 * raw Supabase errors, account existence, or admin status.
 *
 * Since the test environment is node (no DOM), we test the error
 * message behavior by verifying the getAuthErrorMessage function
 * and the AdminLogin catch block logic produce identical generic
 * messages for all failure scenarios.
 */

vi.mock('../../lib/supabaseClient', () => ({
  getSupabaseClient: vi.fn(),
}))

vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn((selector) => {
    const state = { language: 'ar', setLanguage: vi.fn() }
    return selector(state)
  }),
}))

import { getSupabaseClient } from '../../lib/supabaseClient'
import { getAuthErrorMessage } from '../../auth/authService'

const GENERIC_AR = 'بيانات تسجيل الدخول غير صحيحة. حاول مرة أخرى.'

const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupabaseClient).mockReturnValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  } as unknown as ReturnType<typeof getSupabaseClient>)
})

/**
 * Simulates the AdminLogin.tsx error handling flow.
 * This mirrors the exact logic in AdminLogin.tsx handleSubmit:
 *
 *   catch { setError(english ? '...' : 'بيانات تسجيل الدخول غير صحيحة. حاول مرة أخرى.') }
 *
 * And the non-admin branch:
 *
 *   if (data.user?.app_metadata?.role !== 'admin') {
 *     await signOut();
 *     setError(english ? '...' : 'بيانات تسجيل الدخول غير صحيحة. حاول مرة أخرى.');
 *   }
 */
async function simulateAdminLoginFlow(
  email: string,
  password: string,
): Promise<{ errorMessage: string; signedOut: boolean }> {
  let errorMessage = ''
  let signedOut = false

  try {
    const { data, error: signInError } =
      await getSupabaseClient().auth.signInWithPassword({ email, password })

    if (signInError) throw signInError

    if (data.user?.app_metadata?.role !== 'admin') {
      await getSupabaseClient().auth.signOut()
      signedOut = true
      errorMessage = GENERIC_AR
      return { errorMessage, signedOut }
    }

    return { errorMessage: '', signedOut: false }
  } catch {
    errorMessage = GENERIC_AR
    return { errorMessage, signedOut: false }
  }
}

describe('M8 — AdminLogin flow enumeration prevention', () => {
  it('non-existent email + wrong password → generic message', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const result = await simulateAdminLoginFlow('ghost@test.com', 'wrong')

    expect(result.errorMessage).toBe(GENERIC_AR)
    expect(result.signedOut).toBe(false)
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'ghost@test.com',
      password: 'wrong',
    })
  })

  it('existing email + wrong password → generic message', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const result = await simulateAdminLoginFlow('user@test.com', 'wrong')

    expect(result.errorMessage).toBe(GENERIC_AR)
    expect(result.signedOut).toBe(false)
  })

  it('existing non-admin user → generic message + signOut called', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { app_metadata: { role: null } },
      },
      error: null,
    })
    mockSignOut.mockResolvedValue({ error: null })

    const result = await simulateAdminLoginFlow('user@test.com', 'correct')

    expect(result.errorMessage).toBe(GENERIC_AR)
    expect(result.signedOut).toBe(true)
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('valid admin user → no error, no signOut', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { app_metadata: { role: 'admin' } },
      },
      error: null,
    })

    const result = await simulateAdminLoginFlow('admin@test.com', 'correct')

    expect(result.errorMessage).toBe('')
    expect(result.signedOut).toBe(false)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('unconfirmed email → generic message (does not reveal account exists)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email not confirmed' },
    })

    const result = await simulateAdminLoginFlow('unconfirmed@test.com', 'pass')

    expect(result.errorMessage).toBe(GENERIC_AR)
    // Must not contain any hint about email confirmation
    expect(result.errorMessage).not.toContain('تأكيد')
    expect(result.errorMessage).not.toContain('confirm')
  })

  it('all failure paths produce identical error messages', async () => {
    const scenarios = [
      { data: { user: null }, error: { message: 'Invalid login credentials' } },
      { data: { user: null }, error: { message: 'Email not confirmed' } },
      { data: { user: null }, error: { message: 'User not found' } },
      {
        data: { user: { app_metadata: { role: null } } },
        error: null,
      },
    ]

    const results: string[] = []

    for (const scenario of scenarios) {
      mockSignInWithPassword.mockResolvedValue(scenario)
      mockSignOut.mockResolvedValue({ error: null })

      const result = await simulateAdminLoginFlow('test@test.com', 'pass')
      results.push(result.errorMessage)
    }

    // All failure paths must produce the same message
    expect(new Set(results).size).toBe(1)
    expect(results[0]).toBe(GENERIC_AR)
  })
})

describe('M8 — getAuthErrorMessage enumeration prevention', () => {
  const errorTypes = [
    new Error('Invalid login credentials'),
    new Error('Email not confirmed'),
    new Error('User already registered'),
    new Error('Password should be at least 6 characters'),
    new Error('Network request failed'),
    'raw string error',
    null,
    undefined,
    42,
  ]

  it('returns identical generic message for all error types in English', () => {
    const messages = errorTypes.map((e) => getAuthErrorMessage(e, true))
    expect(new Set(messages).size).toBe(1)
    expect(messages[0]).toBe('Invalid login credentials. Please try again.')
  })

  it('returns identical generic message for all error types in Arabic', () => {
    const messages = errorTypes.map((e) => getAuthErrorMessage(e, false))
    expect(new Set(messages).size).toBe(1)
    expect(messages[0]).toBe(
      'بيانات تسجيل الدخول غير صحيحة. حاول مرة أخرى.',
    )
  })

  it('never returns raw error details', () => {
    for (const error of errorTypes) {
      const msg = getAuthErrorMessage(error, true)
      // Must not contain raw Supabase error strings
      expect(msg).not.toContain('Email not confirmed')
      expect(msg).not.toContain('already registered')
      expect(msg).not.toContain('Password should be')
      expect(msg).not.toContain('Network request failed')
      // The generic message IS "Invalid login credentials. Please try again."
      // which is safe — it doesn't reveal which specific failure occurred
    }
  })
})
