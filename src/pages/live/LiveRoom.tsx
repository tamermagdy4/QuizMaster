import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { useAuth } from '../../auth/AuthProvider'
import { getSupabaseClient } from '../../lib/supabaseClient'
import {
  advanceGamePhase,
  closeAndGrade,
  confirmScoring,
  copyLiveInvite,
  createLiveRoom,
  deleteLiveRoom,
  finishLiveGame,
  getLiveAnswers,
  getLivePlayers,
  getLiveQuestions,
  getLiveRoom,
  getLiveRoundHistory,
  getLiveRoundHistoryByRoom,
  type LiveRoundHistoryRow,
  markLiveConnected,
  overrideGrade,
  pauseGame,
  resumeGame,
  skipQuestion,
  sweepLiveStale,
  submitLiveAnswer,
  transferLiveHost,
  updateLiveRoomSettings,
  type LiveAnswerRow,
  type LivePlayerRow,
  type LiveQuestionRow,
  type LiveRoomRow,
} from '../../services/livePackService'

// Extracted components
import { useQuestionCountdown } from '../../components/live/shared'
import { HostLobby, PlayerLobby } from '../../components/live/PartyLobby'
import { HostGameView } from '../../components/live/HostGameView'
import { PlayerGameView } from '../../components/live/PlayerGameView'
import { GameResults } from '../../components/live/GameResults'
import { PreviousRoundSummary } from '../../components/live/PreviousRoundSummary'
import { RoundHistoryModal } from '../../components/live/RoundHistoryModal'
import { CountdownOverlay } from '../../components/live/CountdownOverlay'
import { subscribeToLiveRoom, type GamePhase } from '../../services/livePackService'

const HEARTBEAT_MS = 8000

// ---------------------------------------------------------------------------
// Game-loop timings (in milliseconds)
// ---------------------------------------------------------------------------
const INTRO_DURATION = 3000       // 3 seconds showing "Question N"
const REVEAL_DURATION = 4000      // 4 seconds showing correct answer
const SCORING_DURATION = 3000     // 3 seconds showing score changes

// ---------------------------------------------------------------------------
// Main page — game-loop-driven state machine
// ---------------------------------------------------------------------------

export function LiveRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const english = useAppStore((state) => state.language === 'en')
  const { user } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = useState<LiveRoomRow | null>(null)
  const [players, setPlayers] = useState<LivePlayerRow[]>([])
  const [questions, setQuestions] = useState<LiveQuestionRow[]>([])
  const [answers, setAnswers] = useState<LiveAnswerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [connection, setConnection] = useState<string>('connecting')
  const [hostGone, setHostGone] = useState(false)
  const [promoted, setPromoted] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<LiveRoundHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [previousRound, setPreviousRound] = useState<LiveRoundHistoryRow | null>(null)
  const [showCountdown, setShowCountdown] = useState(false)

  // Timers for auto-advance (host only, to avoid duplicate calls)
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gradingDoneRef = useRef<string | null>(null) // track which question we've already graded

  const myPlayer = useState(() =>
    null as LivePlayerRow | null
  )[0] // Will be computed below

  const myPlayerComputed = players.find((player) => player.user_id === user?.id) ?? null
  const isHost = Boolean(room && user && room.host_auth_id === user.id)

  // Get the game phase from the room (with fallback for old rooms without the column)
  const gamePhase: GamePhase = (room?.game_phase as GamePhase) ?? 'lobby'

  // Initial load
  useEffect(() => {
    if (!roomId) return
    let mounted = true
    void (async () => {
      try {
        const [roomRow, playerRows, questionRows, answerRows] = await Promise.all([
          getLiveRoom(roomId),
          getLivePlayers(roomId),
          getLiveQuestions(roomId),
          getLiveAnswers(roomId),
        ])
        if (!mounted) return
        if (!roomRow) { setError(english ? 'Room not found.' : 'الغرفة غير موجودة.'); return }
        setRoom(roomRow)
        setPlayers(playerRows)
        setQuestions(questionRows)
        setAnswers(answerRows)
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : (english ? 'Could not load the room.' : 'تعذر تحميل الغرفة.'))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [roomId])

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return
    const unsubscribe = subscribeToLiveRoom(roomId, {
      onRoomChange: (nextRoom) => setRoom(nextRoom),
      onPlayersChange: (nextPlayers) => setPlayers(nextPlayers),
      onQuestionsChange: (nextQuestions) => setQuestions(nextQuestions),
      onAnswersChange: (nextAnswers) => setAnswers(nextAnswers),
      onStatusChange: (status) => setConnection(status),
    })
    return unsubscribe
  }, [roomId])

  // Heartbeat
  useEffect(() => {
    if (!roomId || !user) return
    const beat = () => { void markLiveConnected(roomId); void sweepLiveStale(roomId) }
    beat()
    const interval = window.setInterval(beat, HEARTBEAT_MS)
    return () => window.clearInterval(interval)
  }, [roomId, user])

  // Detect disconnected host
  useEffect(() => {
    if (!room || !room.host_player_id) return
    const hostRow = players.find((player) => player.id === room.host_player_id)
    setHostGone(Boolean(hostRow && !hostRow.connected))
  }, [room, players])

  // Welcome promoted player
  const storageKey = `live-host:${roomId ?? ''}`
  const [prevHost, setPrevHost] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey)
      return stored && stored !== 'null' ? stored : null
    } catch { return null }
  })
  useEffect(() => {
    if (!room) return
    if (prevHost !== null && prevHost !== room.host_auth_id && room.host_auth_id === user?.id) {
      setPromoted(true)
    }
    setPrevHost(room.host_auth_id)
    try { sessionStorage.setItem(storageKey, room.host_auth_id) } catch { /* ignore */ }
  }, [room?.host_auth_id, user?.id, storageKey, prevHost])

  const act = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true); setNotice(null)
    try { await action() }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : (english ? 'Something went wrong.' : 'حدث خطأ ما.')) }
    finally { setBusy(false) }
  }, [english])

  const { remainingSeconds, expired } = useQuestionCountdown(room)

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME LOOP — Host drives the state machine via timers
  // ═══════════════════════════════════════════════════════════════════════════

  // When the timer expires during 'active' phase → auto-close and grade → move DIRECTLY to host_review (no locked phase)
  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'playing') return
    if (room.game_phase !== 'active') return
    if (!expired) return
    if (gradingDoneRef.current === `${room.id}-${room.current_question_index}`) return

    gradingDoneRef.current = `${room.id}-${room.current_question_index}`

    // Auto-close answers and auto-grade ALL pending answers (no intermediate locked phase)
    void closeAndGrade(room.id).then(() => {
      // Move DIRECTLY to 'host_review' — answers are revealed, host reviews auto-grade
      return advanceGamePhase(room.id, 'host_review')
    }).catch(console.error)
  }, [expired, room?.id, room?.current_question_index, room?.game_phase, isHost])

  // Auto-advance from 'question_intro' → 'active' (start timer)
  useEffect(() => {
    if (!room || !isHost) return
    if (room.game_phase !== 'question_intro') return

    phaseTimerRef.current = setTimeout(() => {
      if (room) void advanceGamePhase(room.id, 'active').catch(console.error)
    }, INTRO_DURATION)

    return () => { if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current) }
  }, [room?.game_phase, room?.current_question_index, isHost])

  // Clean up timers on unmount
  useEffect(() => {
    return () => { if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current) }
  }, [])

  // Reset grading ref when question changes
  useEffect(() => {
    gradingDoneRef.current = null
  }, [room?.current_question_index])

  const handleAutoNext = useCallback(async (currentRoom: LiveRoomRow) => {
    try {
      const total = questions.length
      if (currentRoom.current_question_index + 1 >= total) {
        // Last question → finish
        await finishLiveGame(currentRoom.id)
      } else {
        // Move to next question
        await advanceGamePhase(currentRoom.id, 'question_intro')
        // Update question index + reset timer
        const supabase = (await import('../../lib/supabaseClient')).getSupabaseClient()
        await supabase.rpc('live_next_question', { p_room_id: currentRoom.id })
      }
    } catch (reason) {
      console.error('[game-loop] auto-next failed', reason)
    }
  }, [questions.length])

  // ═══════════════════════════════════════════════════════════════════════════
  // HOST ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleUpdateSettings = useCallback((settings: {
    questionCount?: number; questionTimeSeconds?: number; minWager?: number; maxWager?: number; deductOnWrong?: boolean; maxPlayers?: number
  }) => {
    if (!room) return
    void act(() => updateLiveRoomSettings(room.id, settings))
  }, [room, act])

  const handleStart = async () => {
    if (!room) return
    setStarting(true); setNotice(null)
    try {
      const supabase = (await import('../../lib/supabaseClient')).getSupabaseClient()
      const { data: pack } = await supabase.from('packs').select('*').eq('id', room.pack_id).maybeSingle()
      if (!pack) throw new Error(english ? 'Could not load the pack.' : 'تعذر تحميل الباقة.')
      const liveSvc = await import('../../services/livePackService')
      const resolvedQuestions = await liveSvc.resolveLivePackQuestions(pack, room.question_count)
      if (resolvedQuestions.length === 0) throw new Error(english ? 'No playable questions.' : 'لا توجد أسئلة.')
      await liveSvc.startLiveGame(room.id, resolvedQuestions)
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Could not start.' : 'تعذر بدء اللعبة.'))
    } finally { setStarting(false) }
  }

  // Show countdown when game starts
  useEffect(() => {
    if (room?.status === 'playing' && room.game_phase === 'question_intro' && !showCountdown) {
      setShowCountdown(true)
    }
  }, [room?.status, room?.game_phase])

  const handleDelete = async () => {
    if (!room) return
    const confirmed = window.confirm(english ? 'Delete this room?' : 'حذف الغرفة؟')
    if (!confirmed) return
    await act(async () => { await deleteLiveRoom(room.id); navigate('/', { replace: true }) })
  }

  const handleSubmitAnswer = useCallback((wager: number, text: string) => {
    if (!room) return
    void act(() => submitLiveAnswer(room.id, room.current_question_index, text, wager))
  }, [room, act])

  const handleOverrideGrade = useCallback((playerId: string, status: 'correct' | 'wrong') => {
    if (!room) return
    void act(() => overrideGrade(room.id, playerId, room.current_question_index, status))
  }, [room, act])

  const handleConfirmScoring = useCallback(async () => {
    if (!room) return
    await act(async () => {
      // 1. Confirm scoring (finalizes grades using finalGrade, calculates scores)
      await confirmScoring(room.id)
      // 2. Move DIRECTLY to scoring phase (skip redundant reveal — answers already shown in host_review)
      await advanceGamePhase(room.id, 'scoring')
      // 3. After scoring duration, auto-advance to next question
      phaseTimerRef.current = setTimeout(() => {
        if (room) void handleAutoNext(room)
      }, SCORING_DURATION)
    })
  }, [room, act])

  const handleSkip = useCallback(() => {
    if (!room) return
    void act(() => skipQuestion(room.id))
  }, [room, act])

  const handlePause = useCallback(() => {
    if (!room) return
    void act(() => pauseGame(room.id))
  }, [room, act])

  const handleResume = useCallback(() => {
    if (!room) return
    void act(() => resumeGame(room.id))
  }, [room, act])

  const handleFinish = useCallback(async () => {
    if (!room) return
    const confirmed = window.confirm(english ? 'End the game?' : 'إنهاء اللعبة؟')
    if (!confirmed) return
    await act(() => finishLiveGame(room.id))
  }, [room, act, english])

  const openHistory = useCallback(async () => {
    if (!room) return
    setHistoryOpen(true); setHistoryLoading(true)
    try { const rows = await getLiveRoundHistory(room.pack_id); setHistory(rows) }
    catch { setHistory([]) } finally { setHistoryLoading(false) }
  }, [room])

  // Replay lobby
  useEffect(() => {
    let cancelled = false
    const previousRoomId = room?.previous_room_id
    if (!room || room.status !== 'lobby' || !previousRoomId) { setPreviousRound(null); return }
    void getLiveRoundHistoryByRoom(previousRoomId)
      .then((row) => { if (!cancelled) setPreviousRound(row) })
      .catch(() => { if (!cancelled) setPreviousRound(null) })
    return () => { cancelled = true }
  }, [room?.id, room?.status, room?.previous_room_id])

  const handlePlayAgain = async () => {
    if (!room) return
    setStarting(true); setNotice(null)
    try {
      const newRoomId = await createLiveRoom(room.pack_id, {
        questionCount: room.question_count,
        questionTimeSeconds: room.question_timeout_seconds,
        minWager: room.min_wager,
        maxWager: room.max_wager,
        deductOnWrong: room.deduct_on_wrong,
        maxPlayers: room.max_players,
      }, room.id)
      const newRoom = await getLiveRoom(newRoomId)
      if (newRoom) await copyLiveInvite(newRoom.room_code, room.id)
      navigate(`/live/${newRoomId}`, { replace: true })
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Could not create new game.' : 'تعذر إنشاء جولة جديدة.'))
      setStarting(false)
    }
  }

  const handleTakeOverHost = () => {
    if (!room || !myPlayerComputed) return
    void act(() => transferLiveHost(room.id, myPlayerComputed.id))
  }

  // ---------------------------------------------------------------------------

  if (loading) return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-48 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
      <div className="h-40 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
    </div>
  )

  if (error || !room) return (
    <div className="mx-auto max-w-xl rounded-3xl border border-red/40 bg-red/10 px-6 py-10 text-center">
      <span className="text-4xl">📭</span>
      <h1 className="mt-3 text-xl font-black text-red">{english ? 'Room unavailable' : 'الغرفة غير متاحة'}</h1>
      <p className="mt-2 text-sm text-muted">{error ?? ''}</p>
      <Link to="/" className="btn btn-ghost mt-5 rounded-xl px-4 py-2 text-sm font-black">{english ? 'Back to Home' : 'العودة إلى الرئيسية'}</Link>
    </div>
  )

  const myAnswer = myPlayerComputed
    ? answers.find((a) => a.player_id === myPlayerComputed.id && a.question_index === room.current_question_index) ?? null
    : null

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-3xl space-y-4">

      {/* Connection status */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-soft bg-white/70 px-4 py-2.5 text-xs font-black">
        <span className="flex items-center gap-2 text-muted">
          <span className={`h-2 w-2 rounded-full ${connection === 'SUBSCRIBED' ? 'bg-green' : connection === 'CHANNEL_ERROR' ? 'bg-red' : 'bg-gold'}`} />
          {connection === 'SUBSCRIBED' ? (english ? 'Live' : 'مباشر') : (english ? 'Connecting…' : 'جارٍ الاتصال…')}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span className={`h-2 w-2 rounded-full ${players.some((p) => p.id === room.host_player_id && p.connected) ? 'bg-green' : 'bg-red'}`} />
          🎙 {room.host_name}
        </span>
        {room.status === 'playing' && (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-0.5 text-gold">
            {english ? `Q${room.current_question_index + 1}/${room.question_count}` : `${room.current_question_index + 1}/${room.question_count} س`}
          </span>
        )}
      </div>

      {/* Host gone warning */}
      {hostGone && !isHost && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">
          <span>⚠ {english ? 'Host disconnected.' : 'المضيف غير متصل.'}</span>
          <button type="button" onClick={handleTakeOverHost} disabled={busy} className="rounded-xl border border-red/50 bg-white px-4 py-2 text-xs font-black text-red transition hover:bg-red hover:text-white disabled:opacity-50">
            {english ? 'Become host' : 'تولَّ المضيف'}
          </button>
        </div>
      )}

      {/* Promoted notification */}
      {promoted && isHost && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold/60 bg-gold/15 px-4 py-3 text-sm font-black text-gold">
          <span>🎙️ {english ? 'You are now the host.' : 'أنت الآن المضيف.'}</span>
          <button type="button" onClick={() => setPromoted(false)} className="rounded-lg px-2 py-1 text-xs text-gold/70 hover:text-gold">✕</button>
        </div>
      )}

      {/* Previous round summary in replay lobby */}
      {room?.status === 'lobby' && previousRound && (
        <PreviousRoundSummary round={previousRound} english={english} />
      )}

      {/* ═══ HOST VIEWS ═══ */}
      {isHost ? (
        <>
          {room.status === 'lobby' && (
            <HostLobby room={room} players={players} english={english}
              onStart={() => void handleStart()} onDelete={() => void handleDelete()}
              onUpdateSettings={handleUpdateSettings} starting={starting} />
          )}
          {room.status === 'playing' && (
            <HostGameView
              room={room} players={players} questions={questions} answers={answers}
              remainingSeconds={remainingSeconds} expired={expired} myAnswer={myAnswer}
              english={english} gamePhase={gamePhase}
              onOverrideGrade={handleOverrideGrade} onSubmit={handleSubmitAnswer}
              onPause={handlePause} onResume={handleResume} onSkip={handleSkip} onFinish={() => void handleFinish()}
              onConfirmScoring={handleConfirmScoring} busy={busy} />
          )}
          {room.status === 'finished' && (
            <GameResults players={players} english={english} totalQuestions={room.question_count}
              isHost={true} myPlayer={myPlayerComputed} starting={starting}
              onPlayAgain={() => void handlePlayAgain()} onOpenHistory={() => void openHistory()}
              packId={room.pack_id} />
          )}
        </>
      ) : (
        <>
          {/* ═══ PLAYER VIEWS ═══ */}
          {room.status === 'lobby' && (
            <PlayerLobby room={room} players={players} english={english} selfPlayerId={user?.id} />
          )}
          {room.status === 'playing' && (
            <PlayerGameView
              room={room} players={players} questions={questions} answers={answers} myAnswer={myAnswer}
              remainingSeconds={remainingSeconds} expired={expired} english={english}
              gamePhase={gamePhase} onSubmit={handleSubmitAnswer} busy={busy} />
          )}
          {room.status === 'finished' && (
            <GameResults players={players} english={english} totalQuestions={room.question_count}
              isHost={false} myPlayer={myPlayerComputed} starting={starting}
              onPlayAgain={() => void handlePlayAgain()} onOpenHistory={() => void openHistory()}
              packId={room.pack_id} />
          )}
        </>
      )}

      {/* Notice toast */}
      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-5 start-1/2 z-[80] -translate-x-1/2 rounded-2xl border border-red/40 bg-white px-5 py-3 text-sm font-bold text-red shadow-raised"
            dir={english ? 'ltr' : 'rtl'}>
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="ms-3 text-red/60 hover:text-red">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown overlay */}
      {showCountdown && (
        <CountdownOverlay onComplete={() => setShowCountdown(false)} />
      )}

      {/* Round history modal */}
      <RoundHistoryModal open={historyOpen} loading={historyLoading} rounds={history} packTitle={room?.pack_title ?? ''} english={english} onClose={() => setHistoryOpen(false)} />
    </div>
  )
}
