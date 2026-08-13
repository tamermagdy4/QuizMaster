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
  error: unknown,
  english: boolean,
) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : ''

  if (message.includes('invalid login credentials')) {
    return english
      ? 'The email or password is incorrect.'
      : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  }

  if (message.includes('email not confirmed')) {
    return english
      ? 'Please confirm your email before signing in.'
      : 'يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.'
  }

  if (message.includes('user already registered')) {
    return english
      ? 'This email is already registered.'
      : 'هذا البريد الإلكتروني مسجل بالفعل.'
  }

  if (message.includes('password')) {
    return english
      ? 'Please check the password requirements.'
      : 'يرجى التحقق من متطلبات كلمة المرور.'
  }

  return error instanceof Error && error.message
    ? error.message
    : english
      ? 'Something went wrong. Please try again.'
      : 'حدث خطأ. حاول مرة أخرى.'
}