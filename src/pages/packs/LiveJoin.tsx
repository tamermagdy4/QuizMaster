import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { getLivePlayers, joinLiveRoom, rejoinLiveRoom } from '../../services/livePackService'

export function LiveJoin() {
  const english = useAppStore((state) => state.language === 'en')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState((searchParams.get('code') ?? '').toUpperCase().slice(0, 6))
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Group-rejoin mode (migration 031): the link carries &prev=… (previous
  // round id) → the player rejoins the replay room with their old identity.
  const prev = searchParams.get('prev')
  const rejoinMode = Boolean(prev)

  // Prefill the display name: from the PREVIOUS round's identity when the link
  // is a group rejoin, otherwise from the account profile.
  useEffect(() => {
    if (name) return
    const supabase = getSupabaseClient()
    void (async () => {
      const { data } = await supabase.auth.getUser()
      const metadata = data.user?.user_metadata ?? {}
      let display =
        metadata.display_name ?? metadata.full_name ?? data.user?.email?.split('@')[0] ?? ''
      // Rejoin mode: reuse the exact name/identity from the previous round.
      if (rejoinMode && prev && data.user?.id) {
        const previousPlayers = await getLivePlayers(prev)
        const me = previousPlayers.find((player) => player.user_id === data.user?.id)
        if (me) display = me.name
      }
      if (display) setName(display)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanCode = code.trim().toUpperCase()
    if (cleanCode.length < 4) {
      setError(english ? 'Enter the room code.' : 'أدخل كود الغرفة.')
      return
    }
    if (!name.trim()) {
      setError(english ? 'Enter your player name.' : 'اكتب اسم اللاعب.')
      return
    }
    setJoining(true)
    setError(null)
    try {
      // Rejoin mode: the server reuses the player's previous identity — the
      // typed name is a fallback only.
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
      navigate(`/packs/live/${data.room_id}`, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (english ? 'Could not join the room.' : 'تعذر الانضمام إلى الغرفة.'))
    } finally {
      setJoining(false)
    }
  }

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-lg">
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
            {english ? 'Join a Live Game' : 'انضم إلى لعبة مباشرة'}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/75">
            {english
              ? 'Enter the room code shared by the host, pick your player name, and jump into the lobby.'
              : 'أدخل كود الغرفة الذي شاركه المضيف، اختر اسم لاعبك، وادخل إلى اللوبي.'}
          </p>
        </div>

        {rejoinMode && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-4 rounded-2xl border border-gold/50 bg-gold/15 px-4 py-3 text-center text-sm font-black text-gold-bright"
          >
            🔁 {english ? 'Replay round — you will rejoin with your previous name' : 'جولة متابعة — ستعود بنفس اسمك السابق'}
          </motion.div>
        )}

        <form onSubmit={handleJoin} className="relative mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-white/60">
              {english ? 'Room code' : 'كود الغرفة'}
            </label>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              dir="ltr"
              className="w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-center font-display text-2xl font-black tracking-[0.35em] text-gold-bright outline-none backdrop-blur-sm transition placeholder:text-white/25 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-white/60">
              {english ? 'Player name' : 'اسم اللاعب'}
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 24))}
              placeholder={english ? 'e.g. Ahmed' : 'مثال: أحمد'}
              className="w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none backdrop-blur-sm transition placeholder:text-white/30 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
            />
          </div>

          {error && (
            <p className="rounded-2xl border border-red/50 bg-red/15 px-4 py-3 text-sm font-bold text-red-100">
              ⚠ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={joining}
            className="w-full rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-6 py-3.5 text-sm font-black text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)] transition hover:brightness-110 active:translate-y-px disabled:opacity-60"
          >
            {joining ? (english ? 'Joining…' : 'جارٍ الانضمام…') : english ? 'Join the game' : 'انضم إلى اللعبة'}
          </button>

          <Link to="/packs" className="block text-center text-xs font-bold text-white/60 transition hover:text-white">
            ← {english ? 'Back to Packs' : 'العودة إلى الباقات'}
          </Link>
        </form>
      </motion.div>
    </div>
  )
}
