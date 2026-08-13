import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { useAppStore } from '../../store/appStore'
interface AdminGuardProps { children: ReactNode }
function isAdmin(user: User | null) { return user?.app_metadata?.role === 'admin' }
export function AdminGuard({ children }: AdminGuardProps) { const location = useLocation(); const language = useAppStore((s) => s.language); const [user, setUser] = useState<User | null>(null); const [isLoading, setIsLoading] = useState(true); useEffect(() => { const supabase = getSupabaseClient(); let mounted = true; void supabase.auth.getSession().then(({ data }) => { if (!mounted) return; setUser(data.session?.user ?? null); setIsLoading(false) }); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (!mounted) return; setUser(session?.user ?? null); setIsLoading(false) }); return () => { mounted = false; subscription.unsubscribe() } }, []); if (isLoading) return <div className="flex min-h-dvh items-center justify-center bg-[#050e1d] text-slate-300" dir={language === 'ar' ? 'rtl' : 'ltr'}>{language === 'en' ? 'Checking admin access...' : 'جارٍ التحقق من صلاحيات الدخول...'}</div>; if (!isAdmin(user)) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />; return <>{children}</> }
