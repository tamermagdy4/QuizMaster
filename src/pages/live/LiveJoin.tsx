import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { getSupabaseClient } from '../../lib/supabaseClient'
import {
  getLivePlayers,
  joinLiveRoom,
  listPublicLobbies,
  rejoinLiveRoom,
  type PublicLobby,
} from '../../services/livePackService'
import { SegmentedCodeInput } from '../../components/live/SegmentedCodeInput'

function timeAgo(dateStr: string, english: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return english ? 'just now' : 'الآن'
  if (minutes < 60) return english ? `${minutes}m ago` : `منذ ${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return english ? `${hours}h ago` : `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return english ? `${days}d ago` : `منذ ${days} يوم`
}

export function LiveJoin() {
  const english = useAppStore((state) => state.language === 'en')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState((searchParams.get('code') ?? '').replace(/[^0-9]/g, '').slice(0, 6))
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publicLobbies, setPublicLobbies] = useState<PublicLobby[]>([])
  const [loadingLobbies, setLoadingLobbies] = useState(true)

  // Group-rejoin mode
  const prev = searchParams.get('prev')
  const rejoinMode = Boolean(prev)

  // Prefill display name
  useEffect(() => {
    if (name) return
    const supabase = getSupabaseClient()
    void (async () => {
      const { data } = await supabase.auth.getUser()
      const metadata = data.user?.user_metadata ?? {}
      let display =
        metadata.display_name ?? metadata.full_name ?? data.user?.email?.split('@')[0] ?? ''
      if (rejoinMode && prev && data.user?.id) {
        const previousPlayers = await getLivePlayers(prev)
        const me = previousPlayers.find((player) => player.user_id === data.user?.id)
        if (me) display = me.name
      }
      if (display) setName(display)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load public lobbies
  useEffect(() => {
    let mounted = true
    void listPublicLobbies()
      .then((lobbies) => { if (mounted) setPublicLobbies(lobbies) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoadingLobbies(false) })
    return () => { mounted = false }
  }, [])

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanCode = code.replace(/[^0-9]/g, '')
    if (cleanCode.length !== 6) {
      setError(english ? 'Enter the 6-digit room code.' : 'أدخل كود الغرفة المكون من 6 أرقام.')
      return
    }
    if (!name.trim()) {
      setError(english ? 'Enter your player name.' : 'اكتب اسم اللاعب.')
      return
    }
    setJoining(true)
    setError(null)
    try {
      const playerId = rejoinMode && prev
        ? await rejoinLiveRoom(cleanCode, prev)
        : await joinLiveRoom(cleanCode, name.trim())
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('live_pack_players')
        .select('room_id')
        .eq('id', playerId)
        .maybeSingle()
      if (!data) throw new Error(english ? 'Could not find the room.' : 'تعذر العثور على الغرفة.')
      navigate(`/live/${data.room_id}`, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not join the room.' : 'تعذر الانضمام إلى الغرفة.'))
    } finally {
      setJoining(false)
    }
  }

  const handleJoinLobby = async (lobby: PublicLobby) => {
    if (!name.trim()) {
      setError(english ? 'Enter your player name first.' : 'اكتب اسمك أولاً.')
      return
    }
    setJoining(true)
    setError(null)
    try {
      const playerId = await joinLiveRoom(lobby.room_code, name.trim())
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('live_pack_players')
        .select('room_id')
        .eq('id', playerId)
        .maybeSingle()
      if (!data) throw new Error(english ? 'Could not find the room.' : 'تعذر العثور على الغرفة.')
      navigate(`/live/${data.room_id}`, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not join the room.' : 'تعذر الانضمام إلى الغرفة.'))
    } finally {
      setJoining(false)
    }
  }

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-lg space-y-6">

      {/* ═══ CODE INPUT SECTION ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
        className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-white shadow-panel sm:p-8"
      >
        <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -start-10 h-52 w-52 rounded-full bg-teal/20 blur-3xl" aria-hidden />

        <div className="relative text-center">
          <span className="text-4xl" aria-hidden>🎮</span>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight sm:text-3xl">
            {english ? 'Join a Party' : 'انضم إلى حفلة'}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/75">
            {english
              ? 'Enter the 6-digit code shared by the host to join the game.'
              : 'أدخل كود الـ 6 أرقام الذي شاركه المضيف للانضمام إلى اللعبة.'}
          </p>
        </div>

        {rejoinMode && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-4 rounded-2xl border border-gold/50 bg-gold/15 px-4 py-3 text-center text-sm font-black text-gold-bright"
          >
            🔁 {english ? 'Replay round — rejoin with your previous name' : 'جولة متابعة — ستعود بنفس اسمك السابق'}
          </motion.div>
        )}

        <form onSubmit={handleJoin} className="relative mt-6 space-y-4">
          {/* Segmented code input */}
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-white/60">
              {english ? 'Room code' : 'كود الغرفة'}
            </label>
            <SegmentedCodeInput
              value={code}
              onChange={setCode}
              disabled={joining}
              english={english}
            />
          </div>

          {/* Player name */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-white/60">
              {english ? 'Your name' : 'اسمك'}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              placeholder={english ? 'e.g. Ahmed' : 'مثال: أحمد'}
              className="w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
            />
          </div>

          {error && (
            <p className="rounded-2xl border border-red/50 bg-red/15 px-4 py-3 text-sm font-bold text-red-100">
              ⚠ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={joining || code.replace(/[^0-9]/g, '').length !== 6}
            className="w-full rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-6 py-3.5 text-sm font-black text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)] transition hover:brightness-110 active:translate-y-px disabled:opacity-60"
          >
            {joining ? (english ? 'Joining…' : 'جارٍ الانضمام…') : english ? 'Join the game' : 'انضم إلى اللعبة'}
          </button>

          <Link to="/" className="block text-center text-xs font-bold text-white/60 transition hover:text-white">
            ← {english ? 'Back to Home' : 'العودة إلى الرئيسية'}
          </Link>
        </form>
      </motion.div>

      {/* ═══ PUBLIC GAMES LIST ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-black text-cream">
            {english ? 'Public Games' : 'ألعاب عامة'}
            {!loadingLobbies && (
              <span className="ms-2 text-sm font-bold text-teal-bright/50">
                ({publicLobbies.length})
              </span>
            )}
          </h2>
        </div>

        {loadingLobbies ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-petro-line bg-petro-800/50" />
            ))}
          </div>
        ) : publicLobbies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-petro-line-strong bg-petro-800/30 p-6 text-center">
            <span className="text-3xl opacity-40">👀</span>
            <p className="mt-2 text-sm text-teal-bright/60">
              {english ? 'No public games right now.' : 'لا توجد ألعاب عامة حاليًا.'}
            </p>
            <Link
              to="/"
              className="mt-3 inline-flex items-center gap-1 text-xs font-black text-gold-bright hover:text-gold"
            >
              {english ? '→ Go to Home' : '→ انتقل إلى الرئيسية'}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {publicLobbies.map((lobby) => (
              <button
                key={lobby.room_id}
                type="button"
                onClick={() => handleJoinLobby(lobby)}
                disabled={joining}
                className="w-full rounded-2xl border border-petro-line bg-petro-800/70 p-4 text-start transition hover:border-gold/40 hover:bg-petro-700/70 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  {/* Cover thumbnail */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-teal/15 text-xl">
                    🎉
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-cream">{lobby.pack_title}</p>
                    <p className="text-[11px] text-teal-bright/50">
                      {english ? 'Host' : 'المضيف'}: {lobby.host_name}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs font-black text-gold-bright">
                      {lobby.player_count}/{lobby.max_players}
                    </p>
                    <p className="text-[10px] text-teal-bright/40">
                      {timeAgo(lobby.created_at, english)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
