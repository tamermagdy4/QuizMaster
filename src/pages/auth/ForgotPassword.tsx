import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getSupabaseClient } from '../../lib/supabaseClient'
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
      const { error: resetError } =
        await getSupabaseClient().auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        )

      if (resetError) throw resetError

      setMessage(
        english
          ? 'If this email is registered, you will receive a password reset link.'
          : 'إذا كان هذا البريد الإلكتروني مسجلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.',
      )
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : english
            ? 'Something went wrong. Please try again.'
            : 'حدث خطأ. حاول مرة أخرى.',
      )
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
          {english ? 'Forgot password?' : 'نسيت كلمة المرور؟'}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {english
            ? 'Enter your email and we will send you a password reset link.'
            : 'أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.'}
        </p>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
          >
            {error}
          </p>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-sky-600 px-4 py-3 font-black text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60"
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

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link
            to="/login"
            className="font-black text-sky-600 hover:text-sky-700"
          >
            {english ? 'Back to sign in' : 'العودة لتسجيل الدخول'}
          </Link>
        </p>
      </section>
    </main>
  )
}