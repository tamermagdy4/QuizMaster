import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { LiveAnswerRow, LivePlayerRow, LiveQuestionRow, LiveRoomRow, GamePhase } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { PlayerAvatar, OnlineDot, QuestionTimer } from './shared'
import { AnswerComposer } from './AnswerComposer'
import { LeaderboardPanel } from './Leaderboard'

/**
 * HostGameView — the host's game screen.
 *
 * Phases:
 *   question_intro → "Question N" (3s intro)
 *   active         → timer running, host answers like a player, sees submitted status
 *   host_review    → ALL answers revealed, host overrides auto-grade, confirms
 *   scoring        → leaderboard shown, scores finalized
 *   finished       → handled by GameResults
 *
 * CRITICAL: During 'active', the host has an answer input just like a player.
 * The host ONLY gets grading controls during 'host_review'.
 */
export function HostGameView({
  room,
  players,
  questions,
  answers,
  remainingSeconds,
  expired,
  myAnswer,
  english,
  gamePhase,
  onOverrideGrade,
  onConfirmScoring,
  onSubmit,
  onPause,
  onResume,
  onSkip,
  onFinish,
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
  gamePhase: GamePhase
  onOverrideGrade: (playerId: string, status: 'correct' | 'wrong') => void
  onConfirmScoring: () => void
  onSubmit: (wager: number, text: string) => void
  onPause: () => void
  onResume: () => void
  onSkip: () => void
  onFinish: () => void
  busy: boolean
}) {
  const index = room.current_question_index
  const question = questions.find((q) => q.question_index === index)
  const total = questions.length
  const answersForIndex = useMemo(() => answers.filter((a) => a.question_index === index), [answers, index])
  const answerByPlayer = useMemo(() => {
    const map: Record<string, LiveAnswerRow> = {}
    for (const answer of answersForIndex) map[answer.player_id] = answer
    return map
  }, [answersForIndex])
  const answeredCount = answersForIndex.length
  const summary = useMemo(() => {
    let correct = 0, wrong = 0, pending = 0, points = 0
    for (const answer of answersForIndex) {
      if (answer.status === 'correct') { correct++; points += answer.points }
      else if (answer.status === 'wrong') { wrong++; points += answer.points }
      else if (answer.status === 'pending') { pending++ }
    }
    return { correct, wrong, pending, points, notAnswered: players.length - answersForIndex.length }
  }, [answersForIndex, players.length])

  // ═══ QUESTION INTRO ═══
  if (gamePhase === 'question_intro') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center rounded-[2rem] bg-gradient-to-br from-navy via-navy-2 to-[#0c2a3a] px-8 py-20 text-center text-white shadow-[0_30px_80px_rgba(6,15,23,0.35)]">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="text-6xl mb-6">❓</motion.span>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-gold-bright mb-3">
          {english ? 'Question' : 'السؤال'}
        </p>
        <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="font-display text-6xl font-black text-gold-bright">{index + 1}</motion.h1>
        <p className="mt-3 text-sm text-white/50">of {total}</p>
      </motion.div>
    )
  }

  // ═══ HOST REVIEW — ALL answers visible, host overrides auto-grade, then confirms ═══
  if (gamePhase === 'host_review') {
    return (
      <div className="space-y-5">
        {/* Question */}
        <QuestionCard question={question} index={index} total={total} room={room} answeredCount={answeredCount} playerCount={players.length} english={english} remainingSeconds={remainingSeconds} />

        {/* Correct answer shown */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border-2 border-green/50 bg-green/5 p-5 text-center">
          <p className="text-sm font-black uppercase tracking-wider text-green mb-2">{english ? 'Correct Answer' : 'الإجابة الصحيحة'}</p>
          <p className="font-display text-2xl font-black text-green">{question?.answer}</p>
        </motion.div>

        {/* ALL answers with override controls (including host's own) */}
        <AnswerReviewList players={players} answerByPlayer={answerByPlayer}
          onOverrideGrade={onOverrideGrade} english={english} busy={busy} />

        {/* Summary + Confirm button */}
        <div className="rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm font-black">
              <span className="text-green">✓ {summary.correct}</span>
              <span className="text-red">✗ {summary.wrong}</span>
              <span className="text-muted">★ {summary.points} {english ? 'pts' : 'نقطة'}</span>
            </div>
            <button type="button" onClick={onConfirmScoring} disabled={busy}
              className="btn btn-gold rounded-xl px-6 py-3 text-sm font-black disabled:opacity-50">
              ✓ {english ? 'Confirm Scores' : 'تأكيد النقاط'}
            </button>
          </div>
        </div>

        {/* Host controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={onPause} disabled={busy}
            className="rounded-xl border-2 border-border-strong bg-white px-5 py-3 text-sm font-black text-muted transition hover:border-navy hover:text-navy disabled:opacity-30">
            ⏸ {english ? 'Pause' : 'إيقاف'}
          </button>
          <button type="button" onClick={onSkip} disabled={busy}
            className="rounded-xl border-2 border-border-strong bg-white px-5 py-3 text-sm font-black text-navy transition hover:border-navy hover:bg-navy hover:text-white disabled:opacity-30">
            ⏭ {english ? 'Skip' : 'تخطي'}
          </button>
          <button type="button" onClick={onFinish} disabled={busy}
            className="rounded-xl border-2 border-red/30 bg-red/5 px-5 py-3 text-sm font-black text-red transition hover:bg-red/10">
            🏁 {english ? 'End' : 'إنهاء'}
          </button>
        </div>
      </div>
    )
  }

  // ═══ SCORING — Show leaderboard (scores are now final) ═══
  if (gamePhase === 'scoring') {
    return (
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border-2 border-gold/50 bg-gold/10 p-6 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-sm font-black uppercase tracking-wider text-gold mb-2">{english ? 'Scores Updated' : 'تم تحديث النقاط'}</p>
          <p className="text-lg font-black text-navy">
            {summary.correct} {english ? 'correct' : 'صحيحة'}
            <span className="mx-2 text-muted">·</span>
            {summary.wrong} {english ? 'wrong' : 'خاطئة'}
          </p>
        </motion.div>
        <LeaderboardPanel players={players} english={english} totalQuestions={total} />
      </div>
    )
  }

  // ═══ ACTIVE — Host answers like a player (no grading controls!) ═══
  return (
    <div className="space-y-5">
      {/* Question */}
      <QuestionCard question={question} index={index} total={total} room={room} answeredCount={answeredCount} playerCount={players.length} english={english} remainingSeconds={remainingSeconds} />

      {/* Host's own answer — SAME as a player */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-muted">🎙 {english ? 'Your answer' : 'إجابتك'}</p>
        <AnswerComposer room={room} myAnswer={myAnswer} expired={expired} english={english} onSubmit={onSubmit} busy={busy} />
      </div>

      {/* Live answers from players — only shows submitted/awaiting status, NO answer text */}
      <AnswerListLive players={players} answerByPlayer={answerByPlayer} english={english} />        {/* Host controls — minimal, no grading buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {gamePhase === 'locked' ? (
          <button type="button" onClick={onResume} disabled={busy}
            className="rounded-xl border-2 border-green/50 bg-green/10 px-5 py-3 text-sm font-black text-green transition hover:bg-green/20 disabled:opacity-30">
            ▶ {english ? 'Resume' : 'استئناف'}
          </button>
        ) : (
          <button type="button" onClick={onPause} disabled={busy}
            className="rounded-xl border-2 border-border-strong bg-white px-5 py-3 text-sm font-black text-muted transition hover:border-navy hover:text-navy disabled:opacity-30">
            ⏸ {english ? 'Pause' : 'إيقاف'}
          </button>
        )}
        <button type="button" onClick={onSkip} disabled={busy}
          className="rounded-xl border-2 border-border-strong bg-white px-5 py-3 text-sm font-black text-navy transition hover:border-navy hover:bg-navy hover:text-white disabled:opacity-30">
          ⏭ {english ? 'Skip' : 'تخطي'}
        </button>
        <button type="button" onClick={onFinish} disabled={busy}
          className="rounded-xl border-2 border-red/30 bg-red/5 px-5 py-3 text-sm font-black text-red transition hover:bg-red/10">
          🏁 {english ? 'End' : 'إنهاء'}
        </button>
      </div>

      {/* Leaderboard */}
      <LeaderboardPanel players={players} english={english} totalQuestions={total} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function QuestionCard({ question, index, total, room, answeredCount, playerCount, english, remainingSeconds }: {
  question: LiveQuestionRow | undefined; index: number; total: number; room: LiveRoomRow
  answeredCount: number; playerCount: number; english: boolean; remainingSeconds: number | null
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy via-navy-2 to-[#0c2a3a] p-6 text-white shadow-[0_30px_60px_rgba(6,15,23,0.3)] sm:p-8">
      <div className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-teal/15 blur-[70px]" />
      <div className="relative">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs font-black">
          <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1.5">
            Q{index + 1} / {total}
          </span>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-gold-bright">
            💎 1–{room.max_wager} {english ? 'pts' : 'نقطة'}
          </span>
          <span className="rounded-full border border-green/40 bg-green/10 px-3 py-1.5 text-green">
            {answeredCount}/{playerCount} {english ? 'answered' : 'أجابوا'}
          </span>
          <QuestionTimer remainingSeconds={remainingSeconds} english={english} />
        </div>
        <h2 className="text-center font-display text-2xl font-black leading-[1.6] sm:text-3xl lg:text-4xl">
          {question ? question.question : '—'}
        </h2>
        {question?.image_url && (
          <img src={question.image_url} alt="" referrerPolicy="no-referrer"
            className="mx-auto mt-4 max-h-56 w-full max-w-xl rounded-2xl border border-white/10 object-cover shadow-lg" />
        )}
        {question?.hint && (
          <p className="mx-auto mt-4 max-w-lg rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm font-bold text-gold-bright">
            💡 {question.hint}
          </p>
        )}
      </div>
    </motion.div>
  )
}

/** During host_review — ALL answers visible with override controls */
function AnswerReviewList({ players, answerByPlayer, onOverrideGrade, english, busy }: {
  players: LivePlayerRow[]; answerByPlayer: Record<string, LiveAnswerRow>
  onOverrideGrade: (playerId: string, status: 'correct' | 'wrong') => void
  english: boolean; busy: boolean
}) {
  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel sm:p-6">
      <h3 className="font-display text-lg font-black text-navy">{english ? 'Review Answers' : 'مراجعة الإجابات'}</h3>
      <div className="mt-4 space-y-3">
        {players.map((player) => {
          const answer = answerByPlayer[player.id]
          const state = answer?.status
          return (
            <div key={player.id} className={cn(
              'flex flex-col gap-3 rounded-2xl border-2 p-4 transition sm:flex-row sm:items-center',
              state === 'correct' ? 'border-green/50 bg-green/5' : state === 'wrong' ? 'border-red/40 bg-red/5' : 'border-border-soft bg-surface-raised/40',
            )}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <PlayerAvatar player={player} size="sm" />
                <OnlineDot connected={player.connected} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-navy">{player.name}</p>
                  <p className="text-[11px] font-bold text-muted">★ {player.score}</p>
                </div>
              </div>
              <div className="min-w-0 flex-1 sm:max-w-md">
                {answer ? (
                  <div className="rounded-xl border border-border-soft bg-white px-4 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gold">{english ? 'Wager' : 'رهان'}: {answer.wager}</p>
                    <p className="truncate text-sm font-bold text-ink">{answer.answer_text || '—'}</p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border-strong bg-surface-raised/60 px-4 py-2.5 text-xs font-bold text-muted">
                    {english ? 'No answer' : 'لم يُجب'}
                  </p>
                )}
              </div>
              {answer && (
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn('hidden rounded-full px-2.5 py-1 text-[10px] font-black sm:inline-block',
                    state === 'correct' ? 'bg-green/15 text-green' : state === 'wrong' ? 'bg-red/10 text-red' : 'bg-gold/10 text-gold')}>
                    {state === 'correct' ? '✓' : state === 'wrong' ? '✗' : '⏳'}
                  </span>
                  <button type="button" disabled={busy} onClick={() => onOverrideGrade(player.id, 'correct')}
                    className={cn('rounded-lg border-2 px-3 py-1.5 text-xs font-black transition disabled:opacity-50',
                      state === 'correct' ? 'border-green bg-green text-white' : 'border-green/30 bg-green/5 text-green hover:bg-green/15')}>
                    ✓
                  </button>
                  <button type="button" disabled={busy} onClick={() => onOverrideGrade(player.id, 'wrong')}
                    className={cn('rounded-lg border-2 px-3 py-1.5 text-xs font-black transition disabled:opacity-50',
                      state === 'wrong' ? 'border-red bg-red text-white' : 'border-red/30 bg-red/5 text-red hover:bg-red/10')}>
                    ✗
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** During active phase — show submitted status only, NO answer text, NO override controls */
function AnswerListLive({ players, answerByPlayer, english }: {
  players: LivePlayerRow[]; answerByPlayer: Record<string, LiveAnswerRow>
  english: boolean
}) {
  return (
    <div className="rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel sm:p-6">
      <h3 className="font-display text-lg font-black text-navy">{english ? 'Player Answers' : 'إجابات اللاعبين'}</h3>
      <div className="mt-4 space-y-3">
        {players.length === 0 && <p className="py-8 text-center text-sm text-muted">{english ? 'No players yet.' : 'لا يوجد لاعبون.'}</p>}
        {players.map((player) => {
          const answer = answerByPlayer[player.id]
          return (
            <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-raised/40 p-3">
              <PlayerAvatar player={player} size="sm" />
              <OnlineDot connected={player.connected} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-navy">{player.name}</p>
              </div>
              {answer ? (
                <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-green">✓ {english ? 'Submitted' : 'مرسل'}</span>
              ) : (
                <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-muted">{english ? 'Awaiting' : 'بانتظار'}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
