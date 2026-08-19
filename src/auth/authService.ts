import type { AuthResponse } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import type { SignInInput, SignUpInput } from '../types/auth'

export async function signUp({
  email,
  password,
  displayName,
}: SignUpInput): Promise<AuthResponse['data']> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: displayName.trim(),
      },
    },
  })

  if (error) throw error

  return data
}

export async function signIn({
  email,
  password,
}: SignInInput): Promise<AuthResponse['data']> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) throw error

  return data
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut()

  if (error) throw error
}

export async function resetPassword(email: string) {
  const { error } =
    await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

  if (error) throw error
}

export function getAuthErrorMessage(
  _error: unknown,
  english: boolean,
) {
  return english
    ? 'Invalid login credentials. Please try again.'
    : 'بيانات تسجيل الدخول غير صحيحة. حاول مرة أخرى.'
}