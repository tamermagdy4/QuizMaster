import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthErrorMessage, signUp } from '../../auth/authService'
import { useAppStore } from '../../store/appStore'

export function Signup() {
  const navigate = useNavigate()
  const language = useAppStore((state) => state.language)
  const english = language === 'en'

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(
        english
          ? 'Passwords do not match.'
          : 'كلمتا المرور غير متطابقتين.',
      )
      return
    }

    if (password.length < 6) {
      setError(
        english
          ? 'Password must be at least 6 characters.'
          : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
      )
      return
    }

    if (!displayName.trim()) {
      setError(
        english
          ? 'Please enter your name.'
          : 'من فضلك اكتب اسمك.',
      )
      return
    }

    setIsSubmitting(true)

    try {
      const { session } = await signUp({
        email,
        password,
        displayName,
      })

      if (session) {
        navigate('/', { replace: true })
      } else {
        navigate('/login', {
          replace: true,
          state: {
            message: english
              ? 'Account created. Please confirm your email before signing in.'
              : 'تم إنشاء الحساب. من فضلك أكد بريدك الإلكتروني قبل تسجيل الدخول.',
          },
        })
      }
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
          {english ? 'Create account' : 'إنشاء حساب'}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {english
            ? 'Create your account to continue.'
            : 'أنشئ حسابك للمتابعة.'}
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {/* Name */}
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {english ? 'Name' : 'الاسم'}
            </span>

            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
            />
          </label>

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
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {english ? 'Password' : 'كلمة المرور'}
            </span>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ps-12 text-slate-900 outline-none focus:border-sky-500"
                dir="ltr"
              />

              {/* Eye button - left side */}
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

          {/* Confirm Password */}
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {english ? 'Confirm password' : 'تأكيد كلمة المرور'}
            </span>

            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ps-12 text-slate-900 outline-none focus:border-sky-500"
                dir="ltr"
              />

              {/* Eye button - left side */}
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((value) => !value)
                }
                aria-label={
                  showConfirmPassword
                    ? english
                      ? 'Hide password'
                      : 'إخفاء كلمة المرور'
                    : english
                      ? 'Show password'
                      : 'إظهار كلمة المرور'
                }
                className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-sky-600"
              >
                {showConfirmPassword ? (
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
                ? 'Creating account...'
                : 'جاري إنشاء الحساب...'
              : english
                ? 'Create account'
                : 'إنشاء الحساب'}
          </button>
        </form>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          {english ? 'Already have an account?' : 'لديك حساب بالفعل؟'}{' '}
          <Link
            to="/login"
            className="font-black text-sky-600 hover:text-sky-700"
          >
            {english ? 'Sign in' : 'تسجيل الدخول'}
          </Link>
        </p>
      </section>
    </main>
  )
}