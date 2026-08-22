import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { LeaveRoomConfirm } from '../components/online/LeaveRoomConfirm'
import { gameCategories } from '../data/categories'
import { defaultLifelines } from '../data/lifelines'
import { presentCategory, useTranslation } from '../i18n/translations'
import { applyOnlineBoardSnapshot, buildOnlineBoardSnapshot } from '../services/online/onlineBoardSetup'
import { useAppStore } from '../store/appStore'
import { useOnlineStore } from '../store/onlineStore'
import type { Lifeline, LifelineId } from '../types/board'
import type { OnlinePlayer } from '../types/online'
import { cn } from '../utils/cn'

/** The host must pick exactly this many categories before starting. */
const REQUIRED_CATEGORIES = 6
/** The host must pick exactly this many lifelines per team before starting. */
const REQUIRED_LIFELINES = 3

export function OnlineRoom() {
  const navigate = useNavigate()
  const { t, english } = useTranslation()
  const { room, self, players, connectionStatus, lastEvent, error, leaveRoom, startGame, setRoomCategories, setRoomLifelines } = useOnlineStore()
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  // Distinguishes "session cancelled" from plain direct URL access, so a
  // cancelled room auto-navigates to /online while direct access still shows
  // the friendly "no room" screen.
  const hadSession = useRef(false)

  // The pool of lifelines the host may choose from = the player's enabled
  // lifelines preference (same pool the board uses). Default = all 5.
  const lifelinePool: Lifeline[] = useMemo(() => {
    const enabled = useAppStore.getState().enabledLifelines
    return defaultLifelines().filter((lifeline) => enabled.includes(lifeline.id))
  }, [])

  const isHost = !!room && !!self && self.id === room.hostId
  const busy = connectionStatus === 'connecting'

  // Free-for-all lobby: every connected player is shown (2-6 players).
  const orderedPlayers: OnlinePlayer[] = useMemo(() => {
    if (!room) return []
    const host = players.find((player) => player.id === room.hostId)
    const rest = players.filter((player) => player.id !== room.hostId)
    return host ? [host, ...rest] : players
  }, [room, players])

  // The host can start only when the room is FULL (maxPlayers), all 6 match
  // categories have been chosen AND each team has exactly 3 lifelines.
  const roomFull = !!room && players.length >= room.maxPlayers
  const categoriesReady = !!room && room.categoryIds.length === REQUIRED_CATEGORIES
  const team1LifelinesReady = !!room && room.team1LifelineIds.length === REQUIRED_LIFELINES
  const team2LifelinesReady = !!room && room.team2LifelineIds.length === REQUIRED_LIFELINES
  const lifelinesReady = team1LifelinesReady && team2LifelinesReady
  const readyToStart = isHost && roomFull && categoriesReady && lifelinesReady

  // Joiner: when the host starts the game, apply the shared board snapshot
  // and enter the existing GameBoard.
  useEffect(() => {
    if (!lastEvent || lastEvent.type !== 'GAME_STARTED') return
    if (isHost) return
    void (async () => {
      await applyOnlineBoardSnapshot(lastEvent.payload.board)
      navigate('/board')
    })()
  }, [lastEvent, isHost, navigate])

  // A player intentionally left → the room is cancelled and this client is
  // sent back to the online hub (the store already carries the message).
  useEffect(() => {
    if (room && self) hadSession.current = true
    if (hadSession.current && !room && !self) {
      navigate('/online', { replace: true })
    }
  }, [room, self, navigate])

  const handleCopy = async () => {
    if (!room) return
    try {
      await navigator.clipboard.writeText(room.roomCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — the code stays visible on screen.
    }
  }

  const handleToggleCategory = async (categoryId: string) => {
    // Read the LIVE room from the store (same rationale as handleToggleLifeline).
    const currentRoom = useOnlineStore.getState().room
    const currentSelf = useOnlineStore.getState().self
    if (!currentRoom || !currentSelf || !currentSelf.isHost) return
    const current = currentRoom.categoryIds
    const next = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : current.length >= REQUIRED_CATEGORIES
        ? current
        : [...current, categoryId]
    if (next.length === current.length && next.join() === current.join()) return
    await setRoomCategories(next)
  }

  const handleToggleLifeline = async (team: 1 | 2, lifelineId: LifelineId) => {
    // Read the LIVE room from the store, not the render closure, so rapid
    // toggles (before a ROOM_STATE round-trip re-renders) never overwrite a
    // just-made selection with a stale one.
    const currentRoom = useOnlineStore.getState().room
    const currentSelf = useOnlineStore.getState().self
    if (!currentRoom || !currentSelf || !currentSelf.isHost) return
    const key = team === 1 ? 'team1LifelineIds' : 'team2LifelineIds'
    const current = currentRoom[key]
    const next = current.includes(lifelineId)
      ? current.filter((id) => id !== lifelineId)
      : current.length >= REQUIRED_LIFELINES
        ? current
        : [...current, lifelineId]
    if (next.length === current.length && next.join() === current.join()) return
    const team1Next = team === 1 ? next : currentRoom.team1LifelineIds
    const team2Next = team === 2 ? next : currentRoom.team2LifelineIds
    await setRoomLifelines(team1Next, team2Next)
  }

  const handleStart = async () => {
    if (!room || !self || !isHost) return
    if (orderedPlayers.length < room.maxPlayers) return
    if (room.categoryIds.length !== REQUIRED_CATEGORIES) return
    if (
      room.team1LifelineIds.length !== REQUIRED_LIFELINES ||
      room.team2LifelineIds.length !== REQUIRED_LIFELINES
    ) {
      return
    }
    const snapshot = buildOnlineBoardSnapshot(
      orderedPlayers,
      room.gameName,
      room.questionDuration,
      room.categoryIds,
      room.team1LifelineIds,
      room.team2LifelineIds,
    )
    await applyOnlineBoardSnapshot(snapshot)
    await startGame(snapshot)
    navigate('/board')
  }

  const handleLeave = async () => {
    await leaveRoom({ cancelRoom: true })
    navigate('/online')
  }

  // No room session: direct URL access, or the host left the room.
  if (!room || !self) {
    const roomError = error && error.includes('host left') ? t('hostLeft') : error
    return (
      <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-xl space-y-5">
        <div className="glass-dark px-4 py-8 text-center sm:px-6">
          <p className="text-4xl">🚪</p>
          <h1 className="mt-3 text-xl font-black text-cream">{t('noRoom')}</h1>
          <p className="mt-2 text-sm text-cream/55">{roomError ?? t('noRoomDesc')}</p>
          <button
            type="button"
            onClick={() => navigate('/online')}
            className="btn btn-teal mt-5"
          >
            {t('back')}
          </button>
        </div>
      </div>
    )
  }

  const statusPill =
    roomFull
      ? 'border-[#468a5e]/50 bg-[#468a5e]/20 text-[#7ec498]'
      : 'border-[#c69c46]/50 bg-[#c69c46]/20 text-[#e4c478]'

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="relative mx-auto w-full max-w-4xl space-y-5">
      {/* arena lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 46% at 50% 0%, rgba(61,112,128,0.12), transparent 62%), radial-gradient(50% 40% at 12% 100%, rgba(198,156,70,0.06), transparent 60%)',
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-[#c69c46]">🌐 {t('arena')}</p>
          <h1 className="font-display mt-1 text-2xl font-extrabold text-white sm:text-3xl">
            {t('room')}
          </h1>
        </div>
        <span className={cn('rounded-full border px-3 py-1 text-xs font-black', statusPill)}>
          {english
            ? `${players.length}/${room.maxPlayers} ${roomFull ? 'ready' : 'waiting'} players`
            : `${players.length}/${room.maxPlayers} ${roomFull ? 'جاهزة' : 'بانتظار'} اللاعبين`}
        </span>
      </div>

      {/* Room code — the giant arena gate (renders immediately, no mount-hide) */}
      <div className="relative overflow-hidden rounded-2xl border border-[#c69c46]/40 bg-gradient-to-b from-[#141d2b] to-[#0d1420] flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 shadow-2xl">
        <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#c69c46]/80 to-transparent" />
        <div>
          <p className="text-xs font-bold tracking-[0.3em] text-[#e4c478]/80">{t('roomCode')}</p>
          <p className="font-display mt-1 text-4xl font-extrabold tracking-[0.22em] text-[#e4c478] sm:text-6xl" dir="ltr">
            {room.roomCode}
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleCopy}
          className="rounded-xl border border-[#c69c46]/50 bg-[#c69c46]/15 px-5 py-3 text-sm font-black text-[#e4c478] transition hover:border-[#c69c46]/80 hover:bg-[#c69c46]/25"
        >
          {copied ? t('copied') : t('copyCode')}
        </motion.button>
      </div>

      {/* Players — arena pods */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {orderedPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              layout
              initial={{ opacity: 0, x: 28, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -28, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className={cn(
                'flex items-center gap-4 rounded-2xl border p-4 shadow-lg transition',
                player.isHost
                  ? 'border-[#4d79a7]/60 bg-[#141d2b]'
                  : index % 2 === 1
                    ? 'border-[#c69c46]/40 bg-[#141d2b]'
                    : 'border-[#223147] bg-[#0d1420]',
              )}
            >
              <span
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold',
                  player.isHost ? 'bg-[#4d79a7]/20 text-[#8eaecf]' : index % 2 === 1 ? 'bg-[#c69c46]/20 text-[#e4c478]' : 'bg-white/10 text-slate-300',
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs font-black text-[#e4c478]">
                  {player.isHost ? t('teamOne') : english ? `Player ${index}` : `اللاعب ${index}`}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-base font-bold text-white">
                  <span aria-hidden>👤</span>
                  <span className="truncate">{player.name}</span>
                  {self.id === player.id && (
                    <span className="rounded-full border border-[#4d79a7]/50 bg-[#4d79a7]/20 px-2 py-0.5 text-[10px] font-black text-[#8eaecf]">
                      {t('you')}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-lg text-[#8eaecf]" aria-hidden>♟</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {orderedPlayers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-[#223147] bg-[#0d1420] p-4 text-center"
          >
            <motion.p
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="mt-1 flex items-center justify-center gap-2 text-sm font-bold text-slate-400"
            >
              <span aria-hidden>⏳</span> {t('waitingForPlayer')}
            </motion.p>
          </motion.div>
        )}
      </div>

      {(isHost || room.categoryIds.length > 0) && (
        <div className="mt-5 rounded-2xl border border-[#223147] bg-[#0d1420] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black text-[#8eaecf]">
              {english ? 'Match categories (host)' : 'فئات المباراة (المضيف)'}
            </p>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-black',
                categoriesReady
                  ? 'border-[#468a5e]/50 bg-[#468a5e]/20 text-[#7ec498]'
                  : 'border-[#c69c46]/50 bg-[#c69c46]/20 text-[#e4c478]',
              )}
            >
              {room.categoryIds.length}/{REQUIRED_CATEGORIES}
            </span>
          </div>

          {isHost ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gameCategories.map((category) => {
                const selected = room.categoryIds.includes(category.id)
                const full = room.categoryIds.length >= REQUIRED_CATEGORIES && !selected
                return (
                  <motion.button
                    key={category.id}
                    type="button"
                    layout
                    whileHover={busy || full ? undefined : { y: -2 }}
                    whileTap={busy || full ? undefined : { scale: 0.96 }}
                    disabled={busy || full}
                    onClick={() => void handleToggleCategory(category.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-start text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35',
                      selected
                        ? 'border-[#4d79a7] bg-[#4d79a7]/20 text-[#8eaecf] shadow-[0_0_12px_rgba(77,121,167,0.3)]'
                        : 'border-[#223147] bg-[#141d2b] text-slate-300 hover:border-[#4d79a7]/50 hover:text-white',
                    )}
                  >
                    <span aria-hidden>{category.icon}</span>
                    <span className="truncate">{presentCategory(category.id, category.title, english)}</span>
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {room.categoryIds.length === 0 ? (
                <p className="text-xs font-bold text-slate-400">
                  {english ? 'Waiting for the host to choose the categories…' : 'بانتظار اختيار المضيف للفئات…'}
                </p>
              ) : (
                room.categoryIds.map((categoryId) => {
                  const category = gameCategories.find((entry) => entry.id === categoryId)
                  if (!category) return null
                  return (
                    <motion.span
                      key={categoryId}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.22 }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#4d79a7]/40 bg-[#4d79a7]/20 px-3 py-1 text-xs font-bold text-[#8eaecf]"
                    >
                      <span aria-hidden>{category.icon}</span>
                      {presentCategory(category.id, category.title, english)}
                    </motion.span>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {(isHost || lifelinesReady || room.team1LifelineIds.length > 0 || room.team2LifelineIds.length > 0) && (
        <div className="mt-5 rounded-2xl border border-[#223147] bg-[#0d1420] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black text-[#e4c478]">
              {english ? 'Match lifelines (host)' : 'اختيار المساعدات (المضيف)'}
            </p>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-black',
                lifelinesReady
                  ? 'border-[#468a5e]/50 bg-[#468a5e]/20 text-[#7ec498]'
                  : 'border-[#c69c46]/50 bg-[#c69c46]/20 text-[#e4c478]',
              )}
            >
              {english
                ? `${room.team1LifelineIds.length}/${REQUIRED_LIFELINES} · ${room.team2LifelineIds.length}/${REQUIRED_LIFELINES}`
                : `${room.team1LifelineIds.length}/${REQUIRED_LIFELINES} · ${room.team2LifelineIds.length}/${REQUIRED_LIFELINES}`}
            </span>
          </div>

          {[1, 2].map((team) => {
            const ids = team === 1 ? room.team1LifelineIds : room.team2LifelineIds
            return (
              <div key={team} className="mt-4">
                <p className="text-[11px] font-black text-slate-400">
                  {team === 1 ? t('teamOne') : t('teamTwo')}
                </p>
                {isHost ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {lifelinePool.map((lifeline) => {
                      const selected = ids.includes(lifeline.id)
                      const full = ids.length >= REQUIRED_LIFELINES && !selected
                      return (
                        <motion.button
                          key={`${team}-${lifeline.id}`}
                          type="button"
                          layout
                          whileHover={busy || full ? undefined : { y: -2 }}
                          whileTap={busy || full ? undefined : { scale: 0.96 }}
                          disabled={busy || full}
                          onClick={() => void handleToggleLifeline(team as 1 | 2, lifeline.id)}
                          className={cn(
                            'flex items-center gap-2 rounded-xl border px-3 py-2 text-start text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35',
                            selected
                              ? team === 1
                                ? 'border-[#4d79a7] bg-[#4d79a7]/20 text-[#8eaecf] shadow-[0_0_12px_rgba(77,121,167,0.3)]'
                                : 'border-[#b04d49] bg-[#b04d49]/20 text-[#d48c88] shadow-[0_0_12px_rgba(176,77,73,0.3)]'
                              : 'border-[#223147] bg-[#141d2b] text-slate-300 hover:border-[#4d79a7]/50 hover:text-white',
                          )}
                        >
                          <span aria-hidden>{lifeline.icon}</span>
                          <span className="truncate">
                            {english ? lifeline.id : lifeline.label}
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ids.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400">
                        {english ? 'Waiting for the host…' : 'بانتظار اختيار المضيف…'}
                      </p>
                    ) : (
                      ids.map((id) => {
                        const lifeline = lifelinePool.find((entry) => entry.id === id)
                        if (!lifeline) return null
                        return (
                          <motion.span
                            key={id}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.22 }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#c69c46]/40 bg-[#c69c46]/15 px-3 py-1 text-xs font-bold text-[#e4c478]"
                          >
                            <span aria-hidden>{lifeline.icon}</span>
                            {english ? lifeline.id : lifeline.label}
                          </motion.span>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {isHost && !lifelinesReady && (
            <p className="mt-3 text-center text-xs font-bold text-[#e4c478]">
              {english
                ? 'Choose exactly 3 lifelines for each team'
                : 'اختر 3 مساعدات لكل فريق'}
            </p>
          )}
        </div>
      )}

      {isHost && (
        <div className="mt-5 space-y-2">
          <motion.button
            type="button"
            disabled={!readyToStart || busy}
            whileHover={readyToStart && !busy ? { y: -2, scale: 1.01 } : undefined}
            whileTap={readyToStart && !busy ? { scale: 0.98 } : undefined}
            onClick={handleStart}
            className={cn(
              'w-full rounded-xl py-4 text-base font-black transition',
              readyToStart && !busy
                ? 'border border-[#c69c46]/60 bg-gradient-to-b from-[#e4c478] to-[#c69c46] text-[#0b1017] shadow-lg shadow-[#c69c46]/25 hover:brightness-105 active:scale-[0.98]'
                : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-500',
            )}
          >
            {busy ? '…' : t('startGame')}
          </motion.button>
          {!roomFull && (
            <p className="text-center text-xs font-bold text-slate-400">
              {english
                ? `Waiting for players to fill the room (${players.length}/${room.maxPlayers})`
                : `بانتظار اكتمال عدد اللاعبين (${players.length}/${room.maxPlayers})`}
            </p>
          )}
          {roomFull && !categoriesReady && (
            <p className="text-center text-xs font-bold text-slate-400">
              {english
                ? `Choose ${REQUIRED_CATEGORIES} categories to start (${room.categoryIds.length}/${REQUIRED_CATEGORIES})`
                : `اختر ${REQUIRED_CATEGORIES} فئات للبدء (${room.categoryIds.length}/${REQUIRED_CATEGORIES})`}
            </p>
          )}
          {roomFull && categoriesReady && !lifelinesReady && (
            <p className="text-center text-xs font-bold text-slate-400">
              {english
                ? 'Choose exactly 3 lifelines for each team to start'
                : 'اختر 3 مساعدات لكل فريق للبدء'}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-[#b04d49]/45 bg-[#b04d49]/12 px-3 py-2 text-sm font-bold text-[#d48c88]">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-rose-500/30 bg-gradient-to-b from-[#1e141a] to-[#120c12] px-4 py-2.5 text-xs font-bold text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-rose-400/60 hover:bg-rose-950/40 hover:text-white hover:shadow-[0_0_16px_rgba(244,63,94,0.2)] active:scale-[0.97] sm:text-sm"
        >
          <LogOut className="h-4 w-4 text-rose-400 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>{english ? 'Leave room' : 'مغادرة الروم'}</span>
        </button>
        <span className="text-[10px] font-bold text-slate-400">{t('onlineLive')}</span>
      </div>

      <LeaveRoomConfirm
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false)
          void handleLeave()
        }}
      />
    </div>
  )
}
