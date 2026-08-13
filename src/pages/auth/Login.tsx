import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getAuthErrorMessage, signIn } from '../../auth/authService'
import { useAppStore } from '../../store/appStore'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const language = useAppStore((state) => state.language)
  const english = language === 'en'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(
    (location.state as { message?: string } | null)?.message ?? '',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
await signIn({
  email,
  password,
})

      navigate('/', { replace: true })
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, english))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main
      className="flex min-h-[70vh] items-center justify-center px-4 py-8"
      dir={english ? 'ltr' : 'rtl'}
    >
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <p className="text-sm font-black text-sky-600">
          {english ? 'Fahloy account' : 'حساب فهلوي'}
        </p>

        <h1 className="mt-2 text-3xl font-black text-slate-900">
          {english ? 'Sign in' : 'تسجيل الدخول'}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {english
            ? 'Sign in to continue playing.'
            : 'سجل دخولك علشان تكمل اللعب.'}
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {/* Email */}
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {english ? 'Email' : 'البريد الإلكتروني'}
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
              dir="ltr"
            />
          </label>

          {/* Password */}
          <label className="block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">
                {english ? 'Password' : 'كلمة المرور'}
              </span>

              <Link
                to="/forgot-password"
                className="text-xs font-bold text-sky-600 hover:text-sky-700"
              >
                {english ? 'Forgot password?' : 'نسيت كلمة المرور؟'}
              </Link>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ps-12 text-slate-900 outline-none focus:border-sky-500"
                dir="ltr"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword
                    ? english
                      ? 'Hide password'
                      : 'إخفاء كلمة المرور'
                    : english
                      ? 'Show password'
                      : 'إظهار كلمة المرور'
                }
                className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-sky-600"
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.5 6a15.8 15.8 0 0 1-3.1 3.8" />
                    <path d="M6.6 6.6C4.7 7.8 3.4 9.4 2.5 10c1 2 4.5 6 9.5 6 1 0 2-.2 2.9-.5" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {/* Message */}
          {message && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              {message}
            </p>
          )}

          {/* Error */}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-sky-600 px-4 py-3 font-black text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting
              ? english
                ? 'Signing in...'
                : 'جاري تسجيل الدخول...'
              : english
                ? 'Sign in'
                : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {english ? "Don't have an account?" : 'ليس لديك حساب؟'}{' '}
          <Link
            to="/signup"
            className="font-black text-sky-600 hover:text-sky-700"
          >
            {english ? 'Create account' : 'إنشاء حساب'}
          </Link>
        </p>
      </section>
    </main>
  )
}