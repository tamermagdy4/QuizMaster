import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  componentStack: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, componentStack: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      const err = this.state.error
      const componentStack = this.state.componentStack ?? ''
      return (
        <div className="flex min-h-dvh flex-col items-stretch justify-start bg-[#060f17] p-6 text-start">
          <div className="mx-auto w-full max-w-3xl rounded-2xl border-2 border-[#ef4444] bg-[#0e1a2a] p-8 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>⚠️</span>
              <div>
                <h2 className="font-display text-xl font-bold text-red-400">
                  Component Crash — تعطل أحد المكوّنات
                </h2>
                <p className="mt-1 text-sm text-cream/60">
                  هذا التشخيص مؤقت — المحتوى أدناه يعرض الخطأ الحقيقي بدل الصفحة البيضاء.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#ef4444]/40 bg-[#0a1420] p-4 font-mono text-[13px] leading-relaxed" dir="ltr">
              <div className="text-red-300">
                <b>Error name:</b> {err?.name ?? 'Unknown'}
              </div>
              <div className="mt-1 text-cream">
                <b>Message:</b> {err?.message ?? '(no message)'}
              </div>
            </div>

            {componentStack && (
              <details className="mt-4 rounded-xl border border-[#ef4444]/30 bg-[#0a1420] p-4" dir="ltr">
                <summary className="cursor-pointer font-mono text-[13px] font-bold text-[#F5D98B]">
                  Component stack (أي مكوّن انهار)
                </summary>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-cream/80">{componentStack}</pre>
              </details>
            )}

            {err?.stack && (
              <details className="mt-4 rounded-xl border border-[#ef4444]/30 bg-[#0a1420] p-4" dir="ltr">
                <summary className="cursor-pointer font-mono text-[13px] font-bold text-[#F5D98B]">
                  Full JS stack
                </summary>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-cream/80">{err.stack}</pre>
              </details>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-[#D4A843]/40 bg-[#D4A843]/15 px-6 py-2.5 text-sm font-bold text-[#F5D98B] transition-all hover:bg-[#D4A843]/25"
              >
                إعادة تحميل الصفحة
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.clear()
                  window.location.href = '/'
                }}
                className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-6 py-2.5 text-sm font-bold text-red-300 transition-all hover:bg-[#ef4444]/20"
              >
                مسح كل بيانات التخزين وإعادة التحميل
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
