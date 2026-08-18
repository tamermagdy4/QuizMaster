import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getAuthErrorMessage, resetPassword } from '../../auth/authService'
import { useAppStore } from '../../store/appStore'

export function ForgotPassword() {
  const language = useAppStore((state) => state.language)
  const english = language === 'en'

  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      await resetPassword(email)

      setMessage(
        english
          ? 'Password reset email sent. Check your inbox.'
          : 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.',
      )
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
      <section className="glass-panel-strong w-full max-w-md rounded-3xl p-6 sm:p-8">
        <p className="eyebrow">
          {english ? 'Fahloy account' : 'حساب فهلوي'}
        </p>

        <h1 className="mt-2 text-3xl font-black text-navy">
          {english ? 'Forgot password?' : 'نسيت كلمة المرور؟'}
        </h1>

        <p className="mt-2 text-sm text-muted">
          {english
            ? 'Enter your email and we will send you a password reset link.'
            : 'اكتب بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.'}
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-ink-2">
              {english ? 'Email' : 'البريد الإلكتروني'}
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              dir="ltr"
              className="w-full rounded-xl border border-border-soft bg-surface-raised px-4 py-3 text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>

          {message && (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
            >
              {message}
            </p>
          )}

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
            className="btn btn-teal w-full rounded-xl px-4 py-3 font-black disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting
              ? english
                ? 'Sending...'
                : 'جاري الإرسال...'
              : english
                ? 'Send reset link'
                : 'إرسال رابط إعادة التعيين'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link
            to="/login"
            className="font-black text-teal hover:text-navy-3"
          >
            {english ? 'Back to sign in' : 'العودة لتسجيل الدخول'}
          </Link>
        </p>
      </section>
    </main>
  )
}