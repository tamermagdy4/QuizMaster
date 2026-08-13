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

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {english ? 'Password' : 'كلمة المرور'}
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
              dir="ltr"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {english ? 'Confirm password' : 'تأكيد كلمة المرور'}
            </span>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
              dir="ltr"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
            >
              {error}
            </p>
          )}

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