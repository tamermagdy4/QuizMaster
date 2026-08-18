import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider'
import { useAppStore } from '../store/appStore'
import type { PackWithQuizzes } from '../types/packs'
import { packCategoryLabel } from '../types/packs'
import { deletePack, duplicatePack, listMyPacks, setPackStatus } from '../services/packService'
import { getQuizMeta } from '../utils/packQuizzes'

export function Profile() {
  const { user } = useAuth()
  const english = useAppStore((state) => state.language === 'en')

  const [packs, setPacks] = useState<PackWithQuizzes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<PackWithQuizzes | null>(null)

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'مستخدم'

  const loadPacks = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      setPacks(await listMyPacks(user.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not load your packs.' : 'تعذر تحميل باقاتك.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPacks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleTogglePublish = async (pack: PackWithQuizzes) => {
    if (!user) return
    setBusyId(pack.id)
    try {
      const nextStatus = pack.status === 'published' ? 'draft' : 'published'
      await setPackStatus(pack.id, nextStatus)
      setPacks((current) => current.map((item) => (item.id === pack.id ? { ...item, status: nextStatus } : item)))
      setNotice(nextStatus === 'published' ? (english ? 'Pack published!' : 'تم نشر الباقة!') : (english ? 'Pack unpublished.' : 'تم إلغاء نشر الباقة.'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not update the pack.' : 'تعذر تحديث الباقة.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDuplicate = async (pack: PackWithQuizzes) => {
    if (!user) return
    setBusyId(pack.id)
    try {
      const copy = await duplicatePack(pack.id, user)
      setPacks((current) => [copy as PackWithQuizzes, ...current])
      setNotice(english ? 'Pack duplicated.' : 'تم نسخ الباقة.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not duplicate the pack.' : 'تعذر نسخ الباقة.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setBusyId(confirmDelete.id)
    try {
      await deletePack(confirmDelete.id)
      setPacks((current) => current.filter((item) => item.id !== confirmDelete.id))
      setNotice(english ? 'Pack deleted.' : 'تم حذف الباقة.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not delete the pack.' : 'تعذر حذف الباقة.'))
    } finally {
      setBusyId(null)
      setConfirmDelete(null)
    }
  }

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto max-w-4xl space-y-6">
      {/* ===== Account card ===== */}
      <section className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-white shadow-panel sm:p-8">
        <div className="pointer-events-none absolute -end-12 -top-14 h-40 w-40 rounded-full bg-gold/15 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-2xl font-black shadow-inner">
            {displayName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-white/70">{english ? 'Fahloy' : 'فهلوي'}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{english ? 'My account' : 'حسابي'}</h1>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold text-white/60">{english ? 'Username' : 'اسم المستخدم'}</p>
            <p className="mt-1 text-lg font-black">{displayName}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold text-white/60">{english ? 'Email' : 'البريد الإلكتروني'}</p>
            <p className="mt-1 truncate text-lg font-black" dir="ltr">{user?.email ?? '—'}</p>
          </div>
        </div>
      </section>

      {/* ===== My Packs ===== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold text-navy sm:text-2xl">{english ? 'My Packs' : 'باقاتي'}</h2>
            <p className="mt-1 text-sm text-muted">{english ? 'Create, publish, duplicate and manage your collections.' : 'أنشئ وانشر وانسخ وأدر مجموعاتك.'}</p>
          </div>
          <Link to="/packs/new" className="btn btn-gold rounded-xl px-4 py-2.5 text-sm font-black">
            ＋ {english ? 'New Pack' : 'باقة جديدة'}
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">
            {error}
            <button type="button" onClick={() => setError(null)} className="ms-3 text-red/60">✕</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl border border-border-soft bg-surface-raised" />
            ))}
          </div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-strong bg-white/70 px-6 py-12 text-center">
            <span className="text-4xl" aria-hidden>📚</span>
            <h3 className="text-lg font-black text-navy">{english ? 'You have not created any packs yet' : 'لم تنشئ أي باقات بعد'}</h3>
            <p className="max-w-md text-sm leading-relaxed text-muted">
              {english ? 'Build your first collection of quizzes and share it with the community.' : 'ابنِ أول مجموعة اختبارات لك وشاركها مع المجتمع.'}
            </p>
            <Link to="/packs/new" className="btn btn-gold mt-2 rounded-xl px-5 py-2.5 text-sm font-black">
              {english ? 'Create your first pack' : 'إنشاء أول باقة'}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {packs.map((pack) => {
              const meta = pack.quizzes?.[0] ? getQuizMeta(pack.quizzes[0].quiz_id) : null
              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-white p-4 shadow-sm transition hover:border-gold/40 hover:shadow-panel sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {pack.cover_url ? (
                      <img src={pack.cover_url} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className={`flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta?.gradient ?? 'from-navy to-navy-3'} text-2xl`}>
                        {meta?.icon ?? '📚'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/packs/${pack.id}`} className="truncate font-black text-navy hover:text-navy-3">
                          {pack.title}
                        </Link>
                        {pack.status === 'published' && pack.visibility === 'public' && (
                          <span className="rounded-full border border-green/40 bg-green/10 px-2 py-0.5 text-[10px] font-black text-green">● {english ? 'Published' : 'منشورة'}</span>
                        )}
                        {pack.status === 'published' && pack.visibility === 'private' && (
                          <span className="rounded-full border border-navy/30 bg-navy/10 px-2 py-0.5 text-[10px] font-black text-navy">🔒 {english ? 'Private' : 'خاصة'}</span>
                        )}
                        {pack.status === 'draft' && (
                          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-black text-gold">✎ {english ? 'Draft' : 'مسودة'}</span>
                        )}
                        {pack.status === 'hidden' && (
                          <span className="rounded-full border border-red/40 bg-red/10 px-2 py-0.5 text-[10px] font-black text-red">✕ {english ? 'Hidden' : 'مخفية'}</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {packCategoryLabel(pack.category, english)} • 📚 {pack.quizzes?.length ?? 0} {english ? 'quizzes' : 'اختبارات'} • ▶ {pack.plays_count} • ★ {Number(pack.average_rating).toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link to={`/packs/${pack.id}/edit`} className="rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-black text-navy transition hover:border-navy">
                      {english ? 'Edit' : 'تعديل'}
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === pack.id}
                      onClick={() => void handleTogglePublish(pack)}
                      className="rounded-lg border border-green/40 bg-green/10 px-3 py-1.5 text-xs font-black text-green transition hover:bg-green/20"
                    >
                      {pack.status === 'published' ? (english ? 'Unpublish' : 'إلغاء النشر') : (english ? 'Publish' : 'نشر')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === pack.id}
                      onClick={() => void handleDuplicate(pack)}
                      className="rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-black text-navy transition hover:border-navy"
                    >
                      ⧉ {english ? 'Duplicate' : 'نسخ'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === pack.id}
                      onClick={() => setConfirmDelete(pack)}
                      className="rounded-lg border border-red/30 bg-red/5 px-3 py-1.5 text-xs font-black text-red transition hover:bg-red/15"
                    >
                      {english ? 'Delete' : 'حذف'}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </section>

      {notice && (
        <div className="fixed bottom-5 start-1/2 z-[80] -translate-x-1/2 rounded-2xl border border-green/40 bg-white px-5 py-3 text-sm font-bold text-green shadow-raised">
          ✓ {notice}
          <button type="button" onClick={() => setNotice(null)} className="ms-3 text-green/60">✕</button>
        </div>
      )}

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl border border-border-soft bg-white p-6 text-center shadow-raised">
              <span className="text-4xl" aria-hidden>🗑️</span>
              <h2 className="mt-4 text-xl font-black text-ink">{english ? 'Delete this pack?' : 'حذف هذه الباقة؟'}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                <strong className="text-navy">{confirmDelete.title}</strong>{' '}
                {english ? 'will be permanently removed. This cannot be undone.' : 'ستُحذف نهائيًا. لا يمكن التراجع عن هذا.'}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button type="button" onClick={() => setConfirmDelete(null)} className="btn btn-ghost rounded-xl px-4 py-2 text-sm font-black">
                  {english ? 'Cancel' : 'إلغاء'}
                </button>
                <button type="button" onClick={() => void handleDelete()} disabled={busyId === confirmDelete.id} className="btn btn-danger rounded-xl px-4 py-2 text-sm font-black">
                  {busyId === confirmDelete.id ? '…' : (english ? 'Delete' : 'حذف')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
