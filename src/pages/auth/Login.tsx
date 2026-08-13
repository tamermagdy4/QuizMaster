import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getAuthErrorMessage, signIn } from '../../auth/authService'
import { useAppStore } from '../../store/appStore'

type LoginLocationState = { from?: string; message?: string }

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const language = useAppStore((state) => state.language)
  const english = language === 'en'
  const state = location.state as LoginLocationState | null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState(state?.message ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await signIn({ email, password })
      navigate(state?.from && !state.from.startsWith('/admin') ? state.from : '/', { replace: true })
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, english))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-8" dir={english ? 'ltr' : 'rtl'}>
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <p className="text-sm font-black text-sky-600">{english ? 'Fahloy account' : 'حساب فهلوي'}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">{english ? 'Sign in' : 'تسجيل الدخول'}</h1>
        <p className="mt-2 text-sm text-slate-500">{english ? 'Continue to your account.' : 'تابع إلى حسابك.'}</p>
        {message && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">{english ? 'Email' : 'البريد الإلكتروني'}</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500" dir="ltr" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">{english ? 'Password' : 'كلمة المرور'}</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500" dir="ltr" />
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-sky-600 px-4 py-3 font-black text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? (english ? 'Signing in...' : 'جارٍ تسجيل الدخول...') : (english ? 'Sign in' : 'تسجيل الدخول')}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {english ? 'No account yet?' : 'ليس لديك حساب؟'}{' '}
          <Link to="/signup" className="font-black text-sky-600 hover:text-sky-700">{english ? 'Create one' : 'إنشاء حساب'}</Link>
        </p>
      </section>
    </main>
  )
}
