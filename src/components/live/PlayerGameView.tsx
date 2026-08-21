import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { LiveAnswerRow, LivePlayerRow, LiveQuestionRow, LiveRoomRow, GamePhase } from '../../services/livePackService'
import { cn } from '../../utils/cn'
import { PlayerAvatar, OnlineDot, QuestionTimer } from './shared'
import { Mic } from 'lucide-react'
import { AnswerComposer } from './AnswerComposer'

/**
 * PlayerGameView — a player's game screen.
 *
 * Phases:
 *   question_intro → "Question N" (3s intro)
 *   active         → timer running, player answers
 *   host_review    → ALL answers visible (including host's), host is grading
 *   scoring        → leaderboard shown, scores finalized
 *   finished       → handled by GameResults
 *
 * CRITICAL: During 'host_review', EVERY player sees ALL submitted answers.
 * The host's own answer is also visible.
 * Players do NOT get grading controls — only the host does.
 */
export function PlayerGameView({
  room,
  players,
  questions,
  answers,
  myAnswer,
  remainingSeconds,
  expired,
  english,
  gamePhase,
  onSubmit,
  busy,
}: {
  room: LiveRoomRow
  players: LivePlayerRow[]
  questions: LiveQuestionRow[]
  answers: LiveAnswerRow[]
  myAnswer: LiveAnswerRow | null
  remainingSeconds: number | null
  expired: boolean
  english: boolean
  gamePhase: GamePhase
  onSubmit: (wager: number, text: string) => void
  busy: boolean
}) {
  const index = room.current_question_index
  const question = questions.find((q) => q.question_index === index)
  const total = questions.length

  // Answers for current question
  const answersForIndex = useMemo(() => answers.filter((a) => a.question_index === index), [answers, index])
  const answerByPlayer = useMemo(() => {
    const map: Record<string, LiveAnswerRow> = {}
    for (const answer of answersForIndex) map[answer.player_id] = answer
    return map
  }, [answersForIndex])

  // Player's current rank
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const myId = myAnswer?.player_id ?? ''
  const rank = sorted.findIndex((p) => p.user_id === myId || p.id === myId) + 1

  // ═══ QUESTION INTRO ═══
  if (gamePhase === 'question_intro') {
    return (
      <div className="space-y-5">
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
      </div>
    )
  }

  // ═══ HOST REVIEW — ALL answers visible, host is grading ═══
  if (gamePhase === 'host_review') {
    const myAutoGrade = myAnswer?.status
    return (
      <div className="space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-navy/10 px-3 py-1.5 text-xs font-black text-navy">
              Q{index + 1}/{total}
            </span>
            {rank > 0 && (
              <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-black text-gold">
                #{rank}
              </span>
            )}
          </div>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-black text-gold">
            {english ? 'Reviewing…' : 'جارٍ المراجعة…'}
          </span>
        </div>

        {/* Question card */}
        <QuestionCard question={question} english={english} />

        {/* Correct answer */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border-2 border-green/50 bg-green/5 p-5 text-center">
          <p className="text-sm font-black uppercase tracking-wider text-green mb-2">{english ? 'Correct Answer' : 'الإجابة الصحيحة'}</p>
          <p className="font-display text-2xl font-black text-green">{question?.answer}</p>
        </motion.div>

        {/* ALL answers — every player + host */}
        <div className="rounded-3xl border border-border-soft bg-white/80 p-5 shadow-panel sm:p-6">
          <h3 className="font-display text-lg font-black text-navy">{english ? 'All Answers' : 'جميع الإجابات'}</h3>
          <div className="mt-4 space-y-3">
            {players.map((player) => {
              const answer = answerByPlayer[player.id]
              const state = answer?.status
              return (
                <div key={player.id} className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 p-4',
                  state === 'correct' ? 'border-green/50 bg-green/5' : state === 'wrong' ? 'border-red/40 bg-red/5' : 'border-border-soft bg-surface-raised/40',
                )}>
                  <PlayerAvatar player={player} size="sm" />
                  <OnlineDot connected={player.connected} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-navy">{player.name}</p>
                    {answer ? (
                      <p className="text-xs font-bold text-muted">{english ? 'Wager' : 'رهان'}: {answer.wager}</p>
                    ) : null}
                  </div>
                  <div className="min-w-0 max-w-[200px] sm:max-w-xs">
                    {answer ? (
                      <p className="truncate rounded-xl border border-border-soft bg-white px-3 py-2 text-sm font-bold text-ink">
                        {answer.answer_text || '—'}
                      </p>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border-strong bg-surface-raised/60 px-3 py-2 text-xs font-bold text-muted">
                        {english ? 'No answer' : 'لم يُجب'}
                      </p>
                    )}
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black',
                    state === 'correct' ? 'bg-green/15 text-green' : state === 'wrong' ? 'bg-red/10 text-red' : 'bg-gold/10 text-gold')}>
                    {state === 'correct' ? '✓' : state === 'wrong' ? '✗' : '⏳'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Host's own answer (if host is not in players list) */}
        {myAnswer && !players.some((p) => p.user_id === myAnswer.player_id || p.id === myAnswer.player_id) && (
          <div className="rounded-2xl border border-border-soft bg-surface-raised/40 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-muted mb-2"><Mic className="mr-1 inline h-3 w-3" /> {english ? 'Host answer' : 'إجابة المضيف'}</p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-ink">{myAnswer.answer_text || '—'}</span>
              <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black',
                myAnswer.status === 'correct' ? 'bg-green/15 text-green' : 'bg-red/10 text-red')}>
                {myAnswer.status === 'correct' ? '✓' : '✗'}
              </span>
            </div>
          </div>
        )}

        {/* Player's own result */}
        {myAnswer && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={cn('rounded-[2rem] border-2 p-6 text-center',
              myAutoGrade === 'correct' ? 'border-green/50 bg-green/5' : myAutoGrade === 'wrong' ? 'border-red/40 bg-red/5' : 'border-gold/40 bg-gold/5')}>
            <p className="text-sm font-black uppercase tracking-wider text-muted mb-3">
              {english ? 'Host is reviewing…' : 'المضيف يراجع…'}
            </p>
            {myAutoGrade === 'correct' ? (
              <p className="text-xl font-black text-green">✅ {english ? 'Auto-graded: Correct' : 'تصحيح تلقائي: صحيح'}</p>
            ) : myAutoGrade === 'wrong' ? (
              <p className="text-xl font-black text-red">❌ {english ? 'Auto-graded: Wrong' : 'تصحيح تلقائي: خطأ'}</p>
            ) : (
              <p className="text-lg font-black text-gold">{english ? 'Awaiting review' : 'في انتظار المراجعة'}</p>
            )}
          </motion.div>
        )}
      </div>
    )
  }

  // ═══ SCORING — Show leaderboard (scores are final) ═══
  if (gamePhase === 'scoring') {
    return (
      <div className="space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-navy/10 px-3 py-1.5 text-xs font-black text-navy">
              Q{index + 1}/{total}
            </span>
            {rank > 0 && (
              <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-black text-gold">
                #{rank}
              </span>
            )}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border-2 border-gold/50 bg-gold/10 p-6 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-lg font-black text-navy">{english ? 'Leaderboard' : 'لوحة الصدارة'}</p>
        </motion.div>
        <div className="space-y-2">
          {sorted.map((player, i) => (
            <motion.div key={player.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={cn('flex items-center gap-3 rounded-xl border-2 px-4 py-3',
                i === 0 ? 'border-gold/50 bg-gold/5' : 'border-border-soft bg-surface-raised/40')}>
              <span className="w-8 text-center font-display text-lg font-black text-navy">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-navy">{player.name}</p>
              </div>
              <span className={cn('font-display text-xl font-black tabular-nums', i === 0 ? 'text-gold' : 'text-navy')}>
                {player.score}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  // ═══ ACTIVE — Normal gameplay (player answers) ═══
  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/20 bg-navy/10 px-3 py-1.5 text-xs font-black text-navy">
            Q{index + 1}/{total}
          </span>
          {rank > 0 && (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-black text-gold">
              #{rank}
            </span>
          )}
        </div>
        <span className="rounded-full border border-green/40 bg-green/10 px-3 py-1.5 text-xs font-black text-green">
          {english ? 'Answer now!' : 'أجب الآن!'}
        </span>
        <QuestionTimer remainingSeconds={remainingSeconds} english={english} />
      </div>

      <QuestionCard question={question} english={english} />
      <AnswerComposer room={room} myAnswer={myAnswer} expired={expired} english={english} onSubmit={onSubmit} busy={busy} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuestionCard({ question, english }: { question: LiveQuestionRow | undefined; english: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy via-navy-2 to-[#0c2a3a] p-6 text-center text-white shadow-[0_20px_50px_rgba(6,15,23,0.25)] sm:p-8">
      {question?.image_url && (
        <img src={question.image_url} alt="" referrerPolicy="no-referrer"
          className="mx-auto mb-4 max-h-44 w-full max-w-lg rounded-2xl border border-white/10 object-cover" />
      )}
      <h2 className="font-display text-xl font-black leading-[1.6] sm:text-2xl lg:text-3xl">
        {question ? question.question : (english ? 'Loading…' : 'جارٍ التحميل…')}
      </h2>
      {question?.hint && (
        <p className="mx-auto mt-3 max-w-md rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-bold text-gold-bright">
          💡 {question.hint}
        </p>
      )}
    </motion.div>
  )
}
