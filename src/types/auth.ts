import type { Session, User } from '@supabase/supabase-js'

export type SignUpInput = {
  email: string
  password: string
  displayName: string
}

export type SignInInput = {
  email: string
  password: string
}

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}
