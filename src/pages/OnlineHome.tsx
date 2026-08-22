import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Zap, ArrowLeft } from 'lucide-react'
import { GlassInput } from '../components/ui/GlassInput'
import { useTranslation } from '../i18n/translations'
import { isValidRoomCode, normalizeRoomCode } from '../services/online/roomCode'
import { useGameSetupStore } from '../store/gameSetupStore'
import { useOnlineStore } from '../store/onlineStore'
import type { OnlineMaxPlayers, OnlineQuestionDuration } from '../types/online'
import { cn } from '../utils/cn'

const DURATION_OPTIONS: OnlineQuestionDuration[] = [15, 30, 60]
const MAX_PLAYERS_OPTIONS: OnlineMaxPlayers[] = [2, 3, 4, 5, 6]

export function OnlineHome() {
  const navigate = useNavigate()
  const { t, english } = useTranslation()
  const { roomCode, connectionStatus, error, createRoom, joinRoom } = useOnlineStore()
  const [playerName, setPlayerName] = useState('')
  const [code, setCode] = useState('')
  const [questionDuration, setQuestionDuration] = useState<OnlineQuestionDuration>(30)
  const [maxPlayers, setMaxPlayers] = useState<OnlineMaxPlayers>(2)
  const [localError, setLocalError] = useState<string | null>(null)

  // If we somehow already own a room session, go straight to its lobby.
  useEffect(() => {
    if (roomCode) navigate('/online/room', { replace: true })
  }, [roomCode, navigate])

  const busy = connectionStatus === 'connecting'

  const handleCreate = async () => {
    setLocalError(null)
    if (!playerName.trim()) {
      setLocalError(t('enterName'))
      return
    }
    // A brand-new room never inherits the previous room/game category picks.
    // Clear only the online-relevant setup categories (not user preferences).
    useGameSetupStore.setState({ team1CategoryIds: [], team2CategoryIds: [], activeTeam: 1 })
    const ok = await createRoom({ playerName, gameName: 'مسابقة أونلاين', questionDuration, maxPlayers })
    if (ok) navigate('/online/room')
  }

  const handleJoin = async () => {
    setLocalError(null)
    if (!playerName.trim()) {
      setLocalError(t('enterName'))
      return
    }
    const normalized = normalizeRoomCode(code)
    if (!isValidRoomCode(normalized)) {
      setLocalError(t('invalidCode'))
      return
    }
    const ok = await joinRoom({ roomCode: normalized, playerName })
    if (ok) navigate('/online/room')
  }

  const message = localError ?? error

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="relative mx-auto w-full max-w-6xl space-y-6">
      {/* arena lighting behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 46% at 50% 0%, rgba(61,112,128,0.12), transparent 62%), radial-gradient(50% 40% at 88% 100%, rgba(198,156,70,0.06), transparent 60%)',
        }}
      />

      {/* arena header — the cinematic title */}
      <div className="flex flex-col items-center gap-2 pt-4 text-center">
        <p className="text-xs font-bold tracking-[0.25em] text-[#c69c46]">{t('arena')}</p>
        <h1 className="font-display text-2xl font-extrabold text-white sm:text-4xl">{t('onlineTitle')}</h1>
        <p className="max-w-xl text-sm text-slate-400 sm:text-base">{t('onlineSubtitle')}</p>
      </div>

      {/* the two arena gates — create (gold) / join (teal) */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* CREATE gate — renders immediately (no mount-hide animation) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#223147] bg-gradient-to-b from-[#141d2b] to-[#0d1420] p-5 shadow-2xl transition hover:border-[#c69c46]/50 sm:p-7">
          {/* Gold top edge hairline */}
          <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#c69c46]/80 to-transparent" />

          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c69c46]/15 text-2xl" aria-hidden>
              <Plus className="h-6 w-6 text-[#e4c478]" />
            </span>
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#e4c478] sm:text-2xl">{t('createRoom')}</h2>
              <p className="text-xs text-slate-400">{english ? 'Open a new arena for your friends' : 'افتح ساحة جديدة لأصدقائك'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <GlassInput
              dark
              label={t('playerName')}
              placeholder={english ? 'Your name' : 'اسمك'}
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              autoComplete="off"
            />

            <div className="space-y-2 rounded-xl border border-[#1e293b] bg-[#090e15]/70 p-3.5">
              <p className="text-xs font-bold text-[#c69c46]">{english ? 'Players' : 'عدد اللاعبين'}</p>
              <div className="grid grid-cols-3 gap-2">
                {MAX_PLAYERS_OPTIONS.map((option) => (
                  <motion.button
                    key={option}
                    type="button"
                    disabled={busy}
                    layout
                    whileHover={busy ? undefined : { y: -2 }}
                    whileTap={busy ? undefined : { scale: 0.96 }}
                    onClick={() => setMaxPlayers(option)}
                    className={cn(
                      'flex min-h-[38px] items-center justify-center rounded-xl border px-2 py-1.5 text-xs font-bold transition',
                      maxPlayers === option
                        ? 'border-2 border-[#c69c46] bg-[#c69c46]/15 font-black text-[#e4c478] shadow-[0_0_14px_rgba(198,156,70,0.25)]'
                        : 'border-[#223147] bg-[#141d2b] text-slate-300 hover:border-[#c69c46]/50 hover:text-white',
                    )}
                  >
                    {option} {english ? 'players' : 'لاعبين'}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[#1e293b] bg-[#090e15]/70 p-3.5">
              <p className="text-xs font-bold text-[#c69c46]">{english ? 'Question duration' : 'مدة السؤال'}</p>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((option) => (
                  <motion.button
                    key={option}
                    type="button"
                    disabled={busy}
                    layout
                    whileHover={busy ? undefined : { y: -2 }}
                    whileTap={busy ? undefined : { scale: 0.96 }}
                    onClick={() => setQuestionDuration(option)}
                    className={cn(
                      'flex min-h-[38px] items-center justify-center rounded-xl border px-2 py-1.5 text-xs font-bold transition',
                      questionDuration === option
                        ? 'border-2 border-[#c69c46] bg-[#c69c46]/15 font-black text-[#e4c478] shadow-[0_0_14px_rgba(198,156,70,0.25)]'
                        : 'border-[#223147] bg-[#141d2b] text-slate-300 hover:border-[#c69c46]/50 hover:text-white',
                    )}
                  >
                    {option} {english ? 's' : 'ثانية'}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button
              type="button"
              disabled={busy}
              whileHover={busy ? undefined : { y: -2 }}
              whileTap={busy ? undefined : { scale: 0.98 }}
              onClick={handleCreate}
              className="w-full rounded-xl border border-[#c69c46]/50 bg-gradient-to-b from-[#e4c478] to-[#c69c46] py-3.5 text-base font-black text-[#0b1017] shadow-lg shadow-[#c69c46]/20 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? '…' : `${t('createRoom')} ＋`}
            </motion.button>
          </div>
        </div>

        {/* JOIN gate — renders immediately (no mount-hide animation) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#223147] bg-gradient-to-b from-[#141d2b] to-[#0d1420] p-5 shadow-2xl transition hover:border-[#4d79a7]/50 sm:p-7">
          {/* Blue top edge hairline */}
          <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#4d79a7]/80 to-transparent" />

          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4d79a7]/15 text-2xl" aria-hidden>
              <Zap className="h-6 w-6 text-[#8eaecf]" />
            </span>
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#8eaecf] sm:text-2xl">{t('joinGame')}</h2>
              <p className="text-xs text-slate-400">{english ? 'Enter a friend\'s arena with its code' : 'ادخل ساحة صديقك عبر الكود'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <GlassInput
              dark
              label={t('roomCode')}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9]*"
              className="text-center font-mono text-lg tracking-[0.5em]"
            />
            <motion.button
              type="button"
              disabled={busy}
              whileHover={busy ? undefined : { y: -2 }}
              whileTap={busy ? undefined : { scale: 0.98 }}
              onClick={handleJoin}
              className="w-full rounded-xl border border-[#4d79a7]/50 bg-gradient-to-b from-[#5c8ab8] to-[#4d79a7] py-3.5 text-base font-black text-white shadow-lg shadow-[#4d79a7]/20 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? '…' : t('joinGame')}
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.p
            key={message}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="mx-auto max-w-xl rounded-xl border border-[#b04d49]/45 bg-[#b04d49]/12 px-3 py-2 text-center text-sm font-bold text-[#d48c88]"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('back')}
        </Link>
      </div>
    </div>
  )
}
