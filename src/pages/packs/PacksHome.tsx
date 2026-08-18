import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { PackCard } from '../../components/packs/PackCard'
import { useAppStore } from '../../store/appStore'
import {
  attachPackQuestionCounts,
  getPackCategoryStats,
  listFavoritePacks,
  listFeaturedPacks,
  listMyPacks,
  listPacks,
} from '../../services/packService'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { createLiveRoom, joinLiveRoom } from '../../services/livePackService'
import { PACK_CATEGORIES, type PackSort, type PackWithQuizzes } from '../../types/packs'
import { cn } from '../../utils/cn'

const SORTS: { id: PackSort; label: string; en: string }[] = [
  { id: 'featured', label: 'الأكثر شعبية', en: 'Most popular' },
  { id: 'popular', label: 'الأكثر لعبًا', en: 'Most played' },
  { id: 'rated', label: 'الأعلى تقييمًا', en: 'Top rated' },
  { id: 'newest', label: 'الأحدث', en: 'Newest' },
]

function EmptyState({ title, subtitle, cta, to }: { title: string; subtitle: string; cta?: string; to?: string }) {
  const english = useAppStore((state) => state.language === 'en')
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-strong bg-white/70 px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden>📚</span>
      <h3 className="text-lg font-black text-navy">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted">{subtitle}</p>
      {cta && to && (
        <Link to={to} className="btn btn-gold mt-2 rounded-xl px-5 py-2.5 text-sm font-black">
          {cta} {english ? '→' : '←'}
        </Link>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-extrabold text-navy sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Horizontal snap rail of pack cards (used for Featured / Popular). */
function PackRail({ packs }: { packs: PackWithQuizzes[] }) {
  if (packs.length === 0) return null
  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {packs.map((pack, index) => (
        <div key={pack.id} className="w-64 shrink-0 snap-start sm:w-72">
          <PackCard pack={pack} index={index} />
        </div>
      ))}
    </div>
  )
}

export function PacksHome() {
  const english = useAppStore((state) => state.language === 'en')
  const { user } = useAuth()
  const navigate = useNavigate()

  const [featured, setFeatured] = useState<PackWithQuizzes[]>([])
  const [popular, setPopular] = useState<PackWithQuizzes[]>([])
  const [recent, setRecent] = useState<PackWithQuizzes[]>([])
  const [results, setResults] = useState<PackWithQuizzes[]>([])
  const [mine, setMine] = useState<PackWithQuizzes[]>([])
  const [saved, setSaved] = useState<PackWithQuizzes[]>([])
  const [categoryStats, setCategoryStats] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState<PackSort>('featured')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [hostPackId, setHostPackId] = useState('')
  const [hosting, setHosting] = useState(false)

  const filtered = search.trim() !== '' || category !== 'all'

  // Initial platform load: featured / popular / recent rails + category stats.
  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    Promise.all([
      listFeaturedPacks(6).catch(() => []),
      listPacks({ sort: 'popular', limit: 8 }).catch(() => []),
      listPacks({ sort: 'newest', limit: 6 }).catch(() => []),
      getPackCategoryStats().catch(() => ({})),
      user ? listMyPacks(user.id).catch(() => []) : Promise.resolve([]),
      user ? listFavoritePacks(user.id).catch(() => []) : Promise.resolve([]),
    ])
      .then(async ([featuredPacks, popularPacks, recentPacks, stats, myPacks, savedPacks]) => {
        if (!mounted) return
        setCategoryStats(stats)
        // One batch pass computes real question counts for every visible pack.
        const enriched = await attachPackQuestionCounts([
          ...featuredPacks,
          ...popularPacks,
          ...recentPacks,
        ]).catch(() => [])
        const byId = new Map<string, PackWithQuizzes>()
        for (const pack of enriched) byId.set(pack.id, pack)
        setFeatured([...byId.values()].filter((p) => featuredPacks.some((f) => f.id === p.id)))
        setPopular([...byId.values()].filter((p) => popularPacks.some((f) => f.id === p.id)))
        setRecent([...byId.values()].filter((p) => recentPacks.some((f) => f.id === p.id)))
        setMine(myPacks)
        setSaved(savedPacks)
        setLoading(false)
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [user])

  // Search / category / sort results (debounced search).
  useEffect(() => {
    if (loading) return
    const timer = window.setTimeout(() => {
      void listPacks({
        search,
        category: category === 'all' ? undefined : category,
        sort,
        limit: 60,
      })
        .then((packs) => attachPackQuestionCounts(packs))
        .then(setResults)
        .catch((reason) => setError(reason instanceof Error ? reason.message : null))
    }, search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [search, category, sort, loading])

  const handleHostParty = async () => {
    if (!hostPackId) return
    if (!user) {
      navigate('/login', { state: { from: '/packs' } })
      return
    }
    setHosting(true)
    try {
      const roomId = await createLiveRoom(hostPackId)
      navigate(`/packs/live/${roomId}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not host the game.' : 'تعذر استضافة الجولة.'))
      setHosting(false)
    }
  }

  const handleJoinByCode = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanCode = joinCode.trim().toUpperCase()
    if (cleanCode.length < 4) return
    if (!user) {
      navigate('/login', { state: { from: '/packs' } })
      return
    }
    setJoining(true)
    try {
      const playerId = await joinLiveRoom(cleanCode, user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'لاعب')
      const supabase = getSupabaseClient()
      const { data } = await supabase.from('live_pack_players').select('room_id').eq('id', playerId).maybeSingle()
      if (!data) throw new Error('Room not found')
      navigate(`/packs/live/${data.room_id}`)
    } catch {
      setError(english ? 'Could not join that room — check the code.' : 'تعذر الانضمام — تحقق من الكود.')
    } finally {
      setJoining(false)
    }
  }

  // Deduplicated pack list for the Host Party picker.
  const hostablePacks = useMemo(() => {
    const seen = new Map<string, PackWithQuizzes>()
    for (const pack of [...featured, ...popular, ...recent, ...mine, ...results]) {
      if (!seen.has(pack.id)) seen.set(pack.id, pack)
    }
    return [...seen.values()]
  }, [featured, popular, recent, mine, results])

  const liveSteps = useMemo(
    () =>
      english
        ? [
            { icon: '🎙️', title: 'Create', text: 'Open any pack and host a live game.' },
            { icon: '🔑', title: 'Share', text: 'Players join with the room code or link.' },
            { icon: '⚡', title: 'Play', text: 'One question for everyone — the host is the judge.' },
          ]
        : [
            { icon: '🎙️', title: 'أنشئ', text: 'افتح أي باقة وكن مضيفًا للعبة مباشرة.' },
            { icon: '🔑', title: 'شارك', text: 'يدخل اللاعبون بكود الغرفة أو الرابط.' },
            { icon: '⚡', title: 'العب', text: 'سؤال واحد للجميع — والمضيف هو الحكم.' },
          ],
    [english],
  )

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-7xl space-y-8">
      {/* ===== Header ===== */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
        className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-white shadow-panel sm:p-8"
      >
        <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -start-10 h-52 w-52 rounded-full bg-teal/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-bold text-white/70">{english ? 'Live multiplayer quiz packs' : 'باقات مسابقات مباشرة متعددة اللاعبين'}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              {english ? 'Quiz Packs' : 'الباقات'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              {english
                ? 'Host a live quiz, share a room code, and everyone answers the same questions in realtime.'
                : 'استضف مسابقة مباشرة، شارك كود الغرفة، ويجيب الجميع عن نفس الأسئلة لحظيًا.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:items-end">
            {user ? (
              <Link to="/packs/new" className="btn btn-gold rounded-xl px-5 py-3 text-sm font-black shadow-[0_12px_28px_rgba(201,162,39,0.35)]">
                ＋ {english ? 'Create Pack' : 'إنشاء باقة'}
              </Link>
            ) : (
              <Link to="/login" className="btn btn-gold rounded-xl px-5 py-3 text-sm font-black shadow-[0_12px_28px_rgba(201,162,39,0.35)]">
                {english ? 'Sign in to create' : 'سجّل الدخول للإنشاء'}
              </Link>
            )}
            <span className="text-xs font-bold text-white/55">
              {english ? `${featured.length + popular.length + recent.length} packs featured` : `${featured.length + popular.length + recent.length} باقة مميزة`}
            </span>
          </div>
        </div>
      </motion.header>

      {/* ===== Live multiplayer banner ===== */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: [0.25, 1, 0.5, 1] }}
        className="relative overflow-hidden rounded-3xl border border-teal/40 bg-gradient-to-br from-[#0F2A36] via-[#123B46] to-[#17324A] p-6 text-white shadow-panel sm:p-8"
      >
        <div className="pointer-events-none absolute -end-20 top-0 h-64 w-64 rounded-full bg-teal/25 blur-3xl" aria-hidden />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <span className="rounded-full border border-teal/50 bg-teal/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-teal-bright">
              🎮 {english ? 'Live games' : 'ألعاب مباشرة'}
            </span>
            <h2 className="mt-3 font-display text-2xl font-black leading-snug sm:text-3xl">
              {english ? 'Play any pack live with your friends' : 'العب أي باقة مباشرة مع أصدقائك'}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {liveSteps.map((step, index) => (
                <div key={step.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5 backdrop-blur-sm">
                  <span className="text-xl" aria-hidden>{step.icon}</span>
                  <div>
                    <p className="text-sm font-black">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/70">{step.text}</p>
                  </div>
                  {index < 2 && <span className="hidden text-white/30 sm:block" aria-hidden>←</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Host Party + Join by code */}
          <div className="flex w-full flex-col gap-4 lg:w-80">
          <div className="rounded-3xl border border-gold/30 bg-black/30 p-5 backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gold-bright">🎙️ {english ? 'Host a party' : 'استضف جولة'}</p>
            <div className="mt-3 flex items-center gap-2">
              <select
                value={hostPackId}
                onChange={(event) => setHostPackId(event.target.value)}
                className="w-full min-w-0 rounded-2xl border border-white/20 bg-black/40 px-3 py-3 text-sm font-black text-white outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
              >
                <option value="" className="bg-navy text-white">
                  {english ? 'Choose a pack…' : 'اختر باقة…'}
                </option>
                {hostablePacks.map((pack) => (
                  <option key={pack.id} value={pack.id} className="bg-navy text-white">
                    {pack.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleHostParty()}
                disabled={hosting || !hostPackId}
                className="shrink-0 rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-4 py-3 text-sm font-black text-navy transition hover:brightness-110 disabled:opacity-50"
              >
                {hosting ? '…' : english ? 'Host' : 'استضافة'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/50">
              {english ? 'You become the host — players join with your code.' : 'ستصبح المضيف — يدخل اللاعبون بكودك.'}
            </p>
          </div>

          <form onSubmit={handleJoinByCode} className="rounded-3xl border border-white/15 bg-black/30 p-5 backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">{english ? 'Join a live game' : 'انضم إلى لعبة مباشرة'}</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder={english ? 'ROOM CODE' : 'كود الغرفة'}
                dir="ltr"
                className="w-full min-w-0 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-center font-display text-lg font-black tracking-[0.3em] text-gold-bright outline-none transition placeholder:text-white/25 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={joining || joinCode.trim().length < 4}
                className="shrink-0 rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-5 py-3 text-sm font-black text-navy transition hover:brightness-110 disabled:opacity-50"
              >
                {joining ? '…' : english ? 'Join' : 'دخول'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/50">
              {english ? 'Ask the host for the room code.' : 'اسأل المضيف عن كود الغرفة.'}
            </p>
          </form>
          </div>
        </div>
      </motion.section>

      {/* ===== Search + category toolbar ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.08, ease: [0.25, 1, 0.5, 1] }}
        className="space-y-4 rounded-3xl border border-border-soft bg-white/80 p-4 shadow-panel sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden>🔎</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={english ? 'Search packs, creators, tags…' : 'ابحث عن باقات، منشئين، وسوم…'}
              className="w-full rounded-xl border border-border-strong bg-white py-3 pe-4 ps-11 text-sm font-bold text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="shrink-0 text-xs font-black text-muted">{english ? 'Sort' : 'ترتيب'}:</span>
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSort(option.id)}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-black transition',
                  sort === option.id
                    ? 'border-navy bg-navy text-white'
                    : 'border-border-soft bg-surface-raised text-muted hover:border-navy/40 hover:text-navy',
                )}
              >
                {english ? option.en : option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category chips (real counts from the DB view) */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-black transition',
              category === 'all' ? 'border-gold bg-gold/15 text-gold' : 'border-border-soft bg-surface-raised text-muted hover:border-gold/40 hover:text-gold',
            )}
          >
            {english ? 'All' : 'الكل'}
            {Object.keys(categoryStats).length > 0 && (
              <span className="ms-1.5 opacity-70">{Object.values(categoryStats).reduce((sum, count) => sum + count, 0)}</span>
            )}
          </button>
          {PACK_CATEGORIES.map((item) => {
            const count = categoryStats[item.id] ?? 0
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-bold transition',
                  category === item.id ? 'border-gold bg-gold/15 text-gold' : 'border-border-soft bg-surface-raised text-muted hover:border-gold/40 hover:text-gold',
                )}
              >
                <span aria-hidden>{item.icon}</span> {english ? item.en : item.label}
                {count > 0 && <span className="ms-1.5 opacity-70">{count}</span>}
              </button>
            )
          })}
        </div>
      </motion.div>

      {error && (
        <div className="rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">
          {error}
        </div>
      )}

      {/* ===== Filtered results (search / category active) ===== */}
      {filtered ? (
        <section className="space-y-4">
          <SectionHeader
            title={english ? 'Results' : 'النتائج'}
            subtitle={
              english
                ? `Packs matching "${search.trim() || 'all categories'}"`
                : `باقات مطابقة لـ "${search.trim() || 'كل الفئات'}"`
            }
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setCategory('all')
                }}
                className="rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-black text-muted transition hover:border-navy hover:text-navy"
              >
                {english ? 'Clear filters' : 'مسح الفلاتر'} ✕
              </button>
            }
          />
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-72 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title={english ? 'No packs found' : 'لا توجد باقات'}
              subtitle={english ? 'Try a different search or category.' : 'جرّب بحثًا أو فئة مختلفة.'}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence initial={false}>
                {results.map((pack, index) => (
                  <PackCard key={pack.id} pack={pack} index={index} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ===== Featured rail ===== */}
          {!loading && featured.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title={english ? 'Featured Packs' : 'باقات مميزة'}
                subtitle={english ? 'Hand-picked collections to start with' : 'مجموعات مختارة لتبدأ بها'}
              />
              <PackRail packs={featured} />
            </section>
          )}

          {/* ===== Popular rail ===== */}
          {!loading && popular.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title={english ? 'Popular Packs' : 'الباقات الأكثر لعبًا'}
                subtitle={english ? 'What everyone is playing right now' : 'ما يلعبه الجميع الآن'}
              />
              <PackRail packs={popular} />
            </section>
          )}

          {/* ===== Recent grid ===== */}
          {!loading && recent.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title={english ? 'Recently Added' : 'أحدث الباقات'}
                subtitle={english ? 'Fresh packs from the community' : 'باقات جديدة من المجتمع'}
              />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((pack, index) => (
                  <PackCard key={pack.id} pack={pack} index={index} />
                ))}
              </div>
            </section>
          )}

          {/* ===== Loading skeleton for rails ===== */}
          {loading && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-72 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
              ))}
            </div>
          )}

          {!loading && featured.length === 0 && popular.length === 0 && recent.length === 0 && (
            <EmptyState
              title={english ? 'No packs yet' : 'لا توجد باقات بعد'}
              subtitle={
                english
                  ? 'Be the first to create a pack and host a live game.'
                  : 'كن أول من ينشئ باقة ويستضيف لعبة مباشرة.'
              }
              cta={english ? 'Create your first pack' : 'إنشاء أول باقة'}
              to={user ? '/packs/new' : '/login'}
            />
          )}
        </>
      )}

      {/* ===== My packs ===== */}
      {user && (
        <section className="space-y-4">
          <SectionHeader
            title={english ? 'My Packs' : 'باقاتي'}
            subtitle={english ? 'Create, edit, publish and host live games from your collections' : 'أنشئ وعدّل وانشر واستضف ألعابًا مباشرة من مجموعاتك'}
          />
          {mine.length === 0 ? (
            <EmptyState
              title={english ? 'You have not created any packs yet' : 'لم تنشئ أي باقات بعد'}
              subtitle={english ? 'Start building your first collection of quizzes.' : 'ابدأ ببناء أول مجموعة اختبارات لك.'}
              cta={english ? 'Create your first pack' : 'إنشاء أول باقة'}
              to="/packs/new"
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((pack, index) => (
                <PackCard key={pack.id} pack={pack} index={index} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== Saved ===== */}
      {user && saved.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={english ? 'Saved Packs' : 'الباقات المحفوظة'}
            subtitle={english ? 'Packs you saved for later' : 'باقات حفظتها للعب لاحقًا'}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((pack, index) => (
              <PackCard key={pack.id} pack={pack} index={index} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
