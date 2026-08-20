/* TEMPORARY DIAGNOSTIC SURFACE
 * React error boundaries CANNOT catch errors thrown in async code —
 * timers, promise callbacks, and unhandled rejections. When one of those
 * crashes in production, React unmounts the whole root and the user sees a
 * white screen with no hint of what failed. This module paints the error on
 * screen instead. Remove it once the white-screen cause is identified.
 */

interface PendingError {
  time: string
  kind: 'error' | 'unhandledrejection'
  message: string
  detail: string
}

const pendingErrors: PendingError[] = []

function renderSurface() {
  const existing = document.getElementById('global-error-surface')
  if (existing) existing.remove()

  if (pendingErrors.length === 0) return

  const surface = document.createElement('div')
  surface.id = 'global-error-surface'
  surface.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgba(6,15,23,0.96);' +
    'overflow:auto;padding:24px;font-family:ui-monospace,monospace;color:#fecaca;'
  surface.setAttribute('dir', 'ltr')

  const title = document.createElement('div')
  title.style.cssText = 'font-size:20px;font-weight:800;color:#f87171;margin-bottom:4px;'
  title.textContent = '⚠️ Async Crash — White Screen Cause (temporary diagnostic)'
  surface.appendChild(title)

  const sub = document.createElement('div')
  sub.style.cssText = 'font-size:12px;color:#94a3b8;margin-bottom:16px;'
  sub.textContent =
    'An error escaped React (timer / promise / effect). It would normally show as a blank page. Reload after reporting this text to the developer.'
  surface.appendChild(sub)

  for (const e of pendingErrors) {
    const card = document.createElement('div')
    card.style.cssText =
      'border:1px solid rgba(248,113,113,0.4);border-radius:12px;background:#0e1a2a;' +
      'padding:16px;margin-bottom:12px;max-width:900px;'
    card.appendChild(el('div', `[${e.time}] ${e.kind}`, 'font-size:11px;color:#fbbf24;font-weight:700;margin-bottom:8px;'))
    card.appendChild(el('div', 'Message: ' + e.message, 'font-size:13px;color:#fecaca;white-space:pre-wrap;word-break:break-word;'))
    card.appendChild(el('div', 'Detail: ' + e.detail, 'font-size:12px;color:#94a3b8;white-space:pre-wrap;word-break:break-word;margin-top:6px;'))
    surface.appendChild(card)
  }

  const logHint = document.createElement('div')
  logHint.style.cssText = 'font-size:12px;color:#64748b;margin-top:8px;'
  logHint.textContent = `Errors captured: ${pendingErrors.length}. Also visible in the browser console (window.__ERROR_LOG__).`
  surface.appendChild(logHint)

  const reloadBtn = document.createElement('button')
  reloadBtn.textContent = 'Reload page'
  reloadBtn.style.cssText =
    'margin-top:16px;background:#d4a843;color:#0a1420;border:0;border-radius:10px;' +
    'padding:10px 18px;font-weight:700;font-size:14px;cursor:pointer;'
  reloadBtn.onclick = () => window.location.reload()
  surface.appendChild(reloadBtn)

  document.body.appendChild(surface)
}

function el(tag: string, text: string, style: string) {
  const node = document.createElement(tag)
  node.style.cssText = style
  node.textContent = text
  return node
}

function record(err: PendingError) {
  pendingErrors.push(err)
  const globalLog = (window as unknown as { __ERROR_LOG__?: PendingError[] }).__ERROR_LOG__
  if (globalLog && globalLog !== pendingErrors) globalLog.push(err)
  ;(window as unknown as { __ERROR_LOG__?: PendingError[] }).__ERROR_LOG__ = pendingErrors
  console.error('[GlobalErrorDiagnostics]', err.kind, err.message, err.detail)
  renderSurface()
}

export function installGlobalErrorDiagnostics() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    const detail = [event.filename, event.lineno, event.colno]
      .filter((v): v is string | number => v != null)
      .join(':')
    record({
      time: new Date().toLocaleTimeString(),
      kind: 'error',
      message: event.message || '(no message)',
      detail: detail || '(no location)',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    let message = '(no reason)'
    let detail = ''
    if (reason instanceof Error) {
      message = reason.message || reason.name
      detail = reason.stack ?? ''
    } else if (reason) {
      try {
        message = JSON.stringify(reason)
      } catch {
        message = String(reason)
      }
    }
    record({ time: new Date().toLocaleTimeString(), kind: 'unhandledrejection', message, detail })
  })

  ;(window as unknown as { __ERROR_LOG__: PendingError[] }).__ERROR_LOG__ = pendingErrors
}
