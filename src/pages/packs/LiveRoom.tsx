import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { useAuth } from '../../auth/AuthProvider'
import { getPack } from '../../services/packService'
import {
  closeLiveQuestion,
  copyLiveInvite,
  createLiveRoom,
  deleteLiveRoom,
  finishLiveGame,
  getLiveAnswers,
  getLivePlayers,
  getLiveQuestions,
  getLiveQuestionRemainingMs,
  getLiveRoom,
  getLiveRoundHistory,
  getLiveRoundHistoryByRoom,
  type LiveRoundHistoryRow,
  markLiveConnected,
  nextLiveQuestion,
  previousLiveQuestion,
  resolveLivePackQuestions,
  reviewLiveAnswer,
  startLiveGame,
  submitLiveAnswer,
  subscribeToLiveRoom,
  sweepLiveStale,
  transferLiveHost,
  updateLiveRoomSettings,
  type LiveAnswerRow,
  type LivePlayerRow,
  type LiveQuestionRow,
  type LiveRoomRow,
} from '../../services/livePackService'
import { cn } from '../../utils/cn'

const HEARTBEAT_MS = 8000
const QUESTION_COUNT_OPTIONS = [5, 10, 20]
const TIMEOUT_OPTIONS = [15, 30, 45, 60]
const MAX_PLAYERS_OPTIONS = [10, 20, 36, 50, 100]

/** Avatar: real user image when available, otherwise the first letter. */
function PlayerAvatar({ player, size = 'md' }: { player: LivePlayerRow; size?: 'sm' | 'md' }) {
  const classes = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-sm'
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.name}
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full border border-white/40 object-cover shadow-sm', classes)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gradient-to-b from-teal to-navy font-black text-gold-bright', classes)}
    >
      {(player.name || '؟').trim().charAt(0)}
    </span>
  )
}

/**
 * Shared per-question countdown. Derives the deadline from the room's
 * question_started_at + question_timeout_seconds (the DB is the source of
 * truth), so every client shows the exact same remaining time.
 */
function useQuestionCountdown(room: LiveRoomRow | null): { remainingSeconds: number | null; expired: boolean } {
  // Tick every 250ms while a question is open; the deadline itself always
  // comes from the DB, so `now` only drives re-renders.
  const [, setNow] = useState(0)
  const playing = Boolean(room && room.status === 'playing' && room.question_started_at)
  useEffect(() => {
    if (!playing) return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [playing, room?.id, room?.question_started_at, room?.question_timeout_seconds])
  if (!playing || !room) return { remainingSeconds: null, expired: false }
  const ms = getLiveQuestionRemainingMs(room)
  if (ms === null) return { remainingSeconds: null, expired: false }
  const remainingSeconds = Math.ceil(ms / 1000)
  return { remainingSeconds, expired: remainingSeconds <= 0 }
}

function QuestionTimer({ remainingSeconds, english }: { remainingSeconds: number | null; english: boolean }) {
  if (remainingSeconds === null) return null
  const expired = remainingSeconds <= 0
  const urgent = !expired && remainingSeconds <= 10
  return (
    <span
      dir="ltr"
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black tabular-nums',
        expired ? 'border-red/60 bg-red/15 text-red' : urgent ? 'border-red/50 bg-red/10 text-red' : 'border-gold/50 bg-gold/10 text-gold-bright',
      )}
    >
      <span aria-hidden>⏱</span>
      {expired ? (english ? 'Time up' : 'انتهى الوقت') : `${remainingSeconds}s`}
    </span>
  )
}

function OnlineDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        connected ? 'bg-green shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red/70',
      )}
      aria-hidden
    />
  )
}

/** Rank medals + labels for the final leaderboard. */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return <span className="text-2xl" aria-hidden>🏆</span>
  if (rank === 1) return <span className="text-2xl" aria-hidden>🥈</span>
  if (rank === 2) return <span className="text-2xl" aria-hidden>🥉</span>
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-sm font-black text-muted">
      {rank + 1}
    </span>
  )
}

function Leaderboard({ players, english, totalQuestions }: { players: LivePlayerRow[]; english: boolean; totalQuestions: number }) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const safeTotal = Math.max(totalQuestions || 1, 1)
  return (
    <div className="space-y-3">
      {sorted.map((player, index) => {
        const answered = player.correct_count + player.wrong_count
        const correctPct = Math.min(Math.round((player.correct_count / safeTotal) * 100), 100)
        return (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.07, 0.6) }}
            className={cn(
              'rounded-2xl border p-4',
              index === 0 ? 'border-gold/50 bg-gold/10' : 'border-border-soft bg-white/80',
            )}
          >
            <div className="flex items-center gap-4">
              <RankBadge rank={index} />
              <PlayerAvatar player={player} size="sm" />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-black', index === 0 ? 'text-gold-bright' : 'text-navy')}>{player.name}</p>
                <p className="text-xs font-bold text-muted">
                  {answered} {english ? 'answers' : 'إجابة'}
                </p>
                {/* Correct-answer progress vs total questions */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green/80 to-gold transition-all duration-500"
                      style={{ width: `${correctPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                    {player.correct_count} / {totalQuestions}
                  </span>
                </div>
              </div>
              <span className="font-display text-2xl font-black text-gold">{player.score}</span>
              <span className="text-xs font-bold text-muted">{english ? 'pts' : 'نقطة'}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-soft pt-3 text-center sm:grid-cols-4">
              <div className="rounded-xl bg-green/5 px-2 py-2">
                <p className="text-lg font-black text-green">✓ {player.correct_count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Correct' : 'صحيحة'}</p>
              </div>
              <div className="rounded-xl bg-red/5 px-2 py-2">
                <p className="text-lg font-black text-red">✗ {player.wrong_count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Wrong' : 'خاطئة'}</p>
              </div>
              <div className="rounded-xl bg-navy/5 px-2 py-2">
                <p className="text-lg font-black text-navy">{player.avg_wager}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Avg wager' : 'متوسط الرهان'}</p>
              </div>
              <div className="rounded-xl bg-gold/10 px-2 py-2">
                <p className="text-lg font-black text-gold">★ {player.best_win_wager || '—'}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{english ? 'Best win' : 'أعلى رهان رابح'}</p>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/** Host lobby: room code + share + round settings + player list + start. */
function HostLobby({
  room,
  players,
  english,
  onStart,
  onDelete,
  onUpdateSettings,
  starting,
}: {
  room: LiveRoomRow
  players: LivePlayerRow[]
  english: boolean
  onStart: () => void
  onDelete: () => void
  onUpdateSettings: (settings: { questionCount?: number; questionTimeSeconds?: number; minWager?: number; maxWager?: number; deductOnWrong?: boolean; maxPlayers?: number }) => void
  starting: boolean
}) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const copy = async (kind: 'code' | 'link') => {
    if (kind === 'code') await navigator.clipboard.writeText(room.room_code)
    else await copyLiveInvite(room.room_code, room.previous_room_id)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-white shadow-panel sm:p-8">
        <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <span className="text-3xl" aria-hidden>🎙️</span>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">
            {english ? 'You are the host' : 'أنت المضيف'}
          </p>
          <h1 className="font-display text-2xl font-black sm:text-3xl">{room.pack_title}</h1>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-bold text-white/60">{english ? 'Room code' : 'كود الغرفة'}</p>
            <div className="flex items-center gap-3">
              <span dir="ltr" className="rounded-2xl border border-gold/50 bg-black/30 px-6 py-3 font-display text-3xl font-black tracking-[0.4em] text-gold-bright">
                {room.room_code}
              </span>
              <button type="button" onClick={() => void copy('code')} className="rounded-xl border border-white/25 bg-white/10 px-3 py-3 text-xs font-black text-white transition hover:bg-white/20">
                {copied === 'code' ? '✓' : '📋'}
              </button>
            </div>
            <button type="button" onClick={() => void copy('link')} className="rounded-xl border border-teal/50 bg-teal/15 px-4 py-2 text-xs font-black text-teal-bright transition hover:bg-teal/25">
              {copied === 'link' ? (english ? 'Copied ✓' : 'تم النسخ ✓') : english ? 'Copy invite link' : 'نسخ رابط الدعوة'}
            </button>
          </div>

          {room.previous_room_id && (
            <p className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-black text-gold">
              🔁 {english ? 'Replay round — players rejoin with one click from this link' : 'جولة متابعة — اللاعبون يعودون بنقرة واحدة من هذا الرابط'}
            </p>
          )}

          <p className="text-xs font-bold text-white/55">
            {players.length} / {room.max_players} {english ? 'players' : 'لاعبين'} •{' '}
            {english ? 'share the code so friends can join' : 'شارك الكود ليدخل أصدقاؤك'}
          </p>

          {/* Round settings (host only) */}
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-black/25 p-4 backdrop-blur-sm sm:p-5">
            <p className="text-center text-xs font-black uppercase tracking-[0.16em] text-white/60">
              ⚙️ {english ? 'Round settings' : 'إعدادات الجولة'}
            </p>

            <div className="mt-4 space-y-4">
              {/* Question count */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-white/75">{english ? 'Questions' : 'عدد الأسئلة'}</span>
                <div className="flex items-center gap-1.5">
                  {QUESTION_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onUpdateSettings({ questionCount: count })}
                      className={cn(
                        'rounded-lg border px-3.5 py-1.5 text-xs font-black tabular-nums transition',
                        room.question_count === count
                          ? 'border-gold bg-gold text-navy shadow-[0_6px_14px_rgba(201,162,39,0.3)]'
                          : 'border-white/25 bg-white/10 text-white hover:bg-white/20',
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question time */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-white/75">⏱ {english ? 'Time per question' : 'مدة السؤال'}</span>
                <div className="flex items-center gap-1.5">
                  {TIMEOUT_OPTIONS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      onClick={() => onUpdateSettings({ questionTimeSeconds: seconds })}
                      className={cn(
                        'rounded-lg border px-3.5 py-1.5 text-xs font-black tabular-nums transition',
                        room.question_timeout_seconds === seconds
                          ? 'border-gold bg-gold text-navy shadow-[0_6px_14px_rgba(201,162,39,0.3)]'
                          : 'border-white/25 bg-white/10 text-white hover:bg-white/20',
                      )}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Points rule (Sporcle): the ceiling = the question count */}
              <div className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5">
                <p className="text-xs font-black text-gold-bright">💎 {english ? 'Points rule' : 'قاعدة النقاط'}</p>
                <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/70">
                  {english
                    ? `Each player chooses the value of their answer themselves, from 1 to ${room.max_wager} points per question (max = the question count).`
                    : `كل لاعب يختار قيمة إجابته بنفسه من 1 إلى ${room.max_wager} نقطة لكل سؤال (الحد الأقصى = عدد الأسئلة).`}
                </p>
              </div>

              {/* Party size */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-white/75">👥 {english ? 'Party size' : 'عدد اللاعبين'}</span>
                <div className="flex items-center gap-1.5">
                  {MAX_PLAYERS_OPTIONS.map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => onUpdateSettings({ maxPlayers: limit })}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-black tabular-nums transition',
                        room.max_players === limit
                          ? 'border-gold bg-gold text-navy shadow-[0_6px_14px_rgba(201,162,39,0.3)]'
                          : 'border-white/25 bg-white/10 text-white hover:bg-white/20',
                      )}
                    >
                      {limit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deduction toggle */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ deductOnWrong: !room.deduct_on_wrong })}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 transition hover:bg-white/10"
              >
                <span className="text-xs font-bold text-white/80">
                  {english ? 'Wrong answers subtract the wager' : 'الخصم من النقاط عند الإجابة الخاطئة'}
                </span>
                <span
                  className={cn(
                    'relative h-5 w-9 shrink-0 rounded-full transition',
                    room.deduct_on_wrong ? 'bg-green' : 'bg-white/20',
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                      room.deduct_on_wrong ? 'start-[18px]' : 'start-0.5',
                    )}
                  />
                </span>
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] text-white/45">
              {english
                ? 'Players choose their own wager before answering. The timer is shared by everyone.'
                : 'كل لاعب يختار قيمة إجابته قبل الإرسال، والعدّاد مشترك بين الجميع.'}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onStart}
              disabled={starting || players.length === 0}
              className="rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-8 py-3.5 text-sm font-black text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)] transition hover:brightness-110 active:translate-y-px disabled:opacity-50"
            >
              {starting ? (english ? 'Preparing questions…' : 'جارٍ تجهيز الأسئلة…') : `▶ ${english ? 'Start Game' : 'بدء اللعبة'}`}
            </button>
            <button type="button" onClick={onDelete} className="rounded-2xl border border-red/40 bg-red/10 px-5 py-3.5 text-sm font-black text-red transition hover:bg-red/20">
              {english ? 'Cancel room' : 'إلغاء الغرفة'}
            </button>
          </div>
        </div>
      </div>

      <PlayerList players={players} english={english} title={english ? 'Players in the room' : 'اللاعبون في الغرفة'} />
    </div>
  )
}

/** Compact realtime leaderboard (updates live as the host reviews answers). */
/** Tiny gold crown badge marking the best player in a given stat. */
function BestStatBadge({ label, title }: { label: string; title: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={title}
      className="ms-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold/25 text-[9px] leading-none shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
    >
      👑
    </span>
  )
}

function LeaderboardPanel({ players, english, totalQuestions }: { players: LivePlayerRow[]; english: boolean; totalQuestions: number }) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const safeTotal = Math.max(totalQuestions || 1, 1)
  // Which stat groups to show: all / answers only / wagers only.
  const [filter, setFilter] = useState<'all' | 'correct' | 'wagers'>('all')
  const showAnswers = filter !== 'wagers'
  const showWagers = filter !== 'correct'
  // Best-in-stat markers (ignored when no one has scored in that stat yet).
  const maxCorrect = sorted.reduce((max, p) => Math.max(max, p.correct_count), 0)
  const maxAvgWager = sorted.reduce((max, p) => Math.max(max, p.avg_wager), 0)
  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-black text-navy">
          🏆 {english ? 'Live leaderboard' : 'لوحة الصدارة'}
        </h3>
        {/* Stat filter — toggle which stats each row shows */}
        <div className="flex items-center gap-0.5 rounded-full border border-border-soft bg-white/70 p-0.5" role="group" aria-label={english ? 'Show stats' : 'عرض الإحصاءات'}>
          {(
            [
              { id: 'all', label: english ? 'All' : 'الكل' },
              { id: 'correct', label: english ? 'Correct' : 'الصحيحة' },
              { id: 'wagers', label: english ? 'Wagers' : 'الرهانات' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-black transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/60',
                filter === option.id
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-muted hover:bg-white hover:text-navy',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {sorted.length === 0 && <p className="text-sm text-muted">{english ? 'No players yet.' : 'لا يوجد لاعبون بعد.'}</p>}
        {sorted.map((player, index) => {
          const correctPct = Math.min(Math.round((player.correct_count / safeTotal) * 100), 100)
          const isBestCorrect = player.correct_count > 0 && player.correct_count === maxCorrect
          const isBestAvgWager = player.avg_wager > 0 && player.avg_wager === maxAvgWager
          return (
            <div
              key={player.id}
              className={cn(
                'rounded-xl border px-3 py-2',
                index === 0 ? 'border-gold/40 bg-gold/10' : 'border-border-soft bg-surface-raised/70',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 shrink-0 text-sm" aria-hidden>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-black text-navy">{player.name}</span>
                    <OnlineDot connected={player.connected} />
                  </div>
                  {/* Live per-player stats — same source as the results screen, refreshes in real time */}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-black tabular-nums">
                    {showAnswers && (
                      <span className="text-green">
                        ✓ {player.correct_count}
                        {isBestCorrect && <BestStatBadge label={english ? 'Most correct answers' : 'الأكثر إجابات صحيحة'} title={english ? 'Most correct' : 'الأكثر صحة'} />}
                      </span>
                    )}
                    {showAnswers && <span className="text-red">✗ {player.wrong_count}</span>}
                    {showWagers && (
                      <span className="text-navy">
                        {english ? 'avg' : 'متوسط'}: {player.avg_wager}
                        {isBestAvgWager && <BestStatBadge label={english ? 'Highest average wager' : 'الأعلى متوسط رهان'} title={english ? 'Highest avg wager' : 'الأعلى متوسط رهان'} />}
                      </span>
                    )}
                    {showWagers && <span className="text-gold">★ {player.best_win_wager || '—'}</span>}
                  </p>
                  {/* Correct-answer progress vs total questions — fills live with each review */}
                  {showAnswers && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green/80 to-gold transition-all duration-500"
                          style={{ width: `${correctPct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                        {player.correct_count} / {totalQuestions}
                      </span>
                    </div>
                  )}
                </div>
                <span className="shrink-0 font-display text-base font-black tabular-nums text-gold">{player.score}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Cumulative judged-question summary — per player, the total correct/wrong
 * verdicts the host has given across the WHOLE round (not just the current
 * question). Sits next to the live leaderboard.
 */
function CumulativeSummary({ players, english }: { players: LivePlayerRow[]; english: boolean }) {
  const sorted = useMemo(
    () => [...players].sort(
      (a, b) => (b.correct_count + b.wrong_count) - (a.correct_count + a.wrong_count) || b.correct_count - a.correct_count,
    ),
    [players],
  )
  const maxJudged = Math.max(1, ...sorted.map((p) => p.correct_count + p.wrong_count))
  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-4 shadow-panel sm:p-5">
      <h3 className="font-black text-navy">📊 {english ? 'Cumulative summary' : 'الملخص التراكمي'}</h3>
      <p className="mt-0.5 text-[11px] font-bold text-muted">
        {english ? 'Judged questions this round — per player' : 'إجمالي الأسئلة المحكومة عبر الجولة — لكل لاعب'}
      </p>
      <div className="mt-3 space-y-2">
        {sorted.length === 0 && <p className="text-sm text-muted">{english ? 'No players yet.' : 'لا يوجد لاعبون بعد.'}</p>}
        {sorted.map((player) => {
          const judged = player.correct_count + player.wrong_count
          const accuracy = judged > 0 ? Math.round((player.correct_count / judged) * 100) : 0
          return (
            <div key={player.id} className="rounded-xl border border-border-soft bg-white/60 px-3 py-2">
              <div className="flex items-center gap-2.5">
                <PlayerAvatar player={player} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
                <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">
                  {english ? 'judged' : 'مُحكم'}: {judged}
                </span>
              </div>
              {/* Share of judged questions vs the most-judged player */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green/80 to-gold transition-all duration-500"
                    style={{ width: `${Math.round((judged / maxJudged) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] font-black tabular-nums">
                <span className="text-green">✓ {player.correct_count}</span>
                <span className="text-red">✗ {player.wrong_count}</span>
                <span className={cn('ms-auto rounded-full px-1.5 py-0.5', accuracy >= 60 ? 'bg-green/10 text-green' : accuracy >= 40 ? 'bg-gold/10 text-gold' : 'bg-red/10 text-red')}>
                  {accuracy}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 🏆 Previous-round summary shown in a NEW lobby — final ranking + points of
 * the round that just finished (from live_round_history, migration 029/030),
 * so everyone sees who won before the next round starts.
 */
function PreviousRoundSummary({ round, english }: { round: LiveRoundHistoryRow; english: boolean }) {
  const date = new Date(round.finished_at)
  const dateLabel = date.toLocaleDateString(english ? 'en-US' : 'ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  const top = round.players.slice(0, 5)
  return (
    <div className="rounded-3xl border border-gold/40 bg-white/85 p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-navy">🏆 {english ? 'Previous round' : 'الجولة السابقة'}</h3>
        <span className="text-[11px] font-bold text-muted">{dateLabel}</span>
      </div>
      {round.winner_name && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-sm font-black text-gold">
          👑 {english ? 'Winner' : 'الفائز'}: {round.winner_name} · {round.winner_score} {english ? 'pts' : 'نقطة'}
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        {top.map((player, index) => (
          <div
            key={`${round.id}-${index}`}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2',
              index === 0 ? 'border-gold/40 bg-gold/10' : 'border-border-soft bg-white/60',
            )}
          >
            <span className="w-5 shrink-0 text-sm" aria-hidden>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
            <span className="shrink-0 font-display text-base font-black tabular-nums text-gold">{player.score}</span>
          </div>
        ))}
      </div>
      {round.players.length > top.length && (
        <p className="mt-2 text-[11px] font-bold text-muted">
          {english ? `And ${round.players.length - top.length} more…` : `و${round.players.length - top.length} آخرون…`}
        </p>
      )}
    </div>
  )
}

function PlayerList({ players, english, title, compact }: { players: LivePlayerRow[]; english: boolean; title: string; compact?: boolean }) {
  return (
    <div className={cn('rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel', compact && 'p-4')}>
      <h3 className="font-black text-navy">{title}</h3>
      <div className={cn('mt-3 grid gap-2', players.length > 4 ? 'sm:grid-cols-2' : '')}>
        {players.length === 0 && (
          <p className="text-sm text-muted">{english ? 'Waiting for players…' : 'في انتظار اللاعبين…'}</p>
        )}
        {players.map((player) => (
          <div key={player.id} className="flex items-center gap-2.5 rounded-xl border border-border-soft bg-surface-raised/70 px-3 py-2.5">
            <PlayerAvatar player={player} size="sm" />
            <OnlineDot connected={player.connected} />
            <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
            {player.connected ? (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-green">{english ? 'Online' : 'متصل'}</span>
            ) : (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-red/80">{english ? 'Offline' : 'غير متصل'}</span>
            )}
            {player.score !== 0 && (
              <span className={cn('shrink-0 text-xs font-black tabular-nums', player.score > 0 ? 'text-gold' : 'text-red')}>
                {player.score > 0 ? `★ ${player.score}` : player.score}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Host game screen: question on top, live answers + grading below. */
function HostGame({
  room,
  players,
  questions,
  answers,
  remainingSeconds,
  expired,
  myAnswer,
  english,
  onNext,
  onPrevious,
  onFinish,
  onReview,
  onSubmit,
  busy,
}: {
  room: LiveRoomRow
  players: LivePlayerRow[]
  questions: LiveQuestionRow[]
  answers: LiveAnswerRow[]
  remainingSeconds: number | null
  expired: boolean
  myAnswer: LiveAnswerRow | null
  english: boolean
  onNext: () => void
  onPrevious: () => void
  onFinish: () => void
  onReview: (playerId: string, status: 'correct' | 'wrong') => void
  onSubmit: (wager: number, text: string) => void
  busy: boolean
}) {
  const index = room.current_question_index
  const question = questions.find((q) => q.question_index === index)
  const total = questions.length
  const answersForIndex = useMemo(
    () => answers.filter((a) => a.question_index === index),
    [answers, index],
  )
  const answerByPlayer = useMemo(() => {
    const map: Record<string, LiveAnswerRow> = {}
    for (const answer of answersForIndex) map[answer.player_id] = answer
    return map
  }, [answersForIndex])
  const answeredCount = answersForIndex.length
  const summary = useMemo(() => {
    let correct = 0
    let wrong = 0
    let pending = 0
    let points = 0
    for (const answer of answersForIndex) {
      if (answer.status === 'correct') {
        correct += 1
        points += answer.points
      } else if (answer.status === 'wrong') {
        wrong += 1
        points += answer.points
      } else if (answer.status === 'pending') {
        pending += 1
      }
    }
    return { correct, wrong, pending, points, notAnswered: players.length - answersForIndex.length }
  }, [answersForIndex, players.length])
  // Every submitted answer has been graded → show the per-player final summary.
  const allReviewed = summary.pending === 0 && answersForIndex.length > 0

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-4 text-white shadow-panel sm:p-6">
        <div className="pointer-events-none absolute -end-16 -top-20 h-52 w-52 rounded-full bg-teal/20 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black">
            <span className="rounded-full border border-white/25 bg-black/30 px-3 py-1">
              {english ? `Question ${index + 1} / ${total}` : `السؤال ${index + 1} / ${total}`}
            </span>
            <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-gold-bright">
              💎 1–{room.max_wager} {english ? 'pts' : 'نقطة'}
            </span>
            <span className="rounded-full border border-green/40 bg-green/10 px-3 py-1 text-green">
              {answeredCount} / {players.length} {english ? 'answered' : 'أجابوا'}
            </span>
            <QuestionTimer remainingSeconds={remainingSeconds} english={english} />
          </div>
          <h2 className="mt-4 text-center font-display text-xl font-black leading-[1.6] sm:text-2xl">
            {question ? question.question : english ? 'No question' : 'لا يوجد سؤال'}
          </h2>
          {question?.image_url && (
            <img
              src={question.image_url}
              alt={question.question}
              referrerPolicy="no-referrer"
              className="mx-auto mt-3 max-h-48 w-full max-w-xl rounded-2xl border border-white/15 object-cover shadow-lg"
            />
          )}
          {question?.hint && (
            <p className="mx-auto mt-3 max-w-lg rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm font-bold text-gold-bright">
              💡 {question.hint}
            </p>
          )}
        </div>
      </div>

      {/* The host is also a player: pick a value, answer, and get scored. */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">
          🎙 {english ? 'Your answer' : 'إجابتك'}
        </p>
        <AnswerComposer
          room={room}
          myAnswer={myAnswer}
          expired={expired}
          english={english}
          onSubmit={onSubmit}
          busy={busy}
        />
      </div>

      {room.question_phase === 'closed' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm font-black text-gold">
          <span>🔒 {english ? 'Answering is closed — review the answers, then move to the next question.' : 'أُغلق استقبال الإجابات — راجع الإجابات ثم انتقل للسؤال التالي.'}</span>
          <button
            type="button"
            disabled={busy || index + 1 >= total}
            onClick={onNext}
            className="rounded-xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-4 py-2 text-xs font-black text-navy transition hover:brightness-110 disabled:opacity-50"
          >
            {english ? 'Next question' : 'السؤال التالي'} →
          </button>
        </div>
      )}

      {/* Answers to grade */}
      <div className="rounded-3xl border border-border-soft bg-white/80 p-4 shadow-panel sm:p-5">
        <h3 className="font-black text-navy">{english ? 'Player answers' : 'إجابات اللاعبين'}</h3>
        <div className="mt-3 space-y-2.5">
          {players.length === 0 && (
            <p className="text-sm text-muted">{english ? 'No players in the room.' : 'لا يوجد لاعبون في الغرفة.'}</p>
          )}
          {players.map((player) => {
            const answer = answerByPlayer[player.id]
            const state = answer?.status
            return (
              <div key={player.id} className={cn('flex flex-col gap-2 rounded-2xl border p-3 transition sm:flex-row sm:items-center sm:gap-3', state === 'correct' ? 'border-green/50 bg-green/5' : state === 'wrong' ? 'border-red/40 bg-red/5' : 'border-border-soft bg-surface-raised/60')}>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <PlayerAvatar player={player} size="sm" />
                  <OnlineDot connected={player.connected} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-navy">{player.name}</p>
                    <p className="text-[11px] font-bold text-muted">★ {player.score} {english ? 'pts' : 'نقطة'}</p>
                    {/* Live per-player stats — refresh in real time with every review */}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-black tabular-nums">
                      <span className="text-green">✓ {player.correct_count}</span>
                      <span className="text-red">✗ {player.wrong_count}</span>
                      <span className="text-navy">{english ? 'avg' : 'متوسط'}: {player.avg_wager}</span>
                      <span className="text-gold">★ {player.best_win_wager || '—'}</span>
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1 sm:max-w-md">
                  {answer ? (
                    <div className="rounded-xl border border-border-soft bg-white px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gold">
                        {english ? 'Wager' : 'القيمة'}: {answer.wager}
                      </p>
                      <p className="truncate text-sm font-bold text-ink">{answer.answer_text || '—'}</p>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border-strong bg-surface-raised px-3 py-2 text-xs font-bold text-muted">
                      {english ? 'No answer yet' : 'لم يرسل إجابة بعد'}
                    </p>
                  )}
                </div>

                {answer ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn('hidden rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider sm:inline-block', state === 'pending' ? 'bg-gold/15 text-gold' : state === 'correct' ? 'bg-green/15 text-green' : 'bg-red/10 text-red')}>
                      {state === 'pending' ? (english ? 'Pending' : 'بانتظار') : state === 'correct' ? (english ? 'Correct' : 'صحيحة') : (english ? 'Wrong' : 'خاطئة')}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onReview(player.id, 'correct')}
                      className={cn('rounded-lg border px-3 py-1.5 text-xs font-black transition disabled:opacity-50', state === 'correct' ? 'border-green bg-green text-white' : 'border-green/50 bg-green/10 text-green hover:bg-green/25')}
                    >
                      ✓ {english ? 'Right' : 'صح'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onReview(player.id, 'wrong')}
                      className={cn('rounded-lg border px-3 py-1.5 text-xs font-black transition disabled:opacity-50', state === 'wrong' ? 'border-red bg-red text-white' : 'border-red/40 bg-red/10 text-red hover:bg-red/20')}
                    >
                      ✗ {english ? 'Wrong' : 'خطأ'}
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-muted">
                    {english ? 'Awaiting answer' : 'بانتظار الإجابة'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Round summary — live per-question stats for the host */}
      <div className="rounded-3xl border border-border-soft bg-white/80 p-4 shadow-panel sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-black text-navy">{english ? 'Question summary' : 'ملخص السؤال'}</h3>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-black',
              summary.points > 0 ? 'bg-green/15 text-green' : summary.points < 0 ? 'bg-red/10 text-red' : 'bg-white/60 text-muted',
            )}
          >
            {english ? 'Total points' : 'مجموع النقاط'}: {summary.points > 0 ? `+${summary.points}` : summary.points}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-green/40 bg-green/5 px-3 py-2 text-center">
            <p className="text-lg font-black text-green">{summary.correct}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">✓ {english ? 'Correct' : 'صحيحة'}</p>
          </div>
          <div className="rounded-xl border border-red/40 bg-red/5 px-3 py-2 text-center">
            <p className="text-lg font-black text-red">{summary.wrong}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">✗ {english ? 'Wrong' : 'خاطئة'}</p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-gold/5 px-3 py-2 text-center">
            <p className="text-lg font-black text-gold">{summary.pending}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">⏳ {english ? 'Pending review' : 'بانتظار المراجعة'}</p>
          </div>
          <div className="rounded-xl border border-border-soft bg-surface-raised/60 px-3 py-2 text-center">
            <p className="text-lg font-black text-muted">{summary.notAnswered}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">— {english ? "Didn't answer" : 'لم يُجب'}</p>
          </div>
        </div>

        {/* Final per-player summary — appears once every answer is graded */}
        <AnimatePresence initial={false}>
          {allReviewed && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="mt-3 border-t border-border-soft pt-3"
            >
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted">
                🏁 {english ? 'Final results — per player' : 'النتيجة النهائية — لكل لاعب'}
              </p>
              <div className="mt-2 space-y-1.5">
                {players.map((player) => {
                  const answer = answerByPlayer[player.id]
                  const state = answer?.status
                  const points = answer && (state === 'correct' || state === 'wrong') ? answer.points : 0
                  return (
                    <div key={player.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-soft bg-white/60 px-3 py-2">
                      <PlayerAvatar player={player} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black tabular-nums text-muted">
                        {english ? 'Wager' : 'رهان'}: {answer ? answer.wager : '—'}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black',
                          state === 'correct' ? 'bg-green/15 text-green' : state === 'wrong' ? 'bg-red/10 text-red' : 'bg-surface-raised text-muted',
                        )}
                      >
                        {state === 'correct'
                          ? (english ? '✓ Correct' : '✓ صحيحة')
                          : state === 'wrong'
                            ? (english ? '✗ Wrong' : '✗ خاطئة')
                            : (english ? 'Did not answer' : 'لم يُجب')}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-display text-sm font-black tabular-nums',
                          points > 0 ? 'text-green' : points < 0 ? 'text-red' : 'text-muted',
                        )}
                      >
                        {points > 0 ? `+${points}` : points}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onPrevious} disabled={busy || index <= 0} className="rounded-xl border border-border-strong bg-white px-4 py-3 text-sm font-black text-muted transition hover:border-navy hover:text-navy disabled:opacity-40">
          ← {english ? 'Previous' : 'السابق'}
        </button>
        <button type="button" onClick={onNext} disabled={busy || index + 1 >= total} className="rounded-xl border border-border-strong bg-white px-4 py-3 text-sm font-black text-navy transition hover:border-navy hover:bg-navy hover:text-white disabled:opacity-40">
          {english ? 'Next question' : 'السؤال التالي'} →
        </button>
        <button type="button" onClick={onFinish} disabled={busy} className="rounded-xl border border-red/40 bg-red/10 px-5 py-3 text-sm font-black text-red transition hover:bg-red/20">
          🏁 {english ? 'End game' : 'إنهاء اللعبة'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeaderboardPanel players={players} english={english} totalQuestions={total} />
        <CumulativeSummary players={players} english={english} />
      </div>
    </div>
  )
}

/**
 * Accuracy badge shown next to the wager bar value — derived from where the
 * player's choice sits in the wager range (bottom third = دقيقة, middle =
 * متوسطة, top third = واثق). Updates live as the player moves the slider.
 */
function WagerLevelBadge({ wager, min, max, english }: { wager: number | null; min: number; max: number; english: boolean }) {
  if (wager === null) return null
  const span = max - min
  const ratio = span > 0 ? (wager - min) / span : 0.5
  const level = ratio < 1 / 3 ? 'precise' : ratio > 2 / 3 ? 'confident' : 'moderate'
  const config =
    level === 'precise'
      ? { label: english ? 'Precise' : 'دقيقة', icon: '🎯', cls: 'border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]' }
      : level === 'confident'
        ? { label: english ? 'Confident' : 'واثق', icon: '💪', cls: 'border-green/40 bg-green/10 text-green' }
        : { label: english ? 'Moderate' : 'متوسطة', icon: '⚖️', cls: 'border-gold/40 bg-gold/10 text-gold' }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black', config.cls)}>
      <span aria-hidden className="text-[9px] leading-none">{config.icon}</span>
      {config.label}
    </span>
  )
}

/**
 * Shared answer composer: wager picker (every value 1..max, where max =
 * the question count) + answer input. Used by players AND the host — the
 * host is also a player, so they pick their own value and submit their own
 * answer like everyone else.
 */
function AnswerComposer({
  room,
  myAnswer,
  expired,
  english,
  onSubmit,
  busy,
}: {
  room: LiveRoomRow
  myAnswer: LiveAnswerRow | null
  expired: boolean
  english: boolean
  onSubmit: (wager: number, text: string) => void
  busy: boolean
}) {
  const index = room.current_question_index
  const [wager, setWager] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const submitted = Boolean(myAnswer)
  const reviewed = myAnswer?.reviewed_by_host ?? false
  const lockedWager = myAnswer?.wager ?? wager

  // Gold fill on the slider track — follows the chosen value (RTL-aware).
  const fillPercent = room.max_wager > room.min_wager
    ? Math.round(((wager ?? room.min_wager) - room.min_wager) / (room.max_wager - room.min_wager) * 100)
    : 100

  // Each new question starts a fresh wager + answer (the index is shared).
  useEffect(() => {
    setWager(null)
    setDraft('')
  }, [index])

  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel sm:p-6">
      <AnimatePresence mode="wait">
        {expired && !submitted ? (
          <motion.div key="expired" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-4 text-center">
            <span className="text-4xl" aria-hidden>⏰</span>
            <p className="mt-2 text-lg font-black text-red">{english ? "Time's up for this question" : 'انتهى وقت السؤال'}</p>
            <p className="mt-1 text-sm font-bold text-muted">
              {room.question_phase === 'closed'
                ? english ? 'Answering is closed — waiting for the host to review.' : 'أُغلق استقبال الإجابات — بانتظار مراجعة المضيف.'
                : english ? 'Waiting for the host…' : 'بانتظار المضيف…'}
            </p>
          </motion.div>
        ) : reviewed ? (
          <motion.div key="reviewed" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="py-4 text-center">
            {myAnswer?.status === 'correct' ? (
              <>
                <span className="text-4xl" aria-hidden>🎉</span>
                <p className="mt-2 text-xl font-black text-green">{english ? 'Correct answer!' : 'إجابة صحيحة!'}</p>
                <p className="mt-1 text-sm font-bold text-muted">
                  {english ? `You earned +${myAnswer?.points ?? 0} points` : `ربحت +${myAnswer?.points ?? 0} نقطة`}
                </p>
              </>
            ) : (
              <>
                <span className="text-4xl" aria-hidden>❌</span>
                <p className="mt-2 text-xl font-black text-red">{english ? 'Wrong answer' : 'إجابة خاطئة'}</p>
                <p className="mt-1 text-sm font-bold text-muted">
                  {myAnswer && myAnswer.points < 0
                    ? english ? `You lost ${Math.abs(myAnswer.points)} points` : `خسرت ${Math.abs(myAnswer.points)} نقطة`
                    : english ? 'No points this time.' : 'لا نقاط هذه المرة.'}
                </p>
              </>
            )}
          </motion.div>
        ) : submitted ? (
          <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-4 text-center">
            <span className="text-4xl" aria-hidden>✅</span>
            <p className="mt-2 text-lg font-black text-green">{english ? 'Answer sent' : 'تم إرسال الإجابة ✓'}</p>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-gold">
              <span>{english ? `Wager: ${lockedWager} points` : `النقاط المختارة: ${lockedWager}`}</span>
              <WagerLevelBadge wager={lockedWager} min={room.min_wager} max={room.max_wager} english={english} />
            </p>
            <p className="mt-1 text-sm font-bold text-muted">{english ? 'Waiting for the host to review…' : 'في انتظار مراجعة المضيف…'}</p>
            <p className="mt-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-2.5 text-sm font-bold text-navy">
              {myAnswer?.answer_text}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Wager picker — slider from 1 to max (max = question count) */}
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
                {english ? 'Choose the value of your answer' : 'اختر قيمة إجابتك'}
              </p>
              <p className="mt-1 text-[11px] font-bold text-muted/80">
                {english ? `1 to ${room.max_wager} points — your choice, per question` : `من 1 إلى ${room.max_wager} نقطة — اختيارك لكل سؤال`}
              </p>

              {/* Selected value (locked once the answer is sent) + accuracy badge */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span
                  className={cn(
                    'rounded-2xl border px-7 py-2 font-display text-3xl font-black tabular-nums transition-all duration-200',
                    wager === null
                      ? 'border-border-strong bg-surface-raised text-muted'
                      : 'border-gold/60 bg-gold text-navy shadow-[0_10px_24px_rgba(201,162,39,0.35)]',
                  )}
                >
                  {wager ?? '—'}
                </span>
                <span className="text-sm font-black text-muted">{english ? 'pts' : 'نقطة'}</span>
                <WagerLevelBadge wager={wager} min={room.min_wager} max={room.max_wager} english={english} />
              </div>

              <div dir={english ? 'ltr' : 'rtl'} className="mx-auto mt-5 max-w-md px-2">
                <input
                  type="range"
                  min={room.min_wager}
                  max={room.max_wager}
                  step={1}
                  value={wager ?? room.min_wager}
                  onChange={(event) => setWager(Number(event.target.value))}
                  aria-label={english ? 'Wager value' : 'قيمة الرهان'}
                  className="fahloy-range w-full"
                  style={{ '--fill': `${fillPercent}%` } as CSSProperties}
                />
                <div className="mt-1.5 flex justify-between text-[11px] font-black tabular-nums text-muted/70">
                  <span>{room.min_wager}</span>
                  <span>{room.max_wager}</span>
                </div>
              </div>

              <p className="mt-2 text-sm font-black text-gold">
                {wager === null
                  ? english ? 'Move the slider to pick your value' : 'حرّك المؤشر لاختيار قيمتك'
                  : `${english ? 'Your wager' : 'قيمة السؤال'}: ${wager} ${english ? 'points' : 'نقطة'}`}
              </p>
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (wager !== null && draft.trim()) onSubmit(wager, draft.trim())
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 300))}
                placeholder={english ? 'Type your answer…' : 'اكتب إجابتك…'}
                disabled={wager === null}
                className="w-full rounded-2xl border border-border-strong bg-white px-4 py-4 text-center text-base font-bold text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:bg-surface-raised disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || wager === null || !draft.trim()}
                className="w-full rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-6 py-3.5 text-sm font-black text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)] transition hover:brightness-110 active:translate-y-px disabled:opacity-50"
              >
                {english ? 'Send answer' : 'إرسال الإجابة'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Player screen: current question + answer input (submitted state preserved). */
function PlayerGame({
  room,
  players,
  questions,
  myAnswer,
  remainingSeconds,
  expired,
  english,
  onSubmit,
  busy,
}: {
  room: LiveRoomRow
  players: LivePlayerRow[]
  questions: LiveQuestionRow[]
  myAnswer: LiveAnswerRow | null
  remainingSeconds: number | null
  expired: boolean
  english: boolean
  onSubmit: (wager: number, text: string) => void
  busy: boolean
}) {
  const index = room.current_question_index
  const question = questions.find((q) => q.question_index === index)
  const total = questions.length

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-5 text-white shadow-panel sm:p-7">
        <div className="pointer-events-none absolute -end-16 -top-20 h-52 w-52 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between gap-2 text-xs font-black">
            <span className="rounded-full border border-white/25 bg-black/30 px-3 py-1">
              {english ? `Question ${index + 1} / ${total}` : `السؤال ${index + 1} / ${total}`}
            </span>
            <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-gold-bright">
              💎 1–{room.max_wager} {english ? 'pts' : 'نقطة'}
            </span>
            <QuestionTimer remainingSeconds={remainingSeconds} english={english} />
          </div>
          <h2 className="mt-4 text-center font-display text-2xl font-black leading-[1.6] sm:text-3xl">
            {question ? question.question : english ? 'No question' : 'لا يوجد سؤال'}
          </h2>
          {question?.image_url && (
            <img
              src={question.image_url}
              alt={question.question}
              referrerPolicy="no-referrer"
              className="mx-auto mt-3 max-h-52 w-full max-w-xl rounded-2xl border border-white/15 object-cover shadow-lg"
            />
          )}
        </div>
      </div>

      <AnswerComposer
        room={room}
        myAnswer={myAnswer}
        expired={expired}
        english={english}
        onSubmit={onSubmit}
        busy={busy}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <LeaderboardPanel players={players} english={english} totalQuestions={total} />
        <CumulativeSummary players={players} english={english} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completed-round history modal (migration 029)
// ---------------------------------------------------------------------------

/**
 * 📜 سجل الجولات — lists finished rounds of the pack. Each round expands to
 * show its final standings snapshot (same data as the results screen).
 */
function RoundHistoryModal({
  open,
  loading,
  rounds,
  packTitle,
  english,
  onClose,
}: {
  open: boolean
  loading: boolean
  rounds: LiveRoundHistoryRow[]
  packTitle: string
  english: boolean
  onClose: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          dir={english ? 'ltr' : 'rtl'}
        >
          {/* Backdrop — click to close */}
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={english ? 'Round history' : 'سجل الجولات'}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border-soft bg-white shadow-raised"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border-soft bg-white/70 px-5 py-4">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-display text-lg font-black text-navy">
                  📜 {english ? 'Round history' : 'سجل الجولات'}
                </h3>
                <p className="mt-0.5 truncate text-xs font-bold text-muted">{packTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={english ? 'Close' : 'إغلاق'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-white text-navy transition hover:bg-navy hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {loading ? (
                <p className="py-8 text-center text-sm font-bold text-muted">{english ? 'Loading…' : 'جارٍ التحميل…'}</p>
              ) : rounds.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-muted">
                  {english ? 'No completed rounds yet.' : 'لا توجد جولات مكتملة بعد.'}
                </p>
              ) : (
                rounds.map((round) => {
                  const expanded = expandedId === round.id
                  const date = new Date(round.finished_at)
                  const dateLabel = date.toLocaleDateString(english ? 'en-US' : 'ar-EG', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  return (
                    <div key={round.id} className="overflow-hidden rounded-2xl border border-border-soft bg-white/70">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-xs font-black text-navy">
                            🏁 {dateLabel}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-bold text-muted">
                            🎙️ {round.host_name} · {round.question_count} {english ? 'questions' : 'أسئلة'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {round.winner_name && (
                            <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-black text-gold">
                              🏆 {round.winner_name} · {round.winner_score}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : round.id)}
                            aria-expanded={expanded}
                            className="rounded-lg border border-border-soft bg-white px-2.5 py-1 text-[11px] font-black text-navy transition hover:border-gold/50 hover:text-gold"
                          >
                            {expanded ? (english ? 'Hide' : 'إخفاء') : (english ? 'Results' : 'النتائج')}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1.5 border-t border-border-soft bg-white/40 px-4 py-3">
                              {round.players.length === 0 ? (
                                <p className="text-xs font-bold text-muted">{english ? 'No players.' : 'لا يوجد لاعبون.'}</p>
                              ) : (
                                round.players.map((player, index) => (
                                  <div
                                    key={`${round.id}-${index}`}
                                    className={cn(
                                      'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2',
                                      index === 0 ? 'border-gold/40 bg-gold/10' : 'border-border-soft bg-white/60',
                                    )}
                                  >
                                    <span className="w-5 shrink-0 text-xs" aria-hidden>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-black text-navy">{player.name}</span>
                                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black tabular-nums text-muted">
                                      ✓ {player.correct_count} · ✗ {player.wrong_count}
                                    </span>
                                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black tabular-nums text-muted">
                                      {english ? 'avg' : 'متوسط'}: {player.avg_wager}
                                    </span>
                                    <span className="shrink-0 font-display text-base font-black tabular-nums text-gold">{player.score}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Main page
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
  const [previousLoading, setPreviousLoading] = useState(false)

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === user?.id) ?? null,
    [players, user?.id],
  )
  const isHost = Boolean(room && user && room.host_auth_id === user.id)

  // Initial load.
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
        if (!roomRow) {
          setError(english ? 'Room not found.' : 'الغرفة غير موجودة.')
          return
        }
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
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // Realtime subscription.
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

  // Heartbeat (presence) — everyone keeps their own row alive AND runs the
  // sweep. The sweep is what detects a dead host and auto-promotes the most
  // active player, so it must come from every client (not only the host).
  useEffect(() => {
    if (!roomId || !user) return
    const beat = () => {
      void markLiveConnected(roomId)
      void sweepLiveStale(roomId)
    }
    beat()
    const interval = window.setInterval(beat, HEARTBEAT_MS)
    return () => window.clearInterval(interval)
  }, [roomId, user])

  // Detect a disconnected host so players can take over.
  useEffect(() => {
    if (!room || !room.host_player_id) return
    const hostRow = players.find((player) => player.id === room.host_player_id)
    setHostGone(Boolean(hostRow && !hostRow.connected))
  }, [room, players])

  // Welcome the player who was just auto-promoted (host changed to them). The
  // previous host is remembered in sessionStorage so the transition is detected
  // even if the page remounts mid-game, and so it never re-fires after a reload.
  const storageKey = `live-host:${roomId ?? ''}`
  const [prevHost, setPrevHost] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey)
      return stored && stored !== 'null' ? stored : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (!room) return
    if (prevHost !== null && prevHost !== room.host_auth_id && room.host_auth_id === user?.id) {
      setPromoted(true)
    }
    setPrevHost(room.host_auth_id)
    try {
      sessionStorage.setItem(storageKey, room.host_auth_id)
    } catch {
      /* sessionStorage unavailable — the state still tracks in-memory */
    }
  }, [room?.host_auth_id, user?.id, english, storageKey, prevHost])

  const act = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Something went wrong.' : 'حدث خطأ ما.'))
    } finally {
      setBusy(false)
    }
  }, [english])

  const { remainingSeconds, expired } = useQuestionCountdown(room)

  const handleUpdateSettings: (settings: {
    questionCount?: number
    questionTimeSeconds?: number
    minWager?: number
    maxWager?: number
    deductOnWrong?: boolean
    maxPlayers?: number
  }) => void = (settings) => {
    if (!room) return
    void act(() => updateLiveRoomSettings(room.id, settings))
  }

  // When the shared countdown hits zero, flip the room's question_phase to
  // 'closed' (ANSWERING_CLOSED) so every client sees the same state. The RPC
  // is idempotent and the server deadline remains the real gate for answers.
  useEffect(() => {
    if (!room || room.status !== 'playing' || room.question_phase !== 'active') return
    if (!expired) return
    void closeLiveQuestion(room.id)
  }, [room?.id, room?.status, room?.question_phase, expired])

  const handleStart = async () => {
    if (!room) return
    setStarting(true)
    setNotice(null)
    try {
      const pack = await getPack(room.pack_id)
      if (!pack) throw new Error(english ? 'Could not load the pack.' : 'تعذر تحميل الباقة.')
      // The host's question-count choice caps the SAME ordered list for everyone.
      const resolved = await resolveLivePackQuestions(pack, room.question_count)
      if (resolved.length === 0) throw new Error(english ? 'This pack has no playable questions.' : 'لا توجد أسئلة قابلة للعب في هذه الباقة.')
      await startLiveGame(room.id, resolved)
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Could not start the game.' : 'تعذر بدء اللعبة.'))
    } finally {
      setStarting(false)
    }
  }

  const handleDelete = async () => {
    if (!room) return
    const confirmed = window.confirm(english ? 'Delete this room? All players will be kicked.' : 'حذف الغرفة؟ سيتم إخراج جميع اللاعبين.')
    if (!confirmed) return
    await act(async () => {
      await deleteLiveRoom(room.id)
      navigate('/packs', { replace: true })
    })
  }

  const handleReview = (playerId: string, status: 'correct' | 'wrong') => {
    if (!room) return
    void act(() => reviewLiveAnswer(room.id, playerId, room.current_question_index, status))
  }

  const handleNext = () => {
    if (!room) return
    void act(() => nextLiveQuestion(room.id))
  }

  const handlePrevious = () => {
    if (!room) return
    void act(() => previousLiveQuestion(room.id))
  }

  const handleFinish = async () => {
    if (!room) return
    const confirmed = window.confirm(english ? 'End the game and show results?' : 'إنهاء اللعبة وعرض النتائج؟')
    if (!confirmed) return
    await act(() => finishLiveGame(room.id))
  }

  const handleSubmitAnswer = (wager: number, text: string) => {
    if (!room) return
    void act(() => submitLiveAnswer(room.id, room.current_question_index, text, wager))
  }

  const openHistory = useCallback(async () => {
    if (!room) return
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const rows = await getLiveRoundHistory(room.pack_id)
      setHistory(rows)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [room])

  // In a replay lobby: load the previous round's final ranking (who won).
  useEffect(() => {
    let cancelled = false
    const previousRoomId = room?.previous_room_id
    if (!room || room.status !== 'lobby' || !previousRoomId) {
      setPreviousRound(null)
      setPreviousLoading(false)
      return
    }
    setPreviousLoading(true)
    void getLiveRoundHistoryByRoom(previousRoomId)
      .then((row) => {
        if (!cancelled) setPreviousRound(row)
      })
      .catch(() => {
        if (!cancelled) setPreviousRound(null)
      })
      .finally(() => {
        if (!cancelled) setPreviousLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [room?.id, room?.status, room?.previous_room_id])

  const handlePlayAgain = async () => {
    if (!room) return
    setStarting(true)
    setNotice(null)
    try {
      const newRoomId = await createLiveRoom(room.pack_id, {
        questionCount: room.question_count,
        questionTimeSeconds: room.question_timeout_seconds,
        minWager: room.min_wager,
        maxWager: room.max_wager,
        deductOnWrong: room.deduct_on_wrong,
        maxPlayers: room.max_players,
      }, room.id)
      // Auto-copy the group rejoin link (?code=NEW&prev=OLD) so the host can
      // paste it in chat — players rejoin with one click and their old names.
      const newRoom = await getLiveRoom(newRoomId)
      if (newRoom) {
        await copyLiveInvite(newRoom.room_code, room.id)
      }
      navigate(`/packs/live/${newRoomId}`, { replace: true })
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : (english ? 'Could not create a new game.' : 'تعذر إنشاء جولة جديدة.'))
      setStarting(false)
    }
  }

  const handleTakeOverHost = () => {
    if (!room || !myPlayer) return
    void act(() => transferLiveHost(room.id, myPlayer.id))
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-48 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
        <div className="h-40 animate-pulse rounded-3xl border border-border-soft bg-surface-raised" />
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-red/40 bg-red/10 px-6 py-10 text-center">
        <span className="text-4xl" aria-hidden>📭</span>
        <h1 className="mt-3 text-xl font-black text-red">{english ? 'Room unavailable' : 'الغرفة غير متاحة'}</h1>
        <p className="mt-2 text-sm text-muted">{error ?? ''}</p>
        <Link to="/packs" className="btn btn-ghost mt-5 rounded-xl px-4 py-2 text-sm font-black">
          {english ? 'Back to Packs' : 'العودة إلى الباقات'}
        </Link>
      </div>
    )
  }

  const myAnswer = myPlayer ? answers.find((answer) => answer.player_id === myPlayer.id && answer.question_index === room.current_question_index) ?? null : null

  return (
    <div dir={english ? 'ltr' : 'rtl'} className="mx-auto w-full max-w-3xl space-y-4">
      {/* Connection + host-status strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-soft bg-white/70 px-4 py-2.5 text-xs font-black">
        <span className="flex items-center gap-2 text-muted">
          <span className={cn('h-2 w-2 rounded-full', connection === 'SUBSCRIBED' ? 'bg-green' : connection === 'CHANNEL_ERROR' ? 'bg-red' : 'bg-gold')} aria-hidden />
          {connection === 'SUBSCRIBED'
            ? english ? 'Live' : 'مباشر'
            : connection === 'CHANNEL_ERROR'
              ? english ? 'Reconnecting…' : 'إعادة الاتصال…'
              : english ? 'Connecting…' : 'جارٍ الاتصال…'}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              players.some((p) => p.id === room.host_player_id && p.connected) ? 'bg-green' : 'bg-red',
            )}
            aria-hidden
          />
          🎙 {room.host_name}
        </span>
        {room.status === 'playing' && (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-0.5 text-gold">
            {english ? `Question ${room.current_question_index + 1}` : `السؤال ${room.current_question_index + 1}`}
          </span>
        )}
      </div>

      {hostGone && !isHost && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm font-bold text-red">
          <span>⚠ {english ? 'The host disconnected. Hosting will transfer automatically to the most active player.' : 'المضيف غير متصل. سيُنقل دور المضيف تلقائيًا لأكثر لاعب نشاطًا.'}</span>
          <button type="button" onClick={handleTakeOverHost} disabled={busy} className="rounded-xl border border-red/50 bg-white px-4 py-2 text-xs font-black text-red transition hover:bg-red hover:text-white disabled:opacity-50">
            {english ? 'Become host now' : 'تولَّ المضيف الآن'}
          </button>
        </div>
      )}

      {promoted && isHost && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold/60 bg-gold/15 px-4 py-3 text-sm font-black text-gold">
          <span>🎙️ {english ? 'You are now the host — hosting was transferred to you automatically.' : 'أنت الآن المضيف — نُقلت إدارة الغرفة إليك تلقائيًا.'}</span>
          <button type="button" onClick={() => setPromoted(false)} className="rounded-lg px-2 py-1 text-xs text-gold/70 transition hover:bg-gold/20 hover:text-gold">✕</button>
        </div>
      )}

      {/* Previous round summary — shown in a replay lobby so everyone sees who won */}
      {room?.status === 'lobby' && (
        previousLoading ? (
          <div className="rounded-3xl border border-gold/40 bg-white/85 p-5 text-center text-sm font-bold text-muted shadow-panel">
            {english ? 'Loading previous round…' : 'جارٍ تحميل الجولة السابقة…'}
          </div>
        ) : previousRound ? (
          <PreviousRoundSummary round={previousRound} english={english} />
        ) : null
      )}

      {isHost ? (
        <>
          {room.status === 'lobby' && (
            <HostLobby
              room={room}
              players={players}
              english={english}
              onStart={() => void handleStart()}
              onDelete={() => void handleDelete()}
              onUpdateSettings={handleUpdateSettings}
              starting={starting}
            />
          )}
          {room.status === 'playing' && (
            <HostGame
              room={room}
              players={players}
              questions={questions}
              answers={answers}
              remainingSeconds={remainingSeconds}
              expired={expired}
              myAnswer={myAnswer}
              english={english}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onFinish={() => void handleFinish()}
              onReview={handleReview}
              onSubmit={handleSubmitAnswer}
              busy={busy}
            />
          )}
          {room.status === 'finished' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-center text-white shadow-panel sm:p-8">
                <span className="text-4xl" aria-hidden>🏁</span>
                <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">{english ? 'Game finished' : 'انتهت اللعبة'}</h2>
                <p className="mt-1 text-sm text-white/70">{english ? 'Final results' : 'النتائج النهائية'}</p>
              </div>
              <Leaderboard players={players} english={english} totalQuestions={room.question_count} />
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handlePlayAgain()}
                  disabled={starting}
                  className="rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-6 py-3 text-sm font-black text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)] transition hover:brightness-110 active:translate-y-px disabled:opacity-60"
                >
                  {starting ? (english ? 'Creating…' : 'جارٍ الإنشاء…') : `🔄 ${english ? 'Play again' : 'العب مرة أخرى'}`}
                </button>
                <button
                  type="button"
                  onClick={() => void openHistory()}
                  className="rounded-xl border border-navy/20 bg-white px-6 py-3 text-sm font-black text-navy transition hover:border-gold/60 hover:text-gold"
                >
                  📜 {english ? 'Round history' : 'سجل الجولات'}
                </button>
                <Link to={`/packs/${room.pack_id}`} className="btn btn-ghost rounded-xl px-6 py-3 text-sm font-black">
                  {english ? 'Back to pack' : 'العودة إلى الباقة'}
                </Link>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {room.status === 'lobby' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-center text-white shadow-panel sm:p-8">
                <span className="text-4xl" aria-hidden>🕹️</span>
                <h2 className="mt-2 font-display text-2xl font-black">{room.pack_title}</h2>
                <p className="mt-1 text-sm text-white/70">
                  {english ? `Hosted by ${room.host_name}` : `المضيف: ${room.host_name}`}
                </p>
                <p className="mx-auto mt-4 max-w-md rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-black text-gold-bright">
                  {english ? 'Waiting for the host to start the game…' : 'في انتظار بدء اللعبة من المضيف…'}
                </p>
              </div>
              <PlayerList players={players} english={english} title={english ? 'Players in the lobby' : 'اللاعبون في اللوبي'} />
            </div>
          )}
          {room.status === 'playing' && (
            <PlayerGame
              room={room}
              players={players}
              questions={questions}
              myAnswer={myAnswer}
              remainingSeconds={remainingSeconds}
              expired={expired}
              english={english}
              onSubmit={handleSubmitAnswer}
              busy={busy}
            />
          )}
          {room.status === 'finished' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl border border-navy-3/30 bg-gradient-to-br from-navy via-navy-2 to-navy-3 p-6 text-center text-white shadow-panel sm:p-8">
                <span className="text-4xl" aria-hidden>🏆</span>
                <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">{english ? 'Results' : 'النتائج'}</h2>
              </div>
              <Leaderboard players={players} english={english} totalQuestions={room.question_count} />
              {myPlayer && (
                <p className="text-center text-sm font-bold text-muted">
                  {english ? `Your score: ${myPlayer.score} points` : `نقاطك: ${myPlayer.score}`}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handlePlayAgain()}
                  disabled={starting}
                  className="rounded-2xl bg-gradient-to-b from-[#C9A227] to-[#A8861D] px-6 py-3 text-sm font-black text-navy shadow-[0_14px_30px_rgba(201,162,39,0.35)] transition hover:brightness-110 active:translate-y-px disabled:opacity-60"
                >
                  {starting ? (english ? 'Creating…' : 'جارٍ الإنشاء…') : `🔄 ${english ? 'Play again' : 'العب مرة أخرى'}`}
                </button>
                <button
                  type="button"
                  onClick={() => void openHistory()}
                  className="rounded-xl border border-navy/20 bg-white px-6 py-3 text-sm font-black text-navy transition hover:border-gold/60 hover:text-gold"
                >
                  📜 {english ? 'Round history' : 'سجل الجولات'}
                </button>
                <Link to={`/packs/${room.pack_id}`} className="btn btn-ghost rounded-xl px-6 py-3 text-sm font-black">
                  {english ? 'Back to pack' : 'العودة إلى الباقة'}
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-5 start-1/2 z-[80] -translate-x-1/2 rounded-2xl border border-red/40 bg-white px-5 py-3 text-sm font-bold text-red shadow-raised"
            dir={english ? 'ltr' : 'rtl'}
          >
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="ms-3 text-red/60 hover:text-red">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completed-round history — host and players can reopen earlier results. */}
      <RoundHistoryModal
        open={historyOpen}
        loading={historyLoading}
        rounds={history}
        packTitle={room?.pack_title ?? ''}
        english={english}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  )
}
